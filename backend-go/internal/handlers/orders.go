package handlers

import (
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// ─── Get My Orders (Customer) ───────────────────────

func (h *Handler) GetMyOrders(w http.ResponseWriter, r *http.Request) {
	user := GetUser(r)
	ctx := r.Context()

	// Find customer record linked to this user
	var customerID string
	err := h.DB.QueryRow(ctx, `SELECT id FROM customers WHERE user_id = $1`, user.ID).Scan(&customerID)
	if err != nil {
		RespondJSON(w, 200, map[string]interface{}{"orders": []interface{}{}})
		return
	}

	// Get orders
	rows, err := h.DB.Query(ctx, `
		SELECT id, order_number, quotation_id, customer_id, shipping_address, shipping_city, shipping_phone,
			   promo_code, subtotal, discount, shipping_fee, payment_method, order_type, status, total, notes, created_at, updated_at
		FROM orders WHERE customer_id = $1 ORDER BY created_at DESC`, customerID)
	if err != nil {
		RespondError(w, 500, "Failed to fetch orders.")
		return
	}
	defer rows.Close()

	orders := []map[string]interface{}{}
	for rows.Next() {
		var o struct {
			ID, OrderNumber, CustomerID, PaymentMethod, OrderType, Status string
			QuotationID, ShippingAddress, ShippingCity, ShippingPhone, PromoCode, Notes *string
			Subtotal, Discount, ShippingFee, Total float64
			CreatedAt, UpdatedAt time.Time
		}
		if err := rows.Scan(&o.ID, &o.OrderNumber, &o.QuotationID, &o.CustomerID, &o.ShippingAddress, &o.ShippingCity, &o.ShippingPhone,
			&o.PromoCode, &o.Subtotal, &o.Discount, &o.ShippingFee, &o.PaymentMethod, &o.OrderType, &o.Status, &o.Total, &o.Notes, &o.CreatedAt, &o.UpdatedAt); err != nil {
			continue
		}

		// Get items with product info
		itemRows, _ := h.DB.Query(ctx, `
			SELECT oi.id, oi.order_id, oi.product_id, oi.product_name, oi.quantity, oi.unit_price, oi.line_total,
				   p.image_url, p.slug, p.name as p_name, p.price as p_price
			FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
			WHERE oi.order_id = $1`, o.ID)
		items := []map[string]interface{}{}
		if itemRows != nil {
			for itemRows.Next() {
				var iID, iOrderID, iProductID, iProductName string
				var iQty int
				var iUnitPrice, iLineTotal float64
				var pImageURL, pSlug, pName *string
				var pPrice *float64
				if err := itemRows.Scan(&iID, &iOrderID, &iProductID, &iProductName, &iQty, &iUnitPrice, &iLineTotal,
					&pImageURL, &pSlug, &pName, &pPrice); err != nil {
					continue
				}
				item := map[string]interface{}{
					"id": iID, "orderId": iOrderID, "productId": iProductID, "productName": iProductName,
					"quantity": iQty, "unitPrice": iUnitPrice, "lineTotal": iLineTotal,
				}
				if pName != nil {
					item["product"] = map[string]interface{}{"imageUrl": pImageURL, "slug": pSlug, "name": pName, "price": pPrice}
				}
				items = append(items, item)
			}
			itemRows.Close()
		}

		order := map[string]interface{}{
			"id": o.ID, "orderNumber": o.OrderNumber, "quotationId": o.QuotationID, "customerId": o.CustomerID,
			"shippingAddress": o.ShippingAddress, "shippingCity": o.ShippingCity, "shippingPhone": o.ShippingPhone,
			"promoCode": o.PromoCode, "subtotal": o.Subtotal, "discount": o.Discount, "shippingFee": o.ShippingFee,
			"paymentMethod": o.PaymentMethod, "orderType": o.OrderType, "status": o.Status, "total": o.Total,
			"notes": o.Notes, "createdAt": o.CreatedAt, "updatedAt": o.UpdatedAt, "items": items,
		}

		// Get quotation number if exists
		if o.QuotationID != nil {
			var qn string
			if h.DB.QueryRow(ctx, `SELECT quotation_number FROM quotations WHERE id = $1`, *o.QuotationID).Scan(&qn) == nil {
				order["quotation"] = map[string]interface{}{"quotationNumber": qn}
			}
		}

		orders = append(orders, order)
	}

	RespondJSON(w, 200, map[string]interface{}{"orders": orders})
}

// ─── List Orders (Admin) ────────────────────────────

func (h *Handler) ListOrders(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	status := r.URL.Query().Get("status")
	orderType := r.URL.Query().Get("type")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 { page = 1 }
	if limit < 1 { limit = 20 }
	offset := (page - 1) * limit

	conditions := []string{}
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		conditions = append(conditions, fmt.Sprintf(`(o.order_number ILIKE $%d OR c.contact_person ILIKE $%d OR c.company_name ILIKE $%d)`, argIdx, argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if status != "" {
		conditions = append(conditions, fmt.Sprintf(`o.status = $%d`, argIdx))
		args = append(args, status)
		argIdx++
	}
	if orderType != "" {
		conditions = append(conditions, fmt.Sprintf(`o.order_type = $%d`, argIdx))
		args = append(args, orderType)
		argIdx++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	ctx := r.Context()
	var total int
	h.DB.QueryRow(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM orders o LEFT JOIN customers c ON c.id = o.customer_id %s`, whereClause), args...).Scan(&total)

	query := fmt.Sprintf(`
		SELECT o.id, o.order_number, o.customer_id, o.order_type, o.status, o.total, o.payment_method, o.created_at,
			   c.contact_person, c.company_name, c.email as c_email,
			   (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
		FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
		%s ORDER BY o.created_at DESC LIMIT $%d OFFSET $%d`, whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		RespondError(w, 500, "Failed to fetch orders.")
		return
	}
	defer rows.Close()

	orders := []map[string]interface{}{}
	for rows.Next() {
		var oID, oNumber, oCustID, oType, oStatus, oPM string
		var oTotal float64
		var oCreatedAt time.Time
		var cPerson, cCompany, cEmail *string
		var itemCount int

		if err := rows.Scan(&oID, &oNumber, &oCustID, &oType, &oStatus, &oTotal, &oPM, &oCreatedAt,
			&cPerson, &cCompany, &cEmail, &itemCount); err != nil {
			continue
		}

		orders = append(orders, map[string]interface{}{
			"id": oID, "orderNumber": oNumber, "customerId": oCustID, "orderType": oType,
			"status": oStatus, "total": oTotal, "paymentMethod": oPM, "createdAt": oCreatedAt,
			"customer": map[string]interface{}{"id": oCustID, "contactPerson": cPerson, "companyName": cCompany, "email": cEmail},
			"_count":   map[string]int{"items": itemCount},
		})
	}

	pages := int(math.Ceil(float64(total) / float64(limit)))
	RespondJSON(w, 200, map[string]interface{}{
		"orders":     orders,
		"pagination": map[string]interface{}{"page": page, "limit": limit, "total": total, "pages": pages},
	})
}

// ─── Get New Order Count ────────────────────────────

func (h *Handler) GetNewOrderCount(w http.ResponseWriter, r *http.Request) {
	var count int
	h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM orders WHERE status = 'PENDING'`).Scan(&count)
	RespondJSON(w, 200, map[string]interface{}{"count": count})
}

// ─── Get Order ──────────────────────────────────────

func (h *Handler) GetOrder(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ctx := r.Context()
	user := GetUser(r)

	var o struct {
		ID, OrderNumber, CustomerID, PaymentMethod, OrderType, Status string
		QuotationID, ShippingAddress, ShippingCity, ShippingPhone, PromoCode, Notes *string
		Subtotal, Discount, ShippingFee, Total float64
		CreatedAt, UpdatedAt time.Time
	}
	err := h.DB.QueryRow(ctx, `
		SELECT id, order_number, quotation_id, customer_id, shipping_address, shipping_city, shipping_phone,
			   promo_code, subtotal, discount, shipping_fee, payment_method, order_type, status, total, notes, created_at, updated_at
		FROM orders WHERE id = $1`, id,
	).Scan(&o.ID, &o.OrderNumber, &o.QuotationID, &o.CustomerID, &o.ShippingAddress, &o.ShippingCity, &o.ShippingPhone,
		&o.PromoCode, &o.Subtotal, &o.Discount, &o.ShippingFee, &o.PaymentMethod, &o.OrderType, &o.Status, &o.Total, &o.Notes, &o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		RespondError(w, 404, "Order not found.")
		return
	}

	// Customers can only see their own orders
	if user.Role == "CUSTOMER" {
		var custUserID *string
		h.DB.QueryRow(ctx, `SELECT user_id FROM customers WHERE id = $1`, o.CustomerID).Scan(&custUserID)
		if custUserID == nil || *custUserID != user.ID {
			RespondError(w, 403, "Access denied.")
			return
		}
	}

	order := map[string]interface{}{
		"id": o.ID, "orderNumber": o.OrderNumber, "quotationId": o.QuotationID, "customerId": o.CustomerID,
		"shippingAddress": o.ShippingAddress, "shippingCity": o.ShippingCity, "shippingPhone": o.ShippingPhone,
		"promoCode": o.PromoCode, "subtotal": o.Subtotal, "discount": o.Discount, "shippingFee": o.ShippingFee,
		"paymentMethod": o.PaymentMethod, "orderType": o.OrderType, "status": o.Status, "total": o.Total,
		"notes": o.Notes, "createdAt": o.CreatedAt, "updatedAt": o.UpdatedAt,
	}

	// Customer info
	var cPerson string
	var cCompany, cEmail, cPhone, cAddr *string
	if h.DB.QueryRow(ctx, `SELECT contact_person, company_name, email, phone, address FROM customers WHERE id = $1`, o.CustomerID).Scan(&cPerson, &cCompany, &cEmail, &cPhone, &cAddr) == nil {
		order["customer"] = map[string]interface{}{"id": o.CustomerID, "contactPerson": cPerson, "companyName": cCompany, "email": cEmail, "phone": cPhone, "address": cAddr}
	}

	// Items with products
	itemRows, _ := h.DB.Query(ctx, `
		SELECT oi.id, oi.product_id, oi.product_name, oi.quantity, oi.unit_price, oi.line_total,
			   p.image_url, p.slug, p.name, p.price
		FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1`, id)
	items := []map[string]interface{}{}
	if itemRows != nil {
		for itemRows.Next() {
			var iID, iProdID, iProdName string
			var iQty int
			var iUP, iLT float64
			var pImg, pSlug, pName *string
			var pPrice *float64
			if itemRows.Scan(&iID, &iProdID, &iProdName, &iQty, &iUP, &iLT, &pImg, &pSlug, &pName, &pPrice) == nil {
				item := map[string]interface{}{"id": iID, "productId": iProdID, "productName": iProdName, "quantity": iQty, "unitPrice": iUP, "lineTotal": iLT}
				if pName != nil {
					item["product"] = map[string]interface{}{"imageUrl": pImg, "slug": pSlug, "name": pName, "price": pPrice}
				}
				items = append(items, item)
			}
		}
		itemRows.Close()
	}
	order["items"] = items

	// Timeline
	tlRows, _ := h.DB.Query(ctx, `SELECT id, status, note, created_at FROM order_timeline WHERE order_id = $1 ORDER BY created_at ASC`, id)
	timeline := []map[string]interface{}{}
	if tlRows != nil {
		for tlRows.Next() {
			var tID, tStatus string
			var tNote *string
			var tCreatedAt time.Time
			if tlRows.Scan(&tID, &tStatus, &tNote, &tCreatedAt) == nil {
				timeline = append(timeline, map[string]interface{}{"id": tID, "status": tStatus, "note": tNote, "createdAt": tCreatedAt})
			}
		}
		tlRows.Close()
	}
	order["timeline"] = timeline

	RespondJSON(w, 200, map[string]interface{}{"order": order})
}

// ─── Get Order Timeline ─────────────────────────────

func (h *Handler) GetOrderTimeline(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := h.DB.Query(r.Context(),
		`SELECT id, order_id, status, note, created_at FROM order_timeline WHERE order_id = $1 ORDER BY created_at ASC`, id)
	if err != nil {
		RespondError(w, 500, "Failed to fetch timeline.")
		return
	}
	defer rows.Close()

	timeline := []map[string]interface{}{}
	for rows.Next() {
		var tID, tOrderID, tStatus string
		var tNote *string
		var tCreatedAt time.Time
		if rows.Scan(&tID, &tOrderID, &tStatus, &tNote, &tCreatedAt) == nil {
			timeline = append(timeline, map[string]interface{}{"id": tID, "orderId": tOrderID, "status": tStatus, "note": tNote, "createdAt": tCreatedAt})
		}
	}

	RespondJSON(w, 200, map[string]interface{}{"timeline": timeline})
}

// ─── Update Order Status ────────────────────────────

func (h *Handler) UpdateOrderStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ctx := r.Context()

	var body struct {
		Status string `json:"status"`
		Note   string `json:"note"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, 400, "Invalid request body.")
		return
	}

	validStatuses := map[string]bool{
		"PENDING": true, "CONFIRMED": true, "PROCESSING": true,
		"SHIPPED": true, "DELIVERED": true, "COMPLETED": true, "CANCELLED": true,
	}
	if !validStatuses[body.Status] {
		RespondError(w, 400, "Invalid status.")
		return
	}

	// Get current order
	var currentStatus, orderNumber, customerID string
	err := h.DB.QueryRow(ctx, `SELECT status, order_number, customer_id FROM orders WHERE id = $1`, id).Scan(&currentStatus, &orderNumber, &customerID)
	if err != nil {
		RespondError(w, 404, "Order not found.")
		return
	}

	now := time.Now()

	// Update status
	_, err = h.DB.Exec(ctx, `UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3`, body.Status, now, id)
	if err != nil {
		RespondError(w, 500, "Failed to update order status.")
		return
	}

	// Create timeline entry
	note := body.Note
	if note == "" {
		note = fmt.Sprintf("Status changed from %s to %s", currentStatus, body.Status)
	}
	h.DB.Exec(ctx, `INSERT INTO order_timeline (id, order_id, status, note, created_at) VALUES ($1, $2, $3, $4, $5)`,
		uuid.New().String(), id, body.Status, note, now)

	// If cancelled, restore stock
	if body.Status == "CANCELLED" {
		itemRows, _ := h.DB.Query(ctx, `SELECT product_id, quantity FROM order_items WHERE order_id = $1`, id)
		if itemRows != nil {
			for itemRows.Next() {
				var prodID string
				var qty int
				if itemRows.Scan(&prodID, &qty) == nil {
					h.DB.Exec(ctx, `UPDATE products SET stock = stock + $1 WHERE id = $2`, qty, prodID)
				}
			}
			itemRows.Close()
		}
	}

	// Send email notification
	go func() {
		var custEmail, custName *string
		var custUserID *string
		h.DB.QueryRow(ctx, `SELECT email, contact_person, user_id FROM customers WHERE id = $1`, customerID).Scan(&custEmail, &custName, &custUserID)

		email := ""
		name := ""
		if custEmail != nil {
			email = *custEmail
		} else if custUserID != nil {
			h.DB.QueryRow(ctx, `SELECT email, name FROM users WHERE id = $1`, *custUserID).Scan(&email, &name)
		}
		if custName != nil {
			name = *custName
		}
		if email != "" {
			h.Email.SendOrderStatusUpdateEmail(email, name, orderNumber, body.Status)
		}
	}()

	RespondJSON(w, 200, map[string]interface{}{
		"message": fmt.Sprintf("Order status updated to %s.", body.Status),
		"order":   map[string]interface{}{"id": id, "status": body.Status, "updatedAt": now},
	})
}

// ─── Cancel Order ───────────────────────────────────

func (h *Handler) CancelOrder(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := GetUser(r)
	ctx := r.Context()

	var currentStatus, customerID string
	err := h.DB.QueryRow(ctx, `SELECT status, customer_id FROM orders WHERE id = $1`, id).Scan(&currentStatus, &customerID)
	if err != nil {
		RespondError(w, 404, "Order not found.")
		return
	}

	// Customers can only cancel their own orders
	if user.Role == "CUSTOMER" {
		var custUserID *string
		h.DB.QueryRow(ctx, `SELECT user_id FROM customers WHERE id = $1`, customerID).Scan(&custUserID)
		if custUserID == nil || *custUserID != user.ID {
			RespondError(w, 403, "Access denied.")
			return
		}
	}

	if currentStatus != "PENDING" {
		RespondError(w, 400, "Only pending orders can be cancelled.")
		return
	}

	now := time.Now()

	// Restore stock
	itemRows, _ := h.DB.Query(ctx, `SELECT product_id, quantity FROM order_items WHERE order_id = $1`, id)
	if itemRows != nil {
		for itemRows.Next() {
			var prodID string
			var qty int
			if itemRows.Scan(&prodID, &qty) == nil {
				h.DB.Exec(ctx, `UPDATE products SET stock = stock + $1 WHERE id = $2`, qty, prodID)
			}
		}
		itemRows.Close()
	}

	// Update status
	h.DB.Exec(ctx, `UPDATE orders SET status = 'CANCELLED', updated_at = $1 WHERE id = $2`, now, id)
	h.DB.Exec(ctx, `INSERT INTO order_timeline (id, order_id, status, note, created_at) VALUES ($1, $2, 'CANCELLED', 'Order cancelled by customer', $3)`,
		uuid.New().String(), id, now)

	RespondJSON(w, 200, map[string]interface{}{
		"message": "Order cancelled successfully.",
		"order":   map[string]interface{}{"id": id, "status": "CANCELLED"},
	})
}

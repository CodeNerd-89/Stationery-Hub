package handlers

import (
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ─── Place Order (B2C Checkout) ─────────────────────

func (h *Handler) PlaceOrder(w http.ResponseWriter, r *http.Request) {
	user := GetUser(r)
	ctx := r.Context()

	var body struct {
		Items []struct {
			ProductID string `json:"productId"`
			Quantity  int    `json:"quantity"`
		} `json:"items"`
		ShippingAddress string  `json:"shippingAddress"`
		ShippingCity    string  `json:"shippingCity"`
		ShippingPhone   string  `json:"shippingPhone"`
		PaymentMethod   string  `json:"paymentMethod"`
		PromoCode       string  `json:"promoCode"`
		Notes           string  `json:"notes"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, 400, "Invalid request body.")
		return
	}

	if len(body.Items) == 0 {
		RespondError(w, 400, "At least one item is required.")
		return
	}
	if body.ShippingAddress == "" || body.ShippingPhone == "" {
		RespondError(w, 400, "Shipping address and phone are required.")
		return
	}
	if body.PaymentMethod == "" {
		body.PaymentMethod = "COD"
	}

	// Validate products and calculate totals
	var subtotal float64
	type itemInfo struct {
		ProductID   string
		ProductName string
		Quantity    int
		UnitPrice   float64
		LineTotal   float64
	}
	orderItems := []itemInfo{}

	for _, item := range body.Items {
		var name string
		var price float64
		var stock int
		err := h.DB.QueryRow(ctx, `SELECT name, price, stock FROM products WHERE id = $1 AND is_active = true`, item.ProductID).Scan(&name, &price, &stock)
		if err != nil {
			RespondError(w, 400, fmt.Sprintf("Product %s not found or inactive.", item.ProductID))
			return
		}
		if item.Quantity > stock {
			RespondError(w, 400, fmt.Sprintf("Insufficient stock for %s (available: %d).", name, stock))
			return
		}
		lineTotal := price * float64(item.Quantity)
		subtotal += lineTotal
		orderItems = append(orderItems, itemInfo{
			ProductID: item.ProductID, ProductName: name,
			Quantity: item.Quantity, UnitPrice: price, LineTotal: lineTotal,
		})
	}

	// Apply promo code
	var discount float64
	var promoCodeStr *string
	if body.PromoCode != "" {
		var pID, pCode, pDiscountType string
		var pDiscountValue float64
		var pMinOrder *float64
		var pValidFrom, pValidUntil time.Time
		var pUsageLimit *int
		var pUsedCount int
		var pIsActive bool

		err := h.DB.QueryRow(ctx,
			`SELECT id, code, discount_type, discount_value, min_order_amount, valid_from, valid_until, usage_limit, used_count, is_active
			 FROM promo_codes WHERE code = $1`, strings.ToUpper(body.PromoCode),
		).Scan(&pID, &pCode, &pDiscountType, &pDiscountValue, &pMinOrder, &pValidFrom, &pValidUntil, &pUsageLimit, &pUsedCount, &pIsActive)

		if err == nil && pIsActive {
			now := time.Now()
			valid := now.After(pValidFrom) && now.Before(pValidUntil)
			if pUsageLimit != nil {
				valid = valid && pUsedCount < *pUsageLimit
			}
			if pMinOrder != nil {
				valid = valid && subtotal >= *pMinOrder
			}
			if valid {
				if pDiscountType == "PERCENTAGE" {
					discount = math.Round(subtotal*pDiscountValue) / 100
				} else {
					discount = pDiscountValue
				}
				if discount > subtotal {
					discount = subtotal
				}
				promoCodeStr = &pCode
				// Increment usage
				h.DB.Exec(ctx, `UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1`, pID)
			}
		}
	}

	// Shipping fee
	var shippingFee float64 = 150
	if subtotal >= 5000 {
		shippingFee = 0
	}

	total, _ := strconv.ParseFloat(fmt.Sprintf("%.2f", subtotal-discount+shippingFee), 64)

	// Generate order number
	orderNumber := fmt.Sprintf("ORD-%s-%03d", time.Now().Format("20060102"), randomInt(1, 999))

	// Find or create customer
	var customerID string
	err := h.DB.QueryRow(ctx, `SELECT id FROM customers WHERE user_id = $1`, user.ID).Scan(&customerID)
	if err != nil {
		// Create customer from user info
		customerID = uuid.New().String()
		h.DB.Exec(ctx, `INSERT INTO customers (id, user_id, contact_person, email, phone, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $6)`,
			customerID, user.ID, user.Name, user.Email, body.ShippingPhone, time.Now())
	}

	now := time.Now()
	orderID := uuid.New().String()

	// Begin transaction
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		RespondError(w, 500, "Failed to start transaction.")
		return
	}
	defer tx.Rollback(ctx)

	// Create order
	var notes *string
	if body.Notes != "" {
		notes = &body.Notes
	}
	var shippingCity *string
	if body.ShippingCity != "" {
		shippingCity = &body.ShippingCity
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO orders (id, order_number, customer_id, shipping_address, shipping_city, shipping_phone, promo_code, subtotal, discount, shipping_fee, payment_method, order_type, status, total, notes, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'B2C', 'PENDING', $12, $13, $14, $14)`,
		orderID, orderNumber, customerID, body.ShippingAddress, shippingCity, body.ShippingPhone,
		promoCodeStr, subtotal, discount, shippingFee, body.PaymentMethod, total, notes, now)
	if err != nil {
		RespondError(w, 500, "Failed to create order.")
		return
	}

	// Create order items and decrement stock
	for _, item := range orderItems {
		_, err = tx.Exec(ctx,
			`INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, line_total)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			uuid.New().String(), orderID, item.ProductID, item.ProductName, item.Quantity, item.UnitPrice, item.LineTotal)
		if err != nil {
			RespondError(w, 500, "Failed to create order items.")
			return
		}
		_, err = tx.Exec(ctx, `UPDATE products SET stock = stock - $1 WHERE id = $2`, item.Quantity, item.ProductID)
		if err != nil {
			RespondError(w, 500, "Failed to update stock.")
			return
		}
	}

	// Create timeline entry
	tx.Exec(ctx, `INSERT INTO order_timeline (id, order_id, status, note, created_at) VALUES ($1, $2, 'PENDING', 'Order placed', $3)`,
		uuid.New().String(), orderID, now)

	if err := tx.Commit(ctx); err != nil {
		RespondError(w, 500, "Failed to commit order.")
		return
	}

	// Build response items
	respItems := []map[string]interface{}{}
	for _, item := range orderItems {
		respItems = append(respItems, map[string]interface{}{
			"productName": item.ProductName, "quantity": item.Quantity, "lineTotal": item.LineTotal,
		})
	}

	// Send emails asynchronously
	go h.Email.SendOrderConfirmationEmail(user.Email, user.Name, map[string]interface{}{
		"orderNumber": orderNumber, "total": total, "items": respItems, "paymentMethod": body.PaymentMethod,
	})
	go h.Email.SendAdminNewOrderEmail(map[string]interface{}{
		"orderNumber": orderNumber, "total": total, "customerName": user.Name, "itemCount": len(orderItems),
	})

	RespondJSON(w, 201, map[string]interface{}{
		"message": "Order placed successfully!",
		"order": map[string]interface{}{
			"id": orderID, "orderNumber": orderNumber, "status": "PENDING", "total": total,
			"subtotal": subtotal, "discount": discount, "shippingFee": shippingFee,
		},
	})
}

func randomInt(min, max int) int {
	return min + int(time.Now().UnixNano()%int64(max-min+1))
}

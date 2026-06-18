package handlers

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"stationery-hub-backend/internal/models"
	"stationery-hub-backend/internal/services"
)

// ─── Generate Quotation Number: QT-YYYYMMDD-NNN ────
func (h *Handler) generateQuotationNumber(ctx context.Context) (string, error) {
	now := time.Now()
	dateStr := now.Format("20060102")
	prefix := "QT-" + dateStr

	var lastNumber *string
	err := h.DB.QueryRow(ctx,
		`SELECT quotation_number FROM quotations
		 WHERE quotation_number LIKE $1 || '%'
		 ORDER BY quotation_number DESC LIMIT 1`, prefix).Scan(&lastNumber)

	sequence := 1
	if err == nil && lastNumber != nil {
		parts := strings.Split(*lastNumber, "-")
		if len(parts) == 3 {
			if n, e := strconv.Atoi(parts[2]); e == nil {
				sequence = n + 1
			}
		}
	}

	return fmt.Sprintf("%s-%03d", prefix, sequence), nil
}

// ─── List Quotations ────────────────────────────────
func (h *Handler) ListQuotations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	status := r.URL.Query().Get("status")
	customerID := r.URL.Query().Get("customerId")
	search := r.URL.Query().Get("search")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	offset := (page - 1) * limit

	// Build WHERE clause
	where := "WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if status != "" {
		where += fmt.Sprintf(" AND q.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if customerID != "" {
		where += fmt.Sprintf(" AND q.customer_id = $%d", argIdx)
		args = append(args, customerID)
		argIdx++
	}
	if search != "" {
		where += fmt.Sprintf(` AND (q.quotation_number ILIKE $%d OR c.contact_person ILIKE $%d OR c.company_name ILIKE $%d)`, argIdx, argIdx+1, argIdx+2)
		s := "%" + search + "%"
		args = append(args, s, s, s)
		argIdx += 3
	}

	// Count
	var total int
	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM quotations q LEFT JOIN customers c ON q.customer_id = c.id %s`, where)
	if err := h.DB.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		RespondError(w, 500, "Failed to count quotations.")
		return
	}

	// Query
	query := fmt.Sprintf(`
		SELECT q.id, q.quotation_number, q.customer_id, q.created_by_id, q.status,
		       q.subtotal, q.discount_amount, q.total, q.notes, q.valid_until,
		       q.created_at, q.updated_at,
		       c.id, c.contact_person, c.company_name,
		       u.name,
		       (SELECT COUNT(*) FROM quotation_items qi WHERE qi.quotation_id = q.id) AS item_count
		FROM quotations q
		LEFT JOIN customers c ON q.customer_id = c.id
		LEFT JOIN users u ON q.created_by_id = u.id
		%s
		ORDER BY q.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		RespondError(w, 500, "Failed to fetch quotations.")
		return
	}
	defer rows.Close()

	quotations := []map[string]interface{}{}
	for rows.Next() {
		var (
			id, qNum, createdByID, status string
			customerID                     *string
			subtotal, discountAmt, total   float64
			notes                          *string
			validUntil                     *time.Time
			createdAt, updatedAt           *time.Time
			custID                         *string
			custContact                    *string
			custCompany                    *string
			createdByName                  *string
			itemCount                      int
		)
		if err := rows.Scan(
			&id, &qNum, &customerID, &createdByID, &status,
			&subtotal, &discountAmt, &total, &notes, &validUntil,
			&createdAt, &updatedAt,
			&custID, &custContact, &custCompany,
			&createdByName,
			&itemCount,
		); err != nil {
			RespondError(w, 500, "Failed to parse quotation.")
			return
		}

		q := map[string]interface{}{
			"id":              id,
			"quotationNumber": qNum,
			"customerId":      customerID,
			"createdById":     createdByID,
			"status":          status,
			"subtotal":        subtotal,
			"discountAmount":  discountAmt,
			"total":           total,
			"notes":           notes,
			"validUntil":      validUntil,
			"createdAt":       createdAt,
			"updatedAt":       updatedAt,
			"_count":          map[string]int{"items": itemCount},
		}

		if custID != nil {
			q["customer"] = map[string]interface{}{
				"id":            *custID,
				"contactPerson": custContact,
				"companyName":   custCompany,
			}
		} else {
			q["customer"] = nil
		}

		if createdByName != nil {
			q["createdBy"] = map[string]string{"name": *createdByName}
		} else {
			q["createdBy"] = nil
		}

		quotations = append(quotations, q)
	}

	pages := int(math.Ceil(float64(total) / float64(limit)))
	RespondJSON(w, 200, map[string]interface{}{
		"quotations": quotations,
		"pagination": models.Pagination{Page: page, Limit: limit, Total: total, Pages: pages},
	})
}

// ─── Get Quotation by ID ────────────────────────────
func (h *Handler) GetQuotation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	user := GetUser(r)

	// Main quotation
	var (
		qID, qNum, createdByID, qStatus string
		customerID                       *string
		subtotal, discountAmt, total     float64
		notes                            *string
		validUntil                       *time.Time
		createdAt, updatedAt             *time.Time
	)
	err := h.DB.QueryRow(ctx,
		`SELECT id, quotation_number, customer_id, created_by_id, status,
		        subtotal, discount_amount, total, notes, valid_until,
		        created_at, updated_at
		 FROM quotations WHERE id = $1`, id).Scan(
		&qID, &qNum, &customerID, &createdByID, &qStatus,
		&subtotal, &discountAmt, &total, &notes, &validUntil,
		&createdAt, &updatedAt,
	)
	if err != nil {
		RespondError(w, 404, "Quotation not found.")
		return
	}

	// Customer access check
	if user.Role == "CUSTOMER" {
		var custID string
		err := h.DB.QueryRow(ctx, `SELECT id FROM customers WHERE user_id = $1`, user.ID).Scan(&custID)
		if err != nil || customerID == nil || custID != *customerID {
			RespondError(w, 403, "Access denied.")
			return
		}
	}

	// Customer details
	var customer interface{}
	if customerID != nil {
		var c models.Customer
		err := h.DB.QueryRow(ctx,
			`SELECT id, user_id, company_name, contact_person, phone, email, address, notes, created_at, updated_at
			 FROM customers WHERE id = $1`, *customerID).Scan(
			&c.ID, &c.UserID, &c.CompanyName, &c.ContactPerson, &c.Phone, &c.Email, &c.Address, &c.Notes, &c.CreatedAt, &c.UpdatedAt,
		)
		if err == nil {
			customer = c
		}
	}

	// CreatedBy
	var createdBy *models.UserBrief
	var cName, cEmail string
	if err := h.DB.QueryRow(ctx, `SELECT name, email FROM users WHERE id = $1`, createdByID).Scan(&cName, &cEmail); err == nil {
		createdBy = &models.UserBrief{Name: cName, Email: &cEmail}
	}

	// Items
	itemRows, err := h.DB.Query(ctx,
		`SELECT qi.id, qi.quotation_id, qi.product_id, qi.product_name, qi.quantity,
		        qi.unit_price, qi.discount_percent, qi.line_total, qi.notes,
		        p.id, p.name, p.sku, p.image_url
		 FROM quotation_items qi
		 LEFT JOIN products p ON qi.product_id = p.id
		 WHERE qi.quotation_id = $1`, id)
	if err != nil {
		RespondError(w, 500, "Failed to fetch quotation items.")
		return
	}
	defer itemRows.Close()

	items := []models.QuotationItem{}
	for itemRows.Next() {
		var item models.QuotationItem
		var pID, pName, pSKU, pImg *string
		if err := itemRows.Scan(
			&item.ID, &item.QuotationID, &item.ProductID, &item.ProductName, &item.Quantity,
			&item.UnitPrice, &item.DiscountPercent, &item.LineTotal, &item.Notes,
			&pID, &pName, &pSKU, &pImg,
		); err != nil {
			continue
		}
		if pID != nil {
			item.Product = &models.ProductBrief{ID: pID, Name: pName, SKU: pSKU, ImageURL: pImg}
		}
		items = append(items, item)
	}

	// ScanJob
	var scanJob *models.ScanJobBrief
	var sjID, sjFileURL, sjStatus string
	if err := h.DB.QueryRow(ctx,
		`SELECT id, file_url, status FROM scan_jobs WHERE quotation_id = $1`, id).Scan(&sjID, &sjFileURL, &sjStatus); err == nil {
		scanJob = &models.ScanJobBrief{ID: sjID, FileURL: sjFileURL, Status: sjStatus}
	}

	quotation := map[string]interface{}{
		"id":              qID,
		"quotationNumber": qNum,
		"customerId":      customerID,
		"createdById":     createdByID,
		"status":          qStatus,
		"subtotal":        subtotal,
		"discountAmount":  discountAmt,
		"total":           total,
		"notes":           notes,
		"validUntil":      validUntil,
		"createdAt":       createdAt,
		"updatedAt":       updatedAt,
		"customer":        customer,
		"createdBy":       createdBy,
		"items":           items,
		"scanJob":         scanJob,
	}

	RespondJSON(w, 200, map[string]interface{}{"quotation": quotation})
}

// ─── Create Quotation ───────────────────────────────
func (h *Handler) CreateQuotation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := GetUser(r)

	var body struct {
		CustomerID     *string `json:"customerId"`
		Items          []struct {
			ProductID       *string `json:"productId"`
			ProductName     string  `json:"productName"`
			Quantity        int     `json:"quantity"`
			UnitPrice       float64 `json:"unitPrice"`
			DiscountPercent float64 `json:"discountPercent"`
			Notes           *string `json:"notes"`
		} `json:"items"`
		Notes          *string `json:"notes"`
		ValidUntil     *string `json:"validUntil"`
		DiscountAmount float64 `json:"discountAmount"`
	}

	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, 400, "Invalid request body.")
		return
	}

	if len(body.Items) == 0 {
		RespondError(w, 400, "At least one item is required.")
		return
	}

	quotationNumber, err := h.generateQuotationNumber(ctx)
	if err != nil {
		RespondError(w, 500, "Failed to generate quotation number.")
		return
	}

	// Calculate totals
	subtotal := 0.0
	type itemData struct {
		ID              string
		ProductID       *string
		ProductName     string
		Quantity        int
		UnitPrice       float64
		DiscountPercent float64
		LineTotal       float64
		Notes           *string
	}
	itemsData := make([]itemData, len(body.Items))
	for i, item := range body.Items {
		lineTotal := float64(item.Quantity) * item.UnitPrice * (1 - item.DiscountPercent/100)
		subtotal += lineTotal
		itemsData[i] = itemData{
			ID:              uuid.New().String(),
			ProductID:       item.ProductID,
			ProductName:     item.ProductName,
			Quantity:        item.Quantity,
			UnitPrice:       item.UnitPrice,
			DiscountPercent: item.DiscountPercent,
			LineTotal:       math.Round(lineTotal*100) / 100,
			Notes:           item.Notes,
		}
	}

	discount := body.DiscountAmount
	total := math.Round((subtotal-discount)*100) / 100

	// Resolve customer ID
	resolvedCustomerID := body.CustomerID
	if resolvedCustomerID == nil && user.Role == "CUSTOMER" {
		var custID string
		err := h.DB.QueryRow(ctx, `SELECT id FROM customers WHERE user_id = $1`, user.ID).Scan(&custID)
		if err != nil {
			// Create customer record
			custID = uuid.New().String()
			_, err = h.DB.Exec(ctx,
				`INSERT INTO customers (id, user_id, contact_person, email, phone)
				 VALUES ($1, $2, $3, $4, $5)`,
				custID, user.ID, user.Name, user.Email, user.Phone)
			if err != nil {
				RespondError(w, 500, "Failed to create customer record.")
				return
			}
		}
		resolvedCustomerID = &custID
	}

	// Parse validUntil
	var validUntil *time.Time
	if body.ValidUntil != nil && *body.ValidUntil != "" {
		t, err := time.Parse(time.RFC3339, *body.ValidUntil)
		if err != nil {
			t, err = time.Parse("2006-01-02", *body.ValidUntil)
		}
		if err == nil {
			validUntil = &t
		}
	}

	// Begin transaction
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		RespondError(w, 500, "Failed to start transaction.")
		return
	}
	defer tx.Rollback(ctx)

	qID := uuid.New().String()
	now := time.Now()
	_, err = tx.Exec(ctx,
		`INSERT INTO quotations (id, quotation_number, customer_id, created_by_id, status,
		                         subtotal, discount_amount, total, notes, valid_until, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, $7, $8, $9, $10, $10)`,
		qID, quotationNumber, resolvedCustomerID, user.ID,
		subtotal, discount, total, body.Notes, validUntil, now)
	if err != nil {
		RespondError(w, 500, "Failed to create quotation.")
		return
	}

	for _, item := range itemsData {
		_, err = tx.Exec(ctx,
			`INSERT INTO quotation_items (id, quotation_id, product_id, product_name, quantity,
			                              unit_price, discount_percent, line_total, notes)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			item.ID, qID, item.ProductID, item.ProductName, item.Quantity,
			item.UnitPrice, item.DiscountPercent, item.LineTotal, item.Notes)
		if err != nil {
			RespondError(w, 500, "Failed to create quotation item.")
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		RespondError(w, 500, "Failed to commit transaction.")
		return
	}

	// Fetch created quotation with relations
	quotation := h.fetchFullQuotation(ctx, qID)
	RespondJSON(w, 201, map[string]interface{}{"message": "Quotation created.", "quotation": quotation})
}

// ─── Update Quotation ───────────────────────────────
func (h *Handler) UpdateQuotation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	var body struct {
		CustomerID     *string `json:"customerId"`
		Items          []struct {
			ProductID       *string `json:"productId"`
			ProductName     string  `json:"productName"`
			Quantity        int     `json:"quantity"`
			UnitPrice       float64 `json:"unitPrice"`
			DiscountPercent float64 `json:"discountPercent"`
			Notes           *string `json:"notes"`
		} `json:"items"`
		Notes          *string `json:"notes"`
		ValidUntil     *string `json:"validUntil"`
		DiscountAmount *float64 `json:"discountAmount"`
		Status         *string `json:"status"`
	}

	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, 400, "Invalid request body.")
		return
	}

	// Check existing
	var existingStatus string
	var existingDiscount float64
	err := h.DB.QueryRow(ctx,
		`SELECT status, discount_amount FROM quotations WHERE id = $1`, id).Scan(&existingStatus, &existingDiscount)
	if err != nil {
		RespondError(w, 404, "Quotation not found.")
		return
	}

	if existingStatus != "DRAFT" && body.Status == nil {
		RespondError(w, 400, "Can only edit draft quotations.")
		return
	}

	// Build update
	setClauses := []string{"updated_at = NOW()"}
	args := []interface{}{}
	argIdx := 1

	if body.CustomerID != nil {
		setClauses = append(setClauses, fmt.Sprintf("customer_id = $%d", argIdx))
		args = append(args, *body.CustomerID)
		argIdx++
	}
	if body.Notes != nil {
		setClauses = append(setClauses, fmt.Sprintf("notes = $%d", argIdx))
		args = append(args, *body.Notes)
		argIdx++
	}
	if body.ValidUntil != nil && *body.ValidUntil != "" {
		t, err := time.Parse(time.RFC3339, *body.ValidUntil)
		if err != nil {
			t, _ = time.Parse("2006-01-02", *body.ValidUntil)
		}
		setClauses = append(setClauses, fmt.Sprintf("valid_until = $%d", argIdx))
		args = append(args, t)
		argIdx++
	}
	if body.Status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *body.Status)
		argIdx++
	}

	// Recalculate if items provided
	if len(body.Items) > 0 {
		// Delete existing items
		_, _ = h.DB.Exec(ctx, `DELETE FROM quotation_items WHERE quotation_id = $1`, id)

		subtotal := 0.0
		for _, item := range body.Items {
			lineTotal := float64(item.Quantity) * item.UnitPrice * (1 - item.DiscountPercent/100)
			subtotal += lineTotal
			itemID := uuid.New().String()
			roundedLineTotal := math.Round(lineTotal*100) / 100
			_, err := h.DB.Exec(ctx,
				`INSERT INTO quotation_items (id, quotation_id, product_id, product_name, quantity,
				                              unit_price, discount_percent, line_total, notes)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
				itemID, id, item.ProductID, item.ProductName, item.Quantity,
				item.UnitPrice, item.DiscountPercent, roundedLineTotal, item.Notes)
			if err != nil {
				RespondError(w, 500, "Failed to update quotation items.")
				return
			}
		}

		disc := existingDiscount
		if body.DiscountAmount != nil {
			disc = *body.DiscountAmount
		}
		total := math.Round((subtotal-disc)*100) / 100

		setClauses = append(setClauses, fmt.Sprintf("subtotal = $%d", argIdx))
		args = append(args, subtotal)
		argIdx++
		setClauses = append(setClauses, fmt.Sprintf("discount_amount = $%d", argIdx))
		args = append(args, disc)
		argIdx++
		setClauses = append(setClauses, fmt.Sprintf("total = $%d", argIdx))
		args = append(args, total)
		argIdx++
	}

	// Execute update
	updateQuery := fmt.Sprintf(`UPDATE quotations SET %s WHERE id = $%d`,
		strings.Join(setClauses, ", "), argIdx)
	args = append(args, id)
	_, err = h.DB.Exec(ctx, updateQuery, args...)
	if err != nil {
		RespondError(w, 500, "Failed to update quotation.")
		return
	}

	quotation := h.fetchFullQuotation(ctx, id)
	RespondJSON(w, 200, map[string]interface{}{"message": "Quotation updated.", "quotation": quotation})
}

// ─── Convert Quotation to Order ─────────────────────
func (h *Handler) ConvertQuotationToOrder(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	var body struct {
		Notes *string `json:"notes"`
	}
	_ = DecodeJSON(r, &body)

	// Fetch quotation with customer
	var (
		qID, qStatus   string
		qCustomerID    *string
		qTotal         float64
	)
	err := h.DB.QueryRow(ctx,
		`SELECT id, status, customer_id, total FROM quotations WHERE id = $1`, id).Scan(
		&qID, &qStatus, &qCustomerID, &qTotal)
	if err != nil {
		RespondError(w, 404, "Quotation not found.")
		return
	}

	if qStatus != "ACCEPTED" {
		RespondError(w, 400, "Only accepted quotations can be converted to orders.")
		return
	}
	if qCustomerID == nil {
		RespondError(w, 400, "Quotation must have a customer to create an order.")
		return
	}

	// Generate order number
	today := time.Now().Format("20060102")
	var orderCount int
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM orders`).Scan(&orderCount)
	orderNumber := fmt.Sprintf("ORD-%s-%03d", today, orderCount+1)

	orderID := uuid.New().String()
	now := time.Now()
	_, err = h.DB.Exec(ctx,
		`INSERT INTO orders (id, order_number, quotation_id, customer_id, total, notes, status, subtotal, discount, shipping_fee, payment_method, order_type, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', 0, 0, 0, 'COD', 'B2B', $7, $7)`,
		orderID, orderNumber, qID, *qCustomerID, qTotal, body.Notes, now)
	if err != nil {
		RespondError(w, 500, "Failed to create order.")
		return
	}

	// Update quotation status
	_, _ = h.DB.Exec(ctx, `UPDATE quotations SET status = 'ACCEPTED' WHERE id = $1`, id)

	// Fetch order with relations
	order := h.fetchOrderWithRelations(ctx, orderID)
	RespondJSON(w, 201, map[string]interface{}{"message": "Order created from quotation.", "order": order})
}

// ─── Download Quotation PDF ─────────────────────────
func (h *Handler) DownloadQuotationPDF(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	// Fetch quotation with all needed data
	quotation := h.fetchFullQuotation(ctx, id)
	if quotation == nil {
		RespondError(w, 404, "Quotation not found.")
		return
	}

	pdfBuffer, err := services.GenerateQuotationPDF(quotation)
	if err != nil {
		RespondError(w, 500, "Failed to generate PDF.")
		return
	}

	qNum := ""
	if v, ok := quotation["quotationNumber"].(string); ok {
		qNum = v
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.pdf"`, qNum))
	w.Header().Set("Content-Length", strconv.Itoa(len(pdfBuffer)))
	w.Write(pdfBuffer)
}

// ─── Delete Quotation ───────────────────────────────
func (h *Handler) DeleteQuotation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	_, err := h.DB.Exec(ctx, `DELETE FROM quotations WHERE id = $1`, id)
	if err != nil {
		RespondError(w, 500, "Failed to delete quotation.")
		return
	}

	RespondJSON(w, 200, map[string]string{"message": "Quotation deleted."})
}

// ─── Helper: fetch full quotation ───────────────────
func (h *Handler) fetchFullQuotation(ctx context.Context, id string) map[string]interface{} {
	var (
		qID, qNum, createdByID, status string
		customerID                      *string
		subtotal, discountAmt, total    float64
		notes                           *string
		validUntil                      *time.Time
		createdAt, updatedAt            *time.Time
	)
	err := h.DB.QueryRow(ctx,
		`SELECT id, quotation_number, customer_id, created_by_id, status,
		        subtotal, discount_amount, total, notes, valid_until,
		        created_at, updated_at
		 FROM quotations WHERE id = $1`, id).Scan(
		&qID, &qNum, &customerID, &createdByID, &status,
		&subtotal, &discountAmt, &total, &notes, &validUntil,
		&createdAt, &updatedAt,
	)
	if err != nil {
		return nil
	}

	quotation := map[string]interface{}{
		"id":              qID,
		"quotationNumber": qNum,
		"customerId":      customerID,
		"createdById":     createdByID,
		"status":          status,
		"subtotal":        subtotal,
		"discountAmount":  discountAmt,
		"total":           total,
		"notes":           notes,
		"validUntil":      validUntil,
		"createdAt":       createdAt,
		"updatedAt":       updatedAt,
	}

	// Customer
	if customerID != nil {
		var c models.Customer
		err := h.DB.QueryRow(ctx,
			`SELECT id, user_id, company_name, contact_person, phone, email, address, notes, created_at, updated_at
			 FROM customers WHERE id = $1`, *customerID).Scan(
			&c.ID, &c.UserID, &c.CompanyName, &c.ContactPerson, &c.Phone, &c.Email, &c.Address, &c.Notes, &c.CreatedAt, &c.UpdatedAt,
		)
		if err == nil {
			quotation["customer"] = c
		} else {
			quotation["customer"] = nil
		}
	} else {
		quotation["customer"] = nil
	}

	// CreatedBy
	var cName string
	if err := h.DB.QueryRow(ctx, `SELECT name FROM users WHERE id = $1`, createdByID).Scan(&cName); err == nil {
		quotation["createdBy"] = map[string]string{"name": cName}
	} else {
		quotation["createdBy"] = nil
	}

	// Items with products
	itemRows, err := h.DB.Query(ctx,
		`SELECT qi.id, qi.quotation_id, qi.product_id, qi.product_name, qi.quantity,
		        qi.unit_price, qi.discount_percent, qi.line_total, qi.notes,
		        p.id, p.name, p.sku, p.image_url
		 FROM quotation_items qi
		 LEFT JOIN products p ON qi.product_id = p.id
		 WHERE qi.quotation_id = $1`, id)
	if err == nil {
		defer itemRows.Close()
		items := []models.QuotationItem{}
		for itemRows.Next() {
			var item models.QuotationItem
			var pID, pName, pSKU, pImg *string
			if err := itemRows.Scan(
				&item.ID, &item.QuotationID, &item.ProductID, &item.ProductName, &item.Quantity,
				&item.UnitPrice, &item.DiscountPercent, &item.LineTotal, &item.Notes,
				&pID, &pName, &pSKU, &pImg,
			); err != nil {
				continue
			}
			if pID != nil {
				item.Product = &models.ProductBrief{ID: pID, Name: pName, SKU: pSKU, ImageURL: pImg}
			}
			items = append(items, item)
		}
		quotation["items"] = items
	}

	return quotation
}

// ─── Helper: fetch order with relations ─────────────
func (h *Handler) fetchOrderWithRelations(ctx context.Context, orderID string) map[string]interface{} {
	var (
		oID, oNum, oCustomerID, oPaymentMethod, oOrderType, oStatus string
		oQuotationID                                                 *string
		oShippingAddr, oShippingCity, oShippingPhone, oPromoCode     *string
		oSubtotal, oDiscount, oShippingFee, oTotal                   float64
		oNotes                                                       *string
		oCreatedAt, oUpdatedAt                                       *time.Time
	)
	err := h.DB.QueryRow(ctx,
		`SELECT id, order_number, quotation_id, customer_id, shipping_address, shipping_city,
		        shipping_phone, promo_code, subtotal, discount, shipping_fee, payment_method,
		        order_type, status, total, notes, created_at, updated_at
		 FROM orders WHERE id = $1`, orderID).Scan(
		&oID, &oNum, &oQuotationID, &oCustomerID, &oShippingAddr, &oShippingCity,
		&oShippingPhone, &oPromoCode, &oSubtotal, &oDiscount, &oShippingFee, &oPaymentMethod,
		&oOrderType, &oStatus, &oTotal, &oNotes, &oCreatedAt, &oUpdatedAt,
	)
	if err != nil {
		return nil
	}

	order := map[string]interface{}{
		"id":              oID,
		"orderNumber":     oNum,
		"quotationId":     oQuotationID,
		"customerId":      oCustomerID,
		"shippingAddress": oShippingAddr,
		"shippingCity":    oShippingCity,
		"shippingPhone":   oShippingPhone,
		"promoCode":       oPromoCode,
		"subtotal":        oSubtotal,
		"discount":        oDiscount,
		"shippingFee":     oShippingFee,
		"paymentMethod":   oPaymentMethod,
		"orderType":       oOrderType,
		"status":          oStatus,
		"total":           oTotal,
		"notes":           oNotes,
		"createdAt":       oCreatedAt,
		"updatedAt":       oUpdatedAt,
	}

	// Customer
	var cust models.Customer
	if err := h.DB.QueryRow(ctx,
		`SELECT id, user_id, company_name, contact_person, phone, email, address, notes, created_at, updated_at
		 FROM customers WHERE id = $1`, oCustomerID).Scan(
		&cust.ID, &cust.UserID, &cust.CompanyName, &cust.ContactPerson, &cust.Phone, &cust.Email, &cust.Address, &cust.Notes, &cust.CreatedAt, &cust.UpdatedAt,
	); err == nil {
		order["customer"] = cust
	}

	// Quotation with items (if from conversion)
	if oQuotationID != nil {
		qData := h.fetchFullQuotation(ctx, *oQuotationID)
		order["quotation"] = qData
	}

	return order
}

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
	"stationery-hub-backend/internal/models"
)

// ─── List Customers ─────────────────────────────────

func (h *Handler) ListCustomers(w http.ResponseWriter, r *http.Request) {
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

	// Build dynamic query
	conditions := []string{}
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		conditions = append(conditions, fmt.Sprintf(
			`(c.contact_person ILIKE $%d OR c.company_name ILIKE $%d OR c.email ILIKE $%d OR c.phone ILIKE $%d)`,
			argIdx, argIdx, argIdx, argIdx,
		))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	ctx := r.Context()

	// Count total
	var total int
	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM customers c %s`, whereClause)
	if err := h.DB.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		RespondError(w, 500, "Failed to count customers.")
		return
	}

	// Query customers with counts
	query := fmt.Sprintf(`
		SELECT c.id, c.user_id, c.company_name, c.contact_person, c.phone, c.email, c.address, c.notes, c.created_at, c.updated_at,
			(SELECT COUNT(*) FROM quotations q WHERE q.customer_id = c.id) AS quotation_count,
			(SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count
		FROM customers c
		%s
		ORDER BY c.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		RespondError(w, 500, "Failed to fetch customers.")
		return
	}
	defer rows.Close()

	customers := []map[string]interface{}{}
	for rows.Next() {
		var c models.Customer
		var quotationCount, orderCount int
		if err := rows.Scan(
			&c.ID, &c.UserID, &c.CompanyName, &c.ContactPerson, &c.Phone, &c.Email, &c.Address, &c.Notes, &c.CreatedAt, &c.UpdatedAt,
			&quotationCount, &orderCount,
		); err != nil {
			RespondError(w, 500, "Failed to scan customer.")
			return
		}
		customers = append(customers, map[string]interface{}{
			"id":            c.ID,
			"userId":        c.UserID,
			"companyName":   c.CompanyName,
			"contactPerson": c.ContactPerson,
			"phone":         c.Phone,
			"email":         c.Email,
			"address":       c.Address,
			"notes":         c.Notes,
			"createdAt":     c.CreatedAt,
			"updatedAt":     c.UpdatedAt,
			"_count": map[string]int{
				"quotations": quotationCount,
				"orders":     orderCount,
			},
		})
	}

	pages := int(math.Ceil(float64(total) / float64(limit)))

	RespondJSON(w, 200, map[string]interface{}{
		"customers": customers,
		"pagination": models.Pagination{
			Page:  page,
			Limit: limit,
			Total: total,
			Pages: pages,
		},
	})
}

// ─── Get Customer by ID ─────────────────────────────

func (h *Handler) GetCustomer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ctx := r.Context()

	// Get customer
	var c models.Customer
	err := h.DB.QueryRow(ctx,
		`SELECT id, user_id, company_name, contact_person, phone, email, address, notes, created_at, updated_at FROM customers WHERE id = $1`,
		id,
	).Scan(&c.ID, &c.UserID, &c.CompanyName, &c.ContactPerson, &c.Phone, &c.Email, &c.Address, &c.Notes, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		RespondError(w, 404, "Customer not found.")
		return
	}

	// Get user info if linked
	if c.UserID != nil {
		var user models.UserBrief
		err := h.DB.QueryRow(ctx, `SELECT name, email FROM users WHERE id = $1`, *c.UserID).Scan(&user.Name, &user.Email)
		if err == nil {
			c.User = &user
		}
	}

	// Get recent quotations (last 10)
	qRows, err := h.DB.Query(ctx, `
		SELECT q.id, q.quotation_number, q.status, q.total, q.created_at, u.name as created_by_name
		FROM quotations q
		LEFT JOIN users u ON u.id = q.created_by_id
		WHERE q.customer_id = $1
		ORDER BY q.created_at DESC LIMIT 10
	`, id)
	if err == nil {
		defer qRows.Close()
		quotations := []map[string]interface{}{}
		for qRows.Next() {
			var qID, qNumber, qStatus string
			var qTotal float64
			var qCreatedAt time.Time
			var createdByName *string
			if err := qRows.Scan(&qID, &qNumber, &qStatus, &qTotal, &qCreatedAt, &createdByName); err == nil {
				q := map[string]interface{}{
					"id":              qID,
					"quotationNumber": qNumber,
					"status":          qStatus,
					"total":           qTotal,
					"createdAt":       qCreatedAt,
				}
				if createdByName != nil {
					q["createdBy"] = map[string]interface{}{"name": *createdByName}
				}
				quotations = append(quotations, q)
			}
		}
		c.Quotations = nil // clear the typed field
		// Build response manually
		resp := map[string]interface{}{
			"id":            c.ID,
			"userId":        c.UserID,
			"companyName":   c.CompanyName,
			"contactPerson": c.ContactPerson,
			"phone":         c.Phone,
			"email":         c.Email,
			"address":       c.Address,
			"notes":         c.Notes,
			"createdAt":     c.CreatedAt,
			"updatedAt":     c.UpdatedAt,
			"user":          c.User,
			"quotations":    quotations,
		}

		// Get recent orders (last 10)
		oRows, err := h.DB.Query(ctx, `
			SELECT id, order_number, status, total, order_type, created_at
			FROM orders WHERE customer_id = $1
			ORDER BY created_at DESC LIMIT 10
		`, id)
		if err == nil {
			defer oRows.Close()
			orders := []map[string]interface{}{}
			for oRows.Next() {
				var oID, oNumber, oStatus, oType string
				var oTotal float64
				var oCreatedAt time.Time
				if err := oRows.Scan(&oID, &oNumber, &oStatus, &oTotal, &oType, &oCreatedAt); err == nil {
					orders = append(orders, map[string]interface{}{
						"id":          oID,
						"orderNumber": oNumber,
						"status":      oStatus,
						"total":       oTotal,
						"orderType":   oType,
						"createdAt":   oCreatedAt,
					})
				}
			}
			resp["orders"] = orders
		}

		RespondJSON(w, 200, map[string]interface{}{"customer": resp})
		return
	}

	RespondJSON(w, 200, map[string]interface{}{"customer": c})
}

// ─── Create Customer ────────────────────────────────

func (h *Handler) CreateCustomer(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CompanyName   *string `json:"companyName"`
		ContactPerson string  `json:"contactPerson"`
		Phone         *string `json:"phone"`
		Email         *string `json:"email"`
		Address       *string `json:"address"`
		Notes         *string `json:"notes"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, 400, "Invalid request body.")
		return
	}

	if body.ContactPerson == "" {
		RespondError(w, 400, "Contact person name is required.")
		return
	}

	id := uuid.New().String()
	now := time.Now()

	_, err := h.DB.Exec(r.Context(),
		`INSERT INTO customers (id, company_name, contact_person, phone, email, address, notes, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
		id, body.CompanyName, body.ContactPerson, body.Phone, body.Email, body.Address, body.Notes, now,
	)
	if err != nil {
		RespondError(w, 500, "Failed to create customer.")
		return
	}

	customer := models.Customer{
		ID:            id,
		CompanyName:   body.CompanyName,
		ContactPerson: body.ContactPerson,
		Phone:         body.Phone,
		Email:         body.Email,
		Address:       body.Address,
		Notes:         body.Notes,
		CreatedAt:     &now,
		UpdatedAt:     &now,
	}

	RespondJSON(w, 201, map[string]interface{}{
		"message":  "Customer created.",
		"customer": customer,
	})
}

// ─── Update Customer ────────────────────────────────

func (h *Handler) UpdateCustomer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var body struct {
		CompanyName   *string `json:"companyName"`
		ContactPerson *string `json:"contactPerson"`
		Phone         *string `json:"phone"`
		Email         *string `json:"email"`
		Address       *string `json:"address"`
		Notes         *string `json:"notes"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, 400, "Invalid request body.")
		return
	}

	now := time.Now()
	_, err := h.DB.Exec(r.Context(),
		`UPDATE customers SET
			company_name = COALESCE($1, company_name),
			contact_person = COALESCE($2, contact_person),
			phone = COALESCE($3, phone),
			email = COALESCE($4, email),
			address = COALESCE($5, address),
			notes = COALESCE($6, notes),
			updated_at = $7
		 WHERE id = $8`,
		body.CompanyName, body.ContactPerson, body.Phone, body.Email, body.Address, body.Notes, now, id,
	)
	if err != nil {
		RespondError(w, 500, "Failed to update customer.")
		return
	}

	// Fetch updated customer
	var c models.Customer
	err = h.DB.QueryRow(r.Context(),
		`SELECT id, user_id, company_name, contact_person, phone, email, address, notes, created_at, updated_at FROM customers WHERE id = $1`, id,
	).Scan(&c.ID, &c.UserID, &c.CompanyName, &c.ContactPerson, &c.Phone, &c.Email, &c.Address, &c.Notes, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		RespondError(w, 404, "Customer not found.")
		return
	}

	RespondJSON(w, 200, map[string]interface{}{
		"message":  "Customer updated.",
		"customer": c,
	})
}

// ─── Delete Customer ────────────────────────────────

func (h *Handler) DeleteCustomer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ctx := r.Context()

	// Check for orders
	var orderCount int
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM orders WHERE customer_id = $1`, id).Scan(&orderCount)
	if orderCount > 0 {
		RespondError(w, 400, fmt.Sprintf("Cannot delete customer with %d order(s). Archive instead.", orderCount))
		return
	}

	_, err := h.DB.Exec(ctx, `DELETE FROM customers WHERE id = $1`, id)
	if err != nil {
		RespondError(w, 500, "Failed to delete customer.")
		return
	}

	RespondJSON(w, 200, map[string]interface{}{"message": "Customer deleted."})
}

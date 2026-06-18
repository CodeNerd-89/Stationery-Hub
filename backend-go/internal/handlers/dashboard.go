package handlers

import (
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

// ─── Dashboard Stats ────────────────────────────────

func (h *Handler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var productCount, categoryCount, customerCount, quotationCount, orderCount, userCount, pendingOrderCount int
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM products WHERE is_active = true`).Scan(&productCount)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM categories`).Scan(&categoryCount)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM customers`).Scan(&customerCount)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM quotations`).Scan(&quotationCount)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM orders`).Scan(&orderCount)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&userCount)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM orders WHERE status = 'PENDING'`).Scan(&pendingOrderCount)

	// Revenue from completed orders
	var revenue *float64
	h.DB.QueryRow(ctx, `SELECT SUM(total) FROM orders WHERE status = 'COMPLETED'`).Scan(&revenue)
	revenueVal := 0.0
	if revenue != nil {
		revenueVal = *revenue
	}

	// Order status breakdown
	orderStatusRows, _ := h.DB.Query(ctx, `SELECT status, COUNT(*) FROM orders GROUP BY status`)
	ordersByStatus := map[string]int{}
	if orderStatusRows != nil {
		for orderStatusRows.Next() {
			var status string
			var cnt int
			if orderStatusRows.Scan(&status, &cnt) == nil {
				ordersByStatus[status] = cnt
			}
		}
		orderStatusRows.Close()
	}

	// Quotation status breakdown
	quotStatusRows, _ := h.DB.Query(ctx, `SELECT status, COUNT(*) FROM quotations GROUP BY status`)
	quotsByStatus := map[string]int{}
	if quotStatusRows != nil {
		for quotStatusRows.Next() {
			var status string
			var cnt int
			if quotStatusRows.Scan(&status, &cnt) == nil {
				quotsByStatus[status] = cnt
			}
		}
		quotStatusRows.Close()
	}

	// Low stock products (stock < 10)
	lowStockRows, _ := h.DB.Query(ctx, `SELECT id, name, sku, stock, unit FROM products WHERE stock < 10 AND is_active = true ORDER BY stock ASC LIMIT 10`)
	lowStock := []map[string]interface{}{}
	if lowStockRows != nil {
		for lowStockRows.Next() {
			var id, name, sku, unit string
			var stock int
			if lowStockRows.Scan(&id, &name, &sku, &stock, &unit) == nil {
				lowStock = append(lowStock, map[string]interface{}{"id": id, "name": name, "sku": sku, "stock": stock, "unit": unit})
			}
		}
		lowStockRows.Close()
	}

	// Recent quotations
	recentQRows, _ := h.DB.Query(ctx, `
		SELECT q.id, q.quotation_number, q.status, q.total, q.created_at, c.contact_person
		FROM quotations q LEFT JOIN customers c ON c.id = q.customer_id
		ORDER BY q.created_at DESC LIMIT 5`)
	recentQuotations := []map[string]interface{}{}
	if recentQRows != nil {
		for recentQRows.Next() {
			var id, qn, status string
			var total float64
			var createdAt time.Time
			var cPerson *string
			if recentQRows.Scan(&id, &qn, &status, &total, &createdAt, &cPerson) == nil {
				recentQuotations = append(recentQuotations, map[string]interface{}{
					"id": id, "quotationNumber": qn, "status": status, "total": total, "createdAt": createdAt,
					"customer": map[string]interface{}{"contactPerson": cPerson},
				})
			}
		}
		recentQRows.Close()
	}

	// Recent orders
	recentORows, _ := h.DB.Query(ctx, `
		SELECT o.id, o.order_number, o.status, o.total, o.created_at, c.contact_person
		FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
		ORDER BY o.created_at DESC LIMIT 5`)
	recentOrders := []map[string]interface{}{}
	if recentORows != nil {
		for recentORows.Next() {
			var id, on, status string
			var total float64
			var createdAt time.Time
			var cPerson *string
			if recentORows.Scan(&id, &on, &status, &total, &createdAt, &cPerson) == nil {
				recentOrders = append(recentOrders, map[string]interface{}{
					"id": id, "orderNumber": on, "status": status, "total": total, "createdAt": createdAt,
					"customer": map[string]interface{}{"contactPerson": cPerson},
				})
			}
		}
		recentORows.Close()
	}

	RespondJSON(w, 200, map[string]interface{}{
		"stats": map[string]interface{}{
			"activeProducts": productCount, "categories": categoryCount, "totalCustomers": customerCount,
			"totalQuotations": quotationCount, "totalOrders": orderCount, "pendingOrders": pendingOrderCount,
			"users": userCount, "totalUsers": userCount, "revenue": revenueVal,
		},
		"ordersByStatus":   ordersByStatus,
		"quotationsByStatus": quotsByStatus,
		"lowStockProducts": lowStock,
		"recentQuotations": recentQuotations,
		"recentOrders":     recentOrders,
	})
}

// ─── List Users ─────────────────────────────────────

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	role := r.URL.Query().Get("role")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 { page = 1 }
	if limit < 1 { limit = 20 }
	offset := (page - 1) * limit

	conditions := []string{}
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		conditions = append(conditions, fmt.Sprintf(`(name ILIKE $%d OR email ILIKE $%d)`, argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if role != "" {
		conditions = append(conditions, fmt.Sprintf(`role = $%d`, argIdx))
		args = append(args, role)
		argIdx++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	ctx := r.Context()
	var total int
	h.DB.QueryRow(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM users %s`, whereClause), args...).Scan(&total)

	query := fmt.Sprintf(`SELECT id, email, name, role, email_verified, phone, created_at FROM users %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		RespondError(w, 500, "Failed to fetch users.")
		return
	}
	defer rows.Close()

	users := []map[string]interface{}{}
	for rows.Next() {
		var id, email, name, role string
		var emailVerified bool
		var phone *string
		var createdAt time.Time
		if rows.Scan(&id, &email, &name, &role, &emailVerified, &phone, &createdAt) == nil {
			users = append(users, map[string]interface{}{
				"id": id, "email": email, "name": name, "role": role,
				"emailVerified": emailVerified, "phone": phone, "createdAt": createdAt,
			})
		}
	}

	pages := int(math.Ceil(float64(total) / float64(limit)))
	RespondJSON(w, 200, map[string]interface{}{
		"users":      users,
		"pagination": map[string]interface{}{"page": page, "limit": limit, "total": total, "pages": pages},
	})
}

// ─── Update User Role ───────────────────────────────

func (h *Handler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := GetUser(r)

	if id == user.ID {
		RespondError(w, 400, "Cannot change your own role.")
		return
	}

	var body struct {
		Role string `json:"role"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, 400, "Invalid request body.")
		return
	}

	validRoles := map[string]bool{"ADMIN": true, "STAFF": true, "CUSTOMER": true}
	if !validRoles[body.Role] {
		RespondError(w, 400, "Invalid role. Must be ADMIN, STAFF, or CUSTOMER.")
		return
	}

	_, err := h.DB.Exec(r.Context(), `UPDATE users SET role = $1, updated_at = $2 WHERE id = $3`, body.Role, time.Now(), id)
	if err != nil {
		RespondError(w, 500, "Failed to update user role.")
		return
	}

	RespondJSON(w, 200, map[string]interface{}{"message": fmt.Sprintf("User role updated to %s.", body.Role)})
}

// ─── Delete User ────────────────────────────────────

func (h *Handler) DeleteDashboardUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := GetUser(r)

	if id == user.ID {
		RespondError(w, 400, "Cannot delete your own account.")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		RespondError(w, 500, "Failed to delete user.")
		return
	}

	RespondJSON(w, 200, map[string]interface{}{"message": "User deleted."})
}

// ─── Analytics ──────────────────────────────────────

func (h *Handler) GetAnalytics(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Daily quotations for last 7 days
	dailyQuotations := []map[string]interface{}{}
	for i := 6; i >= 0; i-- {
		date := time.Now().AddDate(0, 0, -i)
		dayStart := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
		dayEnd := dayStart.AddDate(0, 0, 1)
		var count int
		h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM quotations WHERE created_at >= $1 AND created_at < $2`, dayStart, dayEnd).Scan(&count)
		dailyQuotations = append(dailyQuotations, map[string]interface{}{
			"date":  dayStart.Format("Mon, Jan 2"),
			"count": count,
		})
	}

	// Daily orders for last 7 days
	dailyOrders := []map[string]interface{}{}
	for i := 6; i >= 0; i-- {
		date := time.Now().AddDate(0, 0, -i)
		dayStart := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
		dayEnd := dayStart.AddDate(0, 0, 1)
		var count int
		h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM orders WHERE created_at >= $1 AND created_at < $2`, dayStart, dayEnd).Scan(&count)
		dailyOrders = append(dailyOrders, map[string]interface{}{
			"date":  dayStart.Format("Mon, Jan 2"),
			"count": count,
		})
	}

	// Daily new users for last 7 days
	dailyUsers := []map[string]interface{}{}
	for i := 6; i >= 0; i-- {
		date := time.Now().AddDate(0, 0, -i)
		dayStart := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
		dayEnd := dayStart.AddDate(0, 0, 1)
		var count int
		h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE created_at >= $1 AND created_at < $2`, dayStart, dayEnd).Scan(&count)
		dailyUsers = append(dailyUsers, map[string]interface{}{
			"date":  dayStart.Format("Mon, Jan 2"),
			"count": count,
		})
	}

	// New users this week
	weekStart := time.Now().AddDate(0, 0, -7)
	var newUsersWeek int
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE created_at >= $1`, weekStart).Scan(&newUsersWeek)

	// Top products by quotation demand
	topProducts := []map[string]interface{}{}
	topRows, _ := h.DB.Query(ctx, `
		SELECT qi.product_name, SUM(qi.quantity) AS total_qty, COUNT(DISTINCT qi.quotation_id) AS quot_count
		FROM quotation_items qi
		GROUP BY qi.product_name ORDER BY total_qty DESC LIMIT 10`)
	if topRows != nil {
		for topRows.Next() {
			var name string
			var totalQty, quotCount int
			if topRows.Scan(&name, &totalQty, &quotCount) == nil {
				topProducts = append(topProducts, map[string]interface{}{
					"name":         name,
					"totalQty":     totalQty,
					"timesOrdered": quotCount,
				})
			}
		}
		topRows.Close()
	}

	// Category distribution
	categories := []map[string]interface{}{}
	catRows, _ := h.DB.Query(ctx, `
		SELECT c.name, COUNT(p.id) AS product_count
		FROM categories c LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
		GROUP BY c.id, c.name ORDER BY product_count DESC`)
	if catRows != nil {
		for catRows.Next() {
			var name string
			var count int
			if catRows.Scan(&name, &count) == nil {
				categories = append(categories, map[string]interface{}{"name": name, "count": count})
			}
		}
		catRows.Close()
	}

	// Conversion rate (quotations converted to orders)
	var totalQuotations, convertedQuotations int
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM quotations`).Scan(&totalQuotations)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM quotations WHERE status = 'CONVERTED'`).Scan(&convertedQuotations)
	conversionRate := 0.0
	if totalQuotations > 0 {
		conversionRate = math.Round(float64(convertedQuotations)/float64(totalQuotations)*10000) / 100
	}

	// Recent activity: combine recent quotations and recent user registrations
	recentActivity := []map[string]interface{}{}

	// Recent quotations for activity feed
	actQRows, _ := h.DB.Query(ctx, `
		SELECT q.quotation_number, q.status, q.created_at, c.contact_person
		FROM quotations q LEFT JOIN customers c ON c.id = q.customer_id
		ORDER BY q.created_at DESC LIMIT 5`)
	if actQRows != nil {
		for actQRows.Next() {
			var qn, status string
			var createdAt time.Time
			var cPerson *string
			if actQRows.Scan(&qn, &status, &createdAt, &cPerson) == nil {
				customerName := "Unknown"
				if cPerson != nil {
					customerName = *cPerson
				}
				recentActivity = append(recentActivity, map[string]interface{}{
					"type":   "quotation",
					"text":   fmt.Sprintf("Quotation %s", qn),
					"detail": fmt.Sprintf("Customer: %s", customerName),
					"status": status,
					"time":   createdAt,
				})
			}
		}
		actQRows.Close()
	}

	// Recent user registrations for activity feed
	actURows, _ := h.DB.Query(ctx, `
		SELECT name, role, created_at FROM users ORDER BY created_at DESC LIMIT 5`)
	if actURows != nil {
		for actURows.Next() {
			var name, role string
			var createdAt time.Time
			if actURows.Scan(&name, &role, &createdAt) == nil {
				recentActivity = append(recentActivity, map[string]interface{}{
					"type":   "user",
					"text":   fmt.Sprintf("New user: %s", name),
					"detail": fmt.Sprintf("Role: %s", role),
					"status": role,
					"time":   createdAt,
				})
			}
		}
		actURows.Close()
	}

	// Sort recentActivity by time descending
	for i := 0; i < len(recentActivity); i++ {
		for j := i + 1; j < len(recentActivity); j++ {
			ti := recentActivity[i]["time"].(time.Time)
			tj := recentActivity[j]["time"].(time.Time)
			if tj.After(ti) {
				recentActivity[i], recentActivity[j] = recentActivity[j], recentActivity[i]
			}
		}
	}
	// Limit to 10 items
	if len(recentActivity) > 10 {
		recentActivity = recentActivity[:10]
	}

	RespondJSON(w, 200, map[string]interface{}{
		"dailyQuotations":  dailyQuotations,
		"dailyOrders":      dailyOrders,
		"dailyUsers":       dailyUsers,
		"topProducts":      topProducts,
		"categories":       categories,
		"conversionRate":   conversionRate,
		"recentActivity":   recentActivity,
		"newUsersWeek":     newUsersWeek,
	})
}

// ─── Delete Top Product ─────────────────────────────

func (h *Handler) DeleteTopProduct(w http.ResponseWriter, r *http.Request) {
	// This endpoint was for deleting analytics entries — it's a no-op in practice
	// since analytics are computed dynamically. Just return success.
	RespondJSON(w, 200, map[string]interface{}{"message": "Analytics data cleared."})
}

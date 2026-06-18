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

// productWithCategory scans a product row that includes category brief (id, name, slug).
func scanProductWithCategory(scan func(dest ...interface{}) error) (models.Product, error) {
	var p models.Product
	var catID, catName string
	var catSlug *string
	err := scan(
		&p.ID, &p.Name, &p.Slug, &p.SKU, &p.CategoryID, &p.Description,
		&p.Price, &p.Stock, &p.Unit, &p.ImageURL, &p.IsActive,
		&p.AverageRating, &p.ReviewCount, &p.CreatedAt, &p.UpdatedAt,
		&catID, &catName, &catSlug,
	)
	if err != nil {
		return p, err
	}
	p.Category = &models.CategoryBrief{ID: catID, Name: catName, Slug: catSlug}
	return p, nil
}

// scanProductWithCategoryBrief scans a product row with category brief (id, name) — no slug.
func scanProductWithCategoryBrief(scan func(dest ...interface{}) error) (models.Product, error) {
	var p models.Product
	var catID, catName string
	err := scan(
		&p.ID, &p.Name, &p.Slug, &p.SKU, &p.CategoryID, &p.Description,
		&p.Price, &p.Stock, &p.Unit, &p.ImageURL, &p.IsActive,
		&p.AverageRating, &p.ReviewCount, &p.CreatedAt, &p.UpdatedAt,
		&catID, &catName,
	)
	if err != nil {
		return p, err
	}
	p.Category = &models.CategoryBrief{ID: catID, Name: catName}
	return p, nil
}

// scanProductFull scans a product with full category (all fields).
func scanProductFull(scan func(dest ...interface{}) error) (models.Product, error) {
	var p models.Product
	var cat models.CategoryBrief
	var catSlug *string
	err := scan(
		&p.ID, &p.Name, &p.Slug, &p.SKU, &p.CategoryID, &p.Description,
		&p.Price, &p.Stock, &p.Unit, &p.ImageURL, &p.IsActive,
		&p.AverageRating, &p.ReviewCount, &p.CreatedAt, &p.UpdatedAt,
		&cat.ID, &cat.Name, &catSlug,
	)
	if err != nil {
		return p, err
	}
	cat.Slug = catSlug
	p.Category = &cat
	return p, nil
}

// ListProducts returns active products with search, filter, sort, and pagination.
func (h *Handler) ListProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	search := q.Get("search")
	category := q.Get("category")
	minPriceStr := q.Get("minPrice")
	maxPriceStr := q.Get("maxPrice")
	sortBy := q.Get("sortBy")
	order := q.Get("order")
	pageStr := q.Get("page")
	limitStr := q.Get("limit")

	// Defaults
	if sortBy == "" {
		sortBy = "name"
	}
	if order == "" {
		order = "asc"
	}
	page, _ := strconv.Atoi(pageStr)
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(limitStr)
	if limit < 1 {
		limit = 20
	}

	// Build WHERE clauses
	whereClauses := []string{"p.is_active = true"}
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf(
			"(p.name ILIKE $%d OR p.sku ILIKE $%d OR p.description ILIKE $%d)",
			argIdx, argIdx, argIdx,
		))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	if category != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("p.category_id = $%d", argIdx))
		args = append(args, category)
		argIdx++
	}

	if minPriceStr != "" {
		if minPrice, err := strconv.ParseFloat(minPriceStr, 64); err == nil {
			whereClauses = append(whereClauses, fmt.Sprintf("p.price >= $%d", argIdx))
			args = append(args, minPrice)
			argIdx++
		}
	}
	if maxPriceStr != "" {
		if maxPrice, err := strconv.ParseFloat(maxPriceStr, 64); err == nil {
			whereClauses = append(whereClauses, fmt.Sprintf("p.price <= $%d", argIdx))
			args = append(args, maxPrice)
			argIdx++
		}
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	// Sorting — map camelCase to snake_case
	validSorts := map[string]string{
		"name":      "p.name",
		"price":     "p.price",
		"createdAt": "p.created_at",
		"stock":     "p.stock",
	}
	sortCol, ok := validSorts[sortBy]
	if !ok {
		sortCol = "p.name"
	}
	sortOrder := "ASC"
	if order == "desc" {
		sortOrder = "DESC"
	}

	offset := (page - 1) * limit

	// Count query
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM products p WHERE %s", whereSQL)
	var total int
	if err := h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total); err != nil {
		RespondError(w, 500, "Failed to count products.")
		return
	}

	// Data query
	dataQuery := fmt.Sprintf(`
		SELECT p.id, p.name, p.slug, p.sku, p.category_id, p.description,
			p.price, p.stock, p.unit, p.image_url, p.is_active,
			p.average_rating, p.review_count, p.created_at, p.updated_at,
			c.id, c.name, c.slug
		FROM products p
		LEFT JOIN categories c ON c.id = p.category_id
		WHERE %s
		ORDER BY %s %s
		LIMIT $%d OFFSET $%d
	`, whereSQL, sortCol, sortOrder, argIdx, argIdx+1)
	dataArgs := append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), dataQuery, dataArgs...)
	if err != nil {
		RespondError(w, 500, "Failed to fetch products.")
		return
	}
	defer rows.Close()

	products := []models.Product{}
	for rows.Next() {
		p, err := scanProductWithCategory(rows.Scan)
		if err != nil {
			RespondError(w, 500, "Failed to scan product.")
			return
		}
		products = append(products, p)
	}

	pages := int(math.Ceil(float64(total) / float64(limit)))

	RespondJSON(w, 200, map[string]interface{}{
		"products": products,
		"pagination": models.Pagination{
			Page:  page,
			Limit: limit,
			Total: total,
			Pages: pages,
		},
	})
}

// AdminListProducts returns all products including inactive (Admin/Staff).
func (h *Handler) AdminListProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	search := q.Get("search")
	category := q.Get("category")
	pageStr := q.Get("page")
	limitStr := q.Get("limit")

	page, _ := strconv.Atoi(pageStr)
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(limitStr)
	if limit < 1 {
		limit = 50
	}

	whereClauses := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf(
			"(p.name ILIKE $%d OR p.sku ILIKE $%d)",
			argIdx, argIdx,
		))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	if category != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("p.category_id = $%d", argIdx))
		args = append(args, category)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")
	offset := (page - 1) * limit

	// Count query
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM products p WHERE %s", whereSQL)
	if err := h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total); err != nil {
		RespondError(w, 500, "Failed to count products.")
		return
	}

	// Data query
	dataQuery := fmt.Sprintf(`
		SELECT p.id, p.name, p.slug, p.sku, p.category_id, p.description,
			p.price, p.stock, p.unit, p.image_url, p.is_active,
			p.average_rating, p.review_count, p.created_at, p.updated_at,
			c.id, c.name
		FROM products p
		LEFT JOIN categories c ON c.id = p.category_id
		WHERE %s
		ORDER BY p.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)
	dataArgs := append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), dataQuery, dataArgs...)
	if err != nil {
		RespondError(w, 500, "Failed to fetch products.")
		return
	}
	defer rows.Close()

	products := []models.Product{}
	for rows.Next() {
		p, err := scanProductWithCategoryBrief(rows.Scan)
		if err != nil {
			RespondError(w, 500, "Failed to scan product.")
			return
		}
		products = append(products, p)
	}

	pages := int(math.Ceil(float64(total) / float64(limit)))

	RespondJSON(w, 200, map[string]interface{}{
		"products": products,
		"pagination": models.Pagination{
			Page:  page,
			Limit: limit,
			Total: total,
			Pages: pages,
		},
	})
}

// GetProduct returns a product by ID or slug, including full category.
func (h *Handler) GetProduct(w http.ResponseWriter, r *http.Request) {
	idOrSlug := chi.URLParam(r, "idOrSlug")

	query := `
		SELECT p.id, p.name, p.slug, p.sku, p.category_id, p.description,
			p.price, p.stock, p.unit, p.image_url, p.is_active,
			p.average_rating, p.review_count, p.created_at, p.updated_at,
			c.id, c.name, c.slug
		FROM products p
		LEFT JOIN categories c ON c.id = p.category_id
		WHERE p.id = $1
	`

	// Try by ID first
	product, err := scanProductFull(func(dest ...interface{}) error {
		return h.DB.QueryRow(r.Context(), query, idOrSlug).Scan(dest...)
	})

	if err != nil {
		// Try by slug
		slugQuery := `
			SELECT p.id, p.name, p.slug, p.sku, p.category_id, p.description,
				p.price, p.stock, p.unit, p.image_url, p.is_active,
				p.average_rating, p.review_count, p.created_at, p.updated_at,
				c.id, c.name, c.slug
			FROM products p
			LEFT JOIN categories c ON c.id = p.category_id
			WHERE p.slug = $1
		`
		product, err = scanProductFull(func(dest ...interface{}) error {
			return h.DB.QueryRow(r.Context(), slugQuery, idOrSlug).Scan(dest...)
		})
		if err != nil {
			RespondError(w, 404, "Product not found.")
			return
		}
	}

	RespondJSON(w, 200, map[string]interface{}{"product": product})
}

// CreateProduct creates a new product (Admin only).
func (h *Handler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name        *string  `json:"name"`
		SKU         *string  `json:"sku"`
		CategoryID  *string  `json:"categoryId"`
		Description *string  `json:"description"`
		Price       *float64 `json:"price"`
		Stock       *int     `json:"stock"`
		Unit        *string  `json:"unit"`
		ImageURL    *string  `json:"imageUrl"`
		IsActive    *bool    `json:"isActive"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, 400, "Invalid request body.")
		return
	}

	if body.Name == nil || body.SKU == nil || body.CategoryID == nil || body.Price == nil {
		RespondError(w, 400, "Name, SKU, category, and price are required.")
		return
	}

	// Verify category exists
	var catExists bool
	err := h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1)`, *body.CategoryID).Scan(&catExists)
	if err != nil || !catExists {
		RespondError(w, 400, "Category not found.")
		return
	}

	slug := slugify(*body.Name)
	id := uuid.New().String()
	now := time.Now()
	sku := strings.ToUpper(*body.SKU)

	stock := 0
	if body.Stock != nil {
		stock = *body.Stock
	}
	unit := "pc"
	if body.Unit != nil && *body.Unit != "" {
		unit = *body.Unit
	}
	isActive := true
	if body.IsActive != nil {
		isActive = *body.IsActive
	}

	query := `
		INSERT INTO products (id, name, slug, sku, category_id, description, price, stock, unit, image_url, is_active, average_rating, review_count, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, 0, $12, $12)
		RETURNING id, name, slug, sku, category_id, description, price, stock, unit, image_url, is_active, average_rating, review_count, created_at, updated_at
	`

	var p models.Product
	err = h.DB.QueryRow(r.Context(), query,
		id, *body.Name, slug, sku, *body.CategoryID, body.Description,
		*body.Price, stock, unit, body.ImageURL, isActive, now,
	).Scan(
		&p.ID, &p.Name, &p.Slug, &p.SKU, &p.CategoryID, &p.Description,
		&p.Price, &p.Stock, &p.Unit, &p.ImageURL, &p.IsActive,
		&p.AverageRating, &p.ReviewCount, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		RespondError(w, 500, "Failed to create product.")
		return
	}

	// Fetch the category for the response
	var cat models.CategoryBrief
	var catSlug *string
	_ = h.DB.QueryRow(r.Context(), `SELECT id, name, slug FROM categories WHERE id = $1`, p.CategoryID).Scan(&cat.ID, &cat.Name, &catSlug)
	cat.Slug = catSlug
	p.Category = &cat

	RespondJSON(w, 201, map[string]interface{}{
		"message": "Product created.",
		"product": p,
	})
}

// UpdateProduct updates an existing product (Admin only).
func (h *Handler) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var body struct {
		Name        *string  `json:"name"`
		SKU         *string  `json:"sku"`
		CategoryID  *string  `json:"categoryId"`
		Description *string  `json:"description"`
		Price       *float64 `json:"price"`
		Stock       *int     `json:"stock"`
		Unit        *string  `json:"unit"`
		ImageURL    *string  `json:"imageUrl"`
		IsActive    *bool    `json:"isActive"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, 400, "Invalid request body.")
		return
	}

	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if body.Name != nil && *body.Name != "" {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *body.Name)
		argIdx++
		slug := slugify(*body.Name)
		setClauses = append(setClauses, fmt.Sprintf("slug = $%d", argIdx))
		args = append(args, slug)
		argIdx++
	}
	if body.SKU != nil && *body.SKU != "" {
		setClauses = append(setClauses, fmt.Sprintf("sku = $%d", argIdx))
		args = append(args, strings.ToUpper(*body.SKU))
		argIdx++
	}
	if body.CategoryID != nil && *body.CategoryID != "" {
		// Verify category exists
		var catExists bool
		err := h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1)`, *body.CategoryID).Scan(&catExists)
		if err != nil || !catExists {
			RespondError(w, 400, "Category not found.")
			return
		}
		setClauses = append(setClauses, fmt.Sprintf("category_id = $%d", argIdx))
		args = append(args, *body.CategoryID)
		argIdx++
	}
	if body.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *body.Description)
		argIdx++
	}
	if body.Price != nil {
		setClauses = append(setClauses, fmt.Sprintf("price = $%d", argIdx))
		args = append(args, *body.Price)
		argIdx++
	}
	if body.Stock != nil {
		setClauses = append(setClauses, fmt.Sprintf("stock = $%d", argIdx))
		args = append(args, *body.Stock)
		argIdx++
	}
	if body.Unit != nil && *body.Unit != "" {
		setClauses = append(setClauses, fmt.Sprintf("unit = $%d", argIdx))
		args = append(args, *body.Unit)
		argIdx++
	}
	if body.ImageURL != nil {
		setClauses = append(setClauses, fmt.Sprintf("image_url = $%d", argIdx))
		args = append(args, *body.ImageURL)
		argIdx++
	}
	if body.IsActive != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_active = $%d", argIdx))
		args = append(args, *body.IsActive)
		argIdx++
	}

	if len(setClauses) == 0 {
		RespondError(w, 400, "No fields to update.")
		return
	}

	// Add updated_at
	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", argIdx))
	args = append(args, time.Now())
	argIdx++

	query := fmt.Sprintf(`
		UPDATE products SET %s
		WHERE id = $%d
		RETURNING id, name, slug, sku, category_id, description, price, stock, unit, image_url, is_active, average_rating, review_count, created_at, updated_at
	`, strings.Join(setClauses, ", "), argIdx)
	args = append(args, id)

	var p models.Product
	err := h.DB.QueryRow(r.Context(), query, args...).Scan(
		&p.ID, &p.Name, &p.Slug, &p.SKU, &p.CategoryID, &p.Description,
		&p.Price, &p.Stock, &p.Unit, &p.ImageURL, &p.IsActive,
		&p.AverageRating, &p.ReviewCount, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		RespondError(w, 500, "Failed to update product.")
		return
	}

	// Fetch category for the response
	var cat models.CategoryBrief
	var catSlug *string
	_ = h.DB.QueryRow(r.Context(), `SELECT id, name, slug FROM categories WHERE id = $1`, p.CategoryID).Scan(&cat.ID, &cat.Name, &catSlug)
	cat.Slug = catSlug
	p.Category = &cat

	RespondJSON(w, 200, map[string]interface{}{
		"message": "Product updated.",
		"product": p,
	})
}

// DeleteProduct soft-deletes a product by marking it inactive (Admin only).
func (h *Handler) DeleteProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	_, err := h.DB.Exec(r.Context(), `UPDATE products SET is_active = false WHERE id = $1`, id)
	if err != nil {
		RespondError(w, 500, "Failed to deactivate product.")
		return
	}

	RespondJSON(w, 200, map[string]string{"message": "Product deactivated."})
}

// PermanentDeleteProduct hard-deletes a product if not in any quotation (Admin only).
func (h *Handler) PermanentDeleteProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var quotationCount int
	err := h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM quotation_items WHERE product_id = $1`, id).Scan(&quotationCount)
	if err != nil {
		RespondError(w, 500, "Failed to check quotation items.")
		return
	}

	if quotationCount > 0 {
		RespondError(w, 400, fmt.Sprintf("Cannot permanently delete. Product is referenced in %d quotation(s). Use deactivate instead.", quotationCount))
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM products WHERE id = $1`, id)
	if err != nil {
		RespondError(w, 500, "Failed to delete product.")
		return
	}

	RespondJSON(w, 200, map[string]string{"message": "Product permanently deleted."})
}

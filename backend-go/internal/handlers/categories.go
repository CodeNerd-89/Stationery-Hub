package handlers

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"stationery-hub-backend/internal/models"
)

var slugRe = regexp.MustCompile(`[^a-z0-9]+`)
var slugTrimRe = regexp.MustCompile(`(^-|-$)`)

func slugify(name string) string {
	s := strings.ToLower(name)
	s = slugRe.ReplaceAllString(s, "-")
	s = slugTrimRe.ReplaceAllString(s, "")
	return s
}

// ListCategories returns all categories with product counts, ordered by sort_order ASC.
func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `
		SELECT c.id, c.name, c.slug, c.description, c.image_url, c.sort_order, c.created_at,
			(SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
		FROM categories c
		ORDER BY c.sort_order ASC
	`)
	if err != nil {
		RespondError(w, 500, "Failed to fetch categories.")
		return
	}
	defer rows.Close()

	categories := []map[string]interface{}{}
	for rows.Next() {
		var cat models.Category
		var productCount int
		if err := rows.Scan(&cat.ID, &cat.Name, &cat.Slug, &cat.Description, &cat.ImageURL, &cat.SortOrder, &cat.CreatedAt, &productCount); err != nil {
			RespondError(w, 500, "Failed to scan category.")
			return
		}
		categories = append(categories, map[string]interface{}{
			"id":          cat.ID,
			"name":        cat.Name,
			"slug":        cat.Slug,
			"description": cat.Description,
			"imageUrl":    cat.ImageURL,
			"sortOrder":   cat.SortOrder,
			"createdAt":   cat.CreatedAt,
			"_count": map[string]int{
				"products": productCount,
			},
		})
	}

	RespondJSON(w, 200, map[string]interface{}{"categories": categories})
}

// GetCategory returns a single category with its active products.
func (h *Handler) GetCategory(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Fetch the category
	var cat models.Category
	err := h.DB.QueryRow(r.Context(), `
		SELECT id, name, slug, description, image_url, sort_order, created_at
		FROM categories WHERE id = $1
	`, id).Scan(&cat.ID, &cat.Name, &cat.Slug, &cat.Description, &cat.ImageURL, &cat.SortOrder, &cat.CreatedAt)
	if err != nil {
		RespondError(w, 404, "Category not found.")
		return
	}

	// Fetch active products for this category
	prodRows, err := h.DB.Query(r.Context(), `
		SELECT id, name, slug, sku, category_id, description, price, stock, unit,
			image_url, is_active, average_rating, review_count, created_at, updated_at
		FROM products
		WHERE category_id = $1 AND is_active = true
		ORDER BY name ASC
	`, id)
	if err != nil {
		RespondError(w, 500, "Failed to fetch products.")
		return
	}
	defer prodRows.Close()

	products := []models.Product{}
	for prodRows.Next() {
		var p models.Product
		if err := prodRows.Scan(&p.ID, &p.Name, &p.Slug, &p.SKU, &p.CategoryID, &p.Description,
			&p.Price, &p.Stock, &p.Unit, &p.ImageURL, &p.IsActive,
			&p.AverageRating, &p.ReviewCount, &p.CreatedAt, &p.UpdatedAt); err != nil {
			RespondError(w, 500, "Failed to scan product.")
			return
		}
		products = append(products, p)
	}
	cat.Products = products

	RespondJSON(w, 200, map[string]interface{}{"category": cat})
}

// CreateCategory creates a new category (Admin only).
func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		ImageURL    *string `json:"imageUrl"`
		SortOrder   *int    `json:"sortOrder"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, 400, "Invalid request body.")
		return
	}

	if body.Name == nil || *body.Name == "" {
		RespondError(w, 400, "Category name is required.")
		return
	}

	slug := slugify(*body.Name)
	id := uuid.New().String()
	now := time.Now()

	sortOrder := 0
	if body.SortOrder != nil {
		sortOrder = *body.SortOrder
	}

	var cat models.Category
	err := h.DB.QueryRow(r.Context(), `
		INSERT INTO categories (id, name, slug, description, image_url, sort_order, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, name, slug, description, image_url, sort_order, created_at
	`, id, *body.Name, slug, body.Description, body.ImageURL, sortOrder, now).Scan(
		&cat.ID, &cat.Name, &cat.Slug, &cat.Description, &cat.ImageURL, &cat.SortOrder, &cat.CreatedAt,
	)
	if err != nil {
		RespondError(w, 500, "Failed to create category.")
		return
	}

	RespondJSON(w, 201, map[string]interface{}{
		"message":  "Category created.",
		"category": cat,
	})
}

// UpdateCategory updates an existing category (Admin only).
func (h *Handler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var body struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		ImageURL    *string `json:"imageUrl"`
		SortOrder   *int    `json:"sortOrder"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, 400, "Invalid request body.")
		return
	}

	// Build dynamic SET clauses
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
	if body.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *body.Description)
		argIdx++
	}
	if body.ImageURL != nil {
		setClauses = append(setClauses, fmt.Sprintf("image_url = $%d", argIdx))
		args = append(args, *body.ImageURL)
		argIdx++
	}
	if body.SortOrder != nil {
		setClauses = append(setClauses, fmt.Sprintf("sort_order = $%d", argIdx))
		args = append(args, *body.SortOrder)
		argIdx++
	}

	if len(setClauses) == 0 {
		RespondError(w, 400, "No fields to update.")
		return
	}

	query := fmt.Sprintf(`
		UPDATE categories SET %s
		WHERE id = $%d
		RETURNING id, name, slug, description, image_url, sort_order, created_at
	`, strings.Join(setClauses, ", "), argIdx)
	args = append(args, id)

	var cat models.Category
	err := h.DB.QueryRow(r.Context(), query, args...).Scan(
		&cat.ID, &cat.Name, &cat.Slug, &cat.Description, &cat.ImageURL, &cat.SortOrder, &cat.CreatedAt,
	)
	if err != nil {
		RespondError(w, 500, "Failed to update category.")
		return
	}

	RespondJSON(w, 200, map[string]interface{}{
		"message":  "Category updated.",
		"category": cat,
	})
}

// DeleteCategory deletes a category if it has no products (Admin only).
func (h *Handler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Check if category has products
	var productCount int
	err := h.DB.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM products WHERE category_id = $1
	`, id).Scan(&productCount)
	if err != nil {
		RespondError(w, 500, "Failed to check products.")
		return
	}

	if productCount > 0 {
		RespondError(w, 400, fmt.Sprintf("Cannot delete category. It has %d products. Move or delete them first.", productCount))
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM categories WHERE id = $1`, id)
	if err != nil {
		RespondError(w, 500, "Failed to delete category.")
		return
	}

	RespondJSON(w, 200, map[string]string{"message": "Category deleted."})
}

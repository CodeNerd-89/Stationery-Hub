package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"stationery-hub-backend/internal/models"
)

// GetWishlist returns the authenticated user's wishlist with product and category info.
func (h *Handler) GetWishlist(w http.ResponseWriter, r *http.Request) {
	user := GetUser(r)
	if user == nil {
		RespondError(w, 401, "Unauthorized.")
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT w.id, w.user_id, w.product_id, w.created_at,
			p.id, p.name, p.slug, p.sku, p.category_id, p.description,
			p.price, p.stock, p.unit, p.image_url, p.is_active,
			p.average_rating, p.review_count, p.created_at, p.updated_at,
			c.name
		FROM wishlists w
		LEFT JOIN products p ON p.id = w.product_id
		LEFT JOIN categories c ON c.id = p.category_id
		WHERE w.user_id = $1
		ORDER BY w.created_at DESC
	`, user.ID)
	if err != nil {
		RespondError(w, 500, "Failed to fetch wishlist.")
		return
	}
	defer rows.Close()

	wishlist := []models.Wishlist{}
	for rows.Next() {
		var wl models.Wishlist
		var p models.Product
		var catName *string
		if err := rows.Scan(
			&wl.ID, &wl.UserID, &wl.ProductID, &wl.CreatedAt,
			&p.ID, &p.Name, &p.Slug, &p.SKU, &p.CategoryID, &p.Description,
			&p.Price, &p.Stock, &p.Unit, &p.ImageURL, &p.IsActive,
			&p.AverageRating, &p.ReviewCount, &p.CreatedAt, &p.UpdatedAt,
			&catName,
		); err != nil {
			RespondError(w, 500, "Failed to scan wishlist item.")
			return
		}
		if catName != nil {
			p.Category = &models.CategoryBrief{Name: *catName}
		}
		wl.Product = &p
		wishlist = append(wishlist, wl)
	}

	RespondJSON(w, 200, map[string]interface{}{"wishlist": wishlist})
}

// ToggleWishlist adds or removes a product from the user's wishlist.
func (h *Handler) ToggleWishlist(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "productId")
	user := GetUser(r)
	if user == nil {
		RespondError(w, 401, "Unauthorized.")
		return
	}

	// Check if already wishlisted
	var existingID *string
	err := h.DB.QueryRow(r.Context(), `
		SELECT id FROM wishlists WHERE user_id = $1 AND product_id = $2
	`, user.ID, productID).Scan(&existingID)

	if err == nil && existingID != nil {
		// Already exists — remove it
		_, err = h.DB.Exec(r.Context(), `DELETE FROM wishlists WHERE id = $1`, *existingID)
		if err != nil {
			RespondError(w, 500, "Failed to remove from wishlist.")
			return
		}
		RespondJSON(w, 200, map[string]interface{}{
			"message":    "Removed from wishlist.",
			"wishlisted": false,
		})
		return
	}

	// Verify product exists
	var productExists bool
	err = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM products WHERE id = $1)`, productID).Scan(&productExists)
	if err != nil || !productExists {
		RespondError(w, 404, "Product not found.")
		return
	}

	// Create wishlist entry
	id := uuid.New().String()
	_, err = h.DB.Exec(r.Context(), `
		INSERT INTO wishlists (id, user_id, product_id, created_at) VALUES ($1, $2, $3, NOW())
	`, id, user.ID, productID)
	if err != nil {
		RespondError(w, 500, "Failed to add to wishlist.")
		return
	}

	RespondJSON(w, 201, map[string]interface{}{
		"message":    "Added to wishlist.",
		"wishlisted": true,
	})
}

// RemoveFromWishlist removes a product from the user's wishlist.
func (h *Handler) RemoveFromWishlist(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "productId")
	user := GetUser(r)
	if user == nil {
		RespondError(w, 401, "Unauthorized.")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		DELETE FROM wishlists WHERE user_id = $1 AND product_id = $2
	`, user.ID, productID)
	if err != nil {
		RespondError(w, 500, "Failed to remove from wishlist.")
		return
	}

	RespondJSON(w, 200, map[string]string{"message": "Removed from wishlist."})
}

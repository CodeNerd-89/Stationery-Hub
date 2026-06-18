package handlers

import (
	"context"
	"math"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"stationery-hub-backend/internal/models"
)

// updateProductRating recalculates and updates a product's average_rating and review_count.
func updateProductRating(ctx context.Context, db *pgxpool.Pool, productID string) error {
	var avgRating *float64
	var reviewCount int
	err := db.QueryRow(ctx, `
		SELECT AVG(rating), COUNT(*)
		FROM reviews
		WHERE product_id = $1
	`, productID).Scan(&avgRating, &reviewCount)
	if err != nil {
		return err
	}

	avg := 0.0
	if avgRating != nil {
		avg = *avgRating
	}

	_, err = db.Exec(ctx, `
		UPDATE products SET average_rating = $1, review_count = $2 WHERE id = $3
	`, avg, reviewCount, productID)
	return err
}

// GetProductReviews returns paginated reviews for a product with rating distribution.
func (h *Handler) GetProductReviews(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "productId")
	q := r.URL.Query()

	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit < 1 {
		limit = 10
	}
	offset := (page - 1) * limit

	// Count total reviews
	var total int
	err := h.DB.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM reviews WHERE product_id = $1
	`, productID).Scan(&total)
	if err != nil {
		RespondError(w, 500, "Failed to count reviews.")
		return
	}

	// Fetch reviews with user brief
	rows, err := h.DB.Query(r.Context(), `
		SELECT r.id, r.user_id, r.product_id, r.rating, r.title, r.comment, r.created_at, r.updated_at,
			u.id, u.name
		FROM reviews r
		LEFT JOIN users u ON u.id = r.user_id
		WHERE r.product_id = $1
		ORDER BY r.created_at DESC
		LIMIT $2 OFFSET $3
	`, productID, limit, offset)
	if err != nil {
		RespondError(w, 500, "Failed to fetch reviews.")
		return
	}
	defer rows.Close()

	reviews := []models.Review{}
	for rows.Next() {
		var rv models.Review
		var userID, userName string
		if err := rows.Scan(&rv.ID, &rv.UserID, &rv.ProductID, &rv.Rating, &rv.Title, &rv.Comment, &rv.CreatedAt, &rv.UpdatedAt,
			&userID, &userName); err != nil {
			RespondError(w, 500, "Failed to scan review.")
			return
		}
		rv.User = &models.UserBrief{Name: userName}
		// Include the user id in the response — use a map for the user field instead
		reviews = append(reviews, rv)
	}

	// Build the reviews response with user id included
	reviewsResp := make([]map[string]interface{}, len(reviews))
	for i, rv := range reviews {
		reviewsResp[i] = map[string]interface{}{
			"id":        rv.ID,
			"userId":    rv.UserID,
			"productId": rv.ProductID,
			"rating":    rv.Rating,
			"title":     rv.Title,
			"comment":   rv.Comment,
			"createdAt": rv.CreatedAt,
			"updatedAt": rv.UpdatedAt,
			"user": map[string]interface{}{
				"id":   rv.UserID,
				"name": rv.User.Name,
			},
		}
	}

	// Rating distribution
	distRows, err := h.DB.Query(r.Context(), `
		SELECT rating, COUNT(*) FROM reviews WHERE product_id = $1 GROUP BY rating
	`, productID)
	if err != nil {
		RespondError(w, 500, "Failed to fetch rating distribution.")
		return
	}
	defer distRows.Close()

	ratingDistribution := map[int]int{1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
	for distRows.Next() {
		var rating, count int
		if err := distRows.Scan(&rating, &count); err != nil {
			continue
		}
		ratingDistribution[rating] = count
	}

	pages := int(math.Ceil(float64(total) / float64(limit)))

	RespondJSON(w, 200, map[string]interface{}{
		"reviews":            reviewsResp,
		"ratingDistribution": ratingDistribution,
		"pagination": models.Pagination{
			Page:  page,
			Limit: limit,
			Total: total,
			Pages: pages,
		},
	})
}

// CreateReview creates or updates a review (upsert) for a product.
func (h *Handler) CreateReview(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "productId")
	user := GetUser(r)
	if user == nil {
		RespondError(w, 401, "Unauthorized.")
		return
	}

	var body struct {
		Rating  *int    `json:"rating"`
		Title   *string `json:"title"`
		Comment *string `json:"comment"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, 400, "Invalid request body.")
		return
	}

	if body.Rating == nil || *body.Rating < 1 || *body.Rating > 5 {
		RespondError(w, 400, "Rating must be between 1 and 5.")
		return
	}

	// Verify product exists
	var productExists bool
	err := h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM products WHERE id = $1)`, productID).Scan(&productExists)
	if err != nil || !productExists {
		RespondError(w, 404, "Product not found.")
		return
	}

	id := uuid.New().String()

	// Upsert: INSERT ... ON CONFLICT (user_id, product_id) DO UPDATE
	var rv models.Review
	var userName string
	err = h.DB.QueryRow(r.Context(), `
		INSERT INTO reviews (id, user_id, product_id, rating, title, comment, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
		ON CONFLICT (user_id, product_id) DO UPDATE
		SET rating = EXCLUDED.rating, title = EXCLUDED.title, comment = EXCLUDED.comment, updated_at = NOW()
		RETURNING id, user_id, product_id, rating, title, comment, created_at, updated_at
	`, id, user.ID, productID, *body.Rating, body.Title, body.Comment).Scan(
		&rv.ID, &rv.UserID, &rv.ProductID, &rv.Rating, &rv.Title, &rv.Comment, &rv.CreatedAt, &rv.UpdatedAt,
	)
	if err != nil {
		RespondError(w, 500, "Failed to submit review.")
		return
	}

	// Get user name for response
	_ = h.DB.QueryRow(r.Context(), `SELECT name FROM users WHERE id = $1`, user.ID).Scan(&userName)

	// Recalculate product rating
	_ = updateProductRating(r.Context(), h.DB, productID)

	RespondJSON(w, 201, map[string]interface{}{
		"message": "Review submitted.",
		"review": map[string]interface{}{
			"id":        rv.ID,
			"userId":    rv.UserID,
			"productId": rv.ProductID,
			"rating":    rv.Rating,
			"title":     rv.Title,
			"comment":   rv.Comment,
			"createdAt": rv.CreatedAt,
			"updatedAt": rv.UpdatedAt,
			"user": map[string]interface{}{
				"id":   user.ID,
				"name": userName,
			},
		},
	})
}

// DeleteReview deletes a review (owner or admin).
func (h *Handler) DeleteReview(w http.ResponseWriter, r *http.Request) {
	reviewID := chi.URLParam(r, "reviewId")
	user := GetUser(r)
	if user == nil {
		RespondError(w, 401, "Unauthorized.")
		return
	}

	// Fetch the review
	var rv models.Review
	err := h.DB.QueryRow(r.Context(), `
		SELECT id, user_id, product_id FROM reviews WHERE id = $1
	`, reviewID).Scan(&rv.ID, &rv.UserID, &rv.ProductID)
	if err != nil {
		RespondError(w, 404, "Review not found.")
		return
	}

	// Authorization: owner or admin
	if rv.UserID != user.ID && user.Role != "ADMIN" {
		RespondError(w, 403, "You can only delete your own reviews.")
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM reviews WHERE id = $1`, reviewID)
	if err != nil {
		RespondError(w, 500, "Failed to delete review.")
		return
	}

	// Recalculate product rating
	_ = updateProductRating(r.Context(), h.DB, rv.ProductID)

	RespondJSON(w, 200, map[string]string{"message": "Review deleted."})
}

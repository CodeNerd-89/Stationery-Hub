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

// ─── List Promos ────────────────────────────────────

func (h *Handler) ListPromos(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(),
		`SELECT id, code, discount_type, discount_value, min_order_amount, valid_from, valid_until, usage_limit, used_count, is_active, created_at
		 FROM promo_codes ORDER BY created_at DESC`)
	if err != nil {
		RespondError(w, 500, "Failed to fetch promo codes.")
		return
	}
	defer rows.Close()

	promos := []map[string]interface{}{}
	for rows.Next() {
		var id, code, discountType string
		var discountValue float64
		var minOrderAmount *float64
		var validFrom, validUntil time.Time
		var usageLimit *int
		var usedCount int
		var isActive bool
		var createdAt time.Time

		if err := rows.Scan(&id, &code, &discountType, &discountValue, &minOrderAmount, &validFrom, &validUntil, &usageLimit, &usedCount, &isActive, &createdAt); err != nil {
			continue
		}
		promos = append(promos, map[string]interface{}{
			"id":             id,
			"code":           code,
			"discountType":   discountType,
			"discountValue":  discountValue,
			"minOrderAmount": minOrderAmount,
			"validFrom":      validFrom,
			"validUntil":     validUntil,
			"usageLimit":     usageLimit,
			"usedCount":      usedCount,
			"isActive":       isActive,
			"createdAt":      createdAt,
		})
	}

	RespondJSON(w, 200, map[string]interface{}{"promoCodes": promos})
}

// ─── Create Promo ───────────────────────────────────

func (h *Handler) CreatePromo(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code           string   `json:"code"`
		DiscountType   string   `json:"discountType"`
		DiscountValue  float64  `json:"discountValue"`
		MinOrderAmount *float64 `json:"minOrderAmount"`
		ValidFrom      string   `json:"validFrom"`
		ValidUntil     string   `json:"validUntil"`
		UsageLimit     *int     `json:"usageLimit"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, 400, "Invalid request body.")
		return
	}

	if body.Code == "" || body.DiscountType == "" || body.DiscountValue <= 0 {
		RespondError(w, 400, "Code, discountType, and discountValue are required.")
		return
	}

	code := strings.ToUpper(body.Code)

	// Check if code exists
	var exists string
	err := h.DB.QueryRow(r.Context(), `SELECT id FROM promo_codes WHERE code = $1`, code).Scan(&exists)
	if err == nil {
		RespondError(w, 409, "Promo code already exists.")
		return
	}

	id := uuid.New().String()
	now := time.Now()

	validFrom := now
	if body.ValidFrom != "" {
		if t, err := time.Parse(time.RFC3339, body.ValidFrom); err == nil {
			validFrom = t
		}
	}
	validUntil := now.Add(30 * 24 * time.Hour) // default 30 days
	if body.ValidUntil != "" {
		if t, err := time.Parse(time.RFC3339, body.ValidUntil); err == nil {
			validUntil = t
		}
	}

	_, err = h.DB.Exec(r.Context(),
		`INSERT INTO promo_codes (id, code, discount_type, discount_value, min_order_amount, valid_from, valid_until, usage_limit, used_count, is_active, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, true, $9)`,
		id, code, body.DiscountType, body.DiscountValue, body.MinOrderAmount, validFrom, validUntil, body.UsageLimit, now,
	)
	if err != nil {
		RespondError(w, 500, "Failed to create promo code.")
		return
	}

	RespondJSON(w, 201, map[string]interface{}{
		"message": "Promo code created.",
		"promoCode": map[string]interface{}{
			"id":             id,
			"code":           code,
			"discountType":   body.DiscountType,
			"discountValue":  body.DiscountValue,
			"minOrderAmount": body.MinOrderAmount,
			"validFrom":      validFrom,
			"validUntil":     validUntil,
			"usageLimit":     body.UsageLimit,
			"usedCount":      0,
			"isActive":       true,
			"createdAt":      now,
		},
	})
}

// ─── Update Promo ───────────────────────────────────

func (h *Handler) UpdatePromo(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var body struct {
		Code           *string  `json:"code"`
		DiscountType   *string  `json:"discountType"`
		DiscountValue  *float64 `json:"discountValue"`
		MinOrderAmount *float64 `json:"minOrderAmount"`
		ValidFrom      *string  `json:"validFrom"`
		ValidUntil     *string  `json:"validUntil"`
		UsageLimit     *int     `json:"usageLimit"`
		IsActive       *bool    `json:"isActive"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, 400, "Invalid request body.")
		return
	}

	// Build dynamic update
	sets := []string{}
	args := []interface{}{}
	argIdx := 1

	if body.Code != nil {
		sets = append(sets, fmt.Sprintf("code = $%d", argIdx))
		args = append(args, strings.ToUpper(*body.Code))
		argIdx++
	}
	if body.DiscountType != nil {
		sets = append(sets, fmt.Sprintf("discount_type = $%d", argIdx))
		args = append(args, *body.DiscountType)
		argIdx++
	}
	if body.DiscountValue != nil {
		sets = append(sets, fmt.Sprintf("discount_value = $%d", argIdx))
		args = append(args, *body.DiscountValue)
		argIdx++
	}
	if body.MinOrderAmount != nil {
		sets = append(sets, fmt.Sprintf("min_order_amount = $%d", argIdx))
		args = append(args, *body.MinOrderAmount)
		argIdx++
	}
	if body.ValidFrom != nil {
		if t, err := time.Parse(time.RFC3339, *body.ValidFrom); err == nil {
			sets = append(sets, fmt.Sprintf("valid_from = $%d", argIdx))
			args = append(args, t)
			argIdx++
		}
	}
	if body.ValidUntil != nil {
		if t, err := time.Parse(time.RFC3339, *body.ValidUntil); err == nil {
			sets = append(sets, fmt.Sprintf("valid_until = $%d", argIdx))
			args = append(args, t)
			argIdx++
		}
	}
	if body.UsageLimit != nil {
		sets = append(sets, fmt.Sprintf("usage_limit = $%d", argIdx))
		args = append(args, *body.UsageLimit)
		argIdx++
	}
	if body.IsActive != nil {
		sets = append(sets, fmt.Sprintf("is_active = $%d", argIdx))
		args = append(args, *body.IsActive)
		argIdx++
	}

	if len(sets) == 0 {
		RespondError(w, 400, "No fields to update.")
		return
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE promo_codes SET %s WHERE id = $%d", strings.Join(sets, ", "), argIdx)
	_, err := h.DB.Exec(r.Context(), query, args...)
	if err != nil {
		RespondError(w, 500, "Failed to update promo code.")
		return
	}

	// Fetch updated
	var code, discountType string
	var discountValue float64
	var minOrderAmount *float64
	var validFrom, validUntil, createdAt time.Time
	var usageLimit *int
	var usedCount int
	var isActive bool

	err = h.DB.QueryRow(r.Context(),
		`SELECT id, code, discount_type, discount_value, min_order_amount, valid_from, valid_until, usage_limit, used_count, is_active, created_at FROM promo_codes WHERE id = $1`, id,
	).Scan(&id, &code, &discountType, &discountValue, &minOrderAmount, &validFrom, &validUntil, &usageLimit, &usedCount, &isActive, &createdAt)

	if err != nil {
		RespondError(w, 404, "Promo code not found.")
		return
	}

	RespondJSON(w, 200, map[string]interface{}{
		"message": "Promo code updated.",
		"promoCode": map[string]interface{}{
			"id": id, "code": code, "discountType": discountType, "discountValue": discountValue,
			"minOrderAmount": minOrderAmount, "validFrom": validFrom, "validUntil": validUntil,
			"usageLimit": usageLimit, "usedCount": usedCount, "isActive": isActive, "createdAt": createdAt,
		},
	})
}

// ─── Delete Promo ───────────────────────────────────

func (h *Handler) DeletePromo(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Soft delete
	_, err := h.DB.Exec(r.Context(), `UPDATE promo_codes SET is_active = false WHERE id = $1`, id)
	if err != nil {
		RespondError(w, 500, "Failed to deactivate promo code.")
		return
	}

	RespondJSON(w, 200, map[string]interface{}{"message": "Promo code deactivated."})
}

// ─── Validate Promo (used by checkout) ──────────────

func (h *Handler) ValidatePromo(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code       string  `json:"code"`
		OrderTotal float64 `json:"orderTotal"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, 400, "Invalid request body.")
		return
	}

	if body.Code == "" {
		RespondError(w, 400, "Promo code is required.")
		return
	}

	var id, code, discountType string
	var discountValue float64
	var minOrderAmount *float64
	var validFrom, validUntil time.Time
	var usageLimit *int
	var usedCount int
	var isActive bool

	err := h.DB.QueryRow(r.Context(),
		`SELECT id, code, discount_type, discount_value, min_order_amount, valid_from, valid_until, usage_limit, used_count, is_active
		 FROM promo_codes WHERE code = $1`,
		strings.ToUpper(body.Code),
	).Scan(&id, &code, &discountType, &discountValue, &minOrderAmount, &validFrom, &validUntil, &usageLimit, &usedCount, &isActive)

	if err != nil {
		RespondError(w, 404, "Invalid promo code.")
		return
	}

	if !isActive {
		RespondError(w, 400, "This promo code is no longer active.")
		return
	}

	now := time.Now()
	if now.Before(validFrom) || now.After(validUntil) {
		RespondError(w, 400, "This promo code has expired.")
		return
	}

	if usageLimit != nil && usedCount >= *usageLimit {
		RespondError(w, 400, "This promo code has reached its usage limit.")
		return
	}

	if minOrderAmount != nil && body.OrderTotal < *minOrderAmount {
		RespondError(w, 400, fmt.Sprintf("Minimum order amount of %.0f required.", *minOrderAmount))
		return
	}

	// Calculate discount
	var discount float64
	if discountType == "PERCENTAGE" {
		discount = math.Round(body.OrderTotal*discountValue) / 100
	} else {
		discount = discountValue
	}
	if discount > body.OrderTotal {
		discount = body.OrderTotal
	}

	total, _ := strconv.ParseFloat(fmt.Sprintf("%.2f", body.OrderTotal-discount), 64)

	RespondJSON(w, 200, map[string]interface{}{
		"valid":    true,
		"code":     code,
		"discount": discount,
		"total":    total,
		"promoCode": map[string]interface{}{
			"id": id, "code": code, "discountType": discountType, "discountValue": discountValue,
		},
	})
}

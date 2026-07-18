package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"stationery-hub-backend/internal/services"
)

// ─── Upload & Scan ──────────────────────────────────

func (h *Handler) UploadScan(w http.ResponseWriter, r *http.Request) {
	user := GetUser(r)
	ctx := r.Context()

	// Parse multipart form (10MB max)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		RespondError(w, 400, "File too large. Maximum 10MB.")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		RespondError(w, 400, "No file uploaded. Use field name 'file'.")
		return
	}
	defer file.Close()

	// Validate file type
	contentType := header.Header.Get("Content-Type")
	allowedTypes := map[string]string{
		"image/jpeg":      ".jpg",
		"image/png":       ".png",
		"image/webp":      ".webp",
		"application/pdf": ".pdf",
	}
	ext, ok := allowedTypes[contentType]
	if !ok {
		RespondError(w, 400, "Unsupported file type. Allowed: JPEG, PNG, WebP, PDF.")
		return
	}

	// Save file
	os.MkdirAll("./uploads", 0755)
	fileName := fmt.Sprintf("scan_%d_%s%s", time.Now().UnixMilli(), uuid.New().String()[:8], ext)
	filePath := filepath.Join("./uploads", fileName)

	dst, err := os.Create(filePath)
	if err != nil {
		RespondError(w, 500, "Failed to save file.")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		RespondError(w, 500, "Failed to save file.")
		return
	}

	fileURL := "/uploads/" + fileName

	// Run OCR
	rawText, err := services.ExtractText(filePath, contentType)
	if err != nil {
		// Save scan job with ERROR status
		scanID := uuid.New().String()
		h.DB.Exec(ctx, `INSERT INTO scan_jobs (id, uploaded_by_id, file_url, file_type, status, created_at) VALUES ($1, $2, $3, $4, 'ERROR', $5)`,
			scanID, user.ID, fileURL, contentType, time.Now())
		RespondError(w, 500, fmt.Sprintf("OCR failed: %v", err))
		return
	}

	// Parse extracted items
	extractedItems := services.ParseExtractedItems(rawText)

	// Get all products for matching
	productRows, err := h.DB.Query(ctx, `SELECT id, name, sku, description, price, stock, unit FROM products WHERE is_active = true`)
	var products []services.ProductForMatch
	if err == nil {
		for productRows.Next() {
			var p services.ProductForMatch
			if productRows.Scan(&p.ID, &p.Name, &p.SKU, &p.Description, &p.Price, &p.Stock, &p.Unit) == nil {
				products = append(products, p)
			}
		}
		productRows.Close()
	}

	// Fuzzy match
	matchedItems := services.MatchWithCatalog(extractedItems, products)

	// Calculate stats for the frontend
	totalExtracted := len(matchedItems)
	autoMatched := 0
	needsReview := 0
	for _, item := range matchedItems {
		if item.MatchedProduct != nil && item.Confidence > 0.6 {
			autoMatched++
		} else if item.Confidence > 0 && item.MatchedProduct == nil {
			needsReview++
		}
	}
	unmatched := totalExtracted - autoMatched - needsReview

	// Save scan job
	scanID := uuid.New().String()
	matchedJSON, _ := json.Marshal(matchedItems)

	h.DB.Exec(ctx,
		`INSERT INTO scan_jobs (id, uploaded_by_id, file_url, file_type, raw_text, extracted_items, status, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, 'COMPLETED', $7)`,
		scanID, user.ID, fileURL, contentType, rawText, matchedJSON, time.Now())

	RespondJSON(w, 200, map[string]interface{}{
		"message":      "Scan processed successfully.",
		"scanJobId":    scanID,
		"rawText":      rawText,
		"matchedItems": matchedItems,
		"fileUrl":      fileURL,
		"stats": map[string]int{
			"totalExtracted": totalExtracted,
			"autoMatched":    autoMatched,
			"needsReview":    needsReview,
			"unmatched":      unmatched,
		},
	})
}

// ─── Create Quotation from Scan ─────────────────────

func (h *Handler) CreateQuotationFromScan(w http.ResponseWriter, r *http.Request) {
	scanJobID := chi.URLParam(r, "scanJobId")
	user := GetUser(r)
	ctx := r.Context()

	var body struct {
		CustomerID *string `json:"customerId"`
		Items      []struct {
			ProductID string  `json:"productId"`
			Name      string  `json:"productName"`
			Quantity  int     `json:"quantity"`
			UnitPrice float64 `json:"unitPrice"`
			Discount  float64 `json:"discountPercent"`
		} `json:"items"`
		Notes *string `json:"notes"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, 400, "Invalid request body.")
		return
	}

	if len(body.Items) == 0 {
		RespondError(w, 400, "At least one item is required.")
		return
	}

	// Verify scan job exists
	var sjStatus string
	err := h.DB.QueryRow(ctx, `SELECT status FROM scan_jobs WHERE id = $1`, scanJobID).Scan(&sjStatus)
	if err != nil {
		RespondError(w, 404, "Scan job not found.")
		return
	}

	// Generate quotation number
	now := time.Now()
	var seqCount int
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM quotations WHERE created_at::date = $1::date`, now).Scan(&seqCount)
	quotationNumber := fmt.Sprintf("QT-%s-%03d", now.Format("20060102"), seqCount+1)

	quotationID := uuid.New().String()

	// Calculate totals
	var subtotal float64
	for _, item := range body.Items {
		discountMultiplier := 1 - (item.Discount / 100)
		lineTotal := float64(item.Quantity) * item.UnitPrice * discountMultiplier
		subtotal += lineTotal
	}
	total := subtotal

	// Begin transaction
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		RespondError(w, 500, "Failed to start transaction.")
		return
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		`INSERT INTO quotations (id, quotation_number, customer_id, created_by_id, status, subtotal, discount_amount, total, notes, valid_until, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, 'DRAFT', $5, 0, $6, $7, $8, $9, $9)`,
		quotationID, quotationNumber, body.CustomerID, user.ID, subtotal, total, body.Notes,
		now.AddDate(0, 0, 30), now)
	if err != nil {
		RespondError(w, 500, "Failed to create quotation.")
		return
	}

	// Create items
	for _, item := range body.Items {
		discountMultiplier := 1 - (item.Discount / 100)
		lineTotal := float64(item.Quantity) * item.UnitPrice * discountMultiplier

		var prodID *string
		if item.ProductID != "" {
			prodID = &item.ProductID
		}

		_, err := tx.Exec(ctx,
			`INSERT INTO quotation_items (id, quotation_id, product_id, product_name, quantity, unit_price, discount_percent, line_total)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			uuid.New().String(), quotationID, prodID, item.Name, item.Quantity, item.UnitPrice, item.Discount, lineTotal)
		if err != nil {
			RespondError(w, 500, "Failed to create quotation items.")
			return
		}
	}

	// Link scan job to quotation
	tx.Exec(ctx, `UPDATE scan_jobs SET quotation_id = $1, status = 'CONVERTED' WHERE id = $2`, quotationID, scanJobID)

	if err := tx.Commit(ctx); err != nil {
		RespondError(w, 500, "Failed to commit quotation.")
		return
	}

	RespondJSON(w, 201, map[string]interface{}{
		"message":     "Quotation created from scan.",
		"quotationId": quotationID,
		"quotationNumber": quotationNumber,
	})
}

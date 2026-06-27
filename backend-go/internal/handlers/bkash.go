package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ─── bKash Sandbox API Integration ──────────────────

// bkashGrantToken obtains an access token from bKash sandbox.
func (h *Handler) bkashGrantToken() (string, error) {
	url := h.Cfg.BkashBaseURL + "/tokenized/checkout/token/grant"

	payload := map[string]string{
		"app_key":    h.Cfg.BkashAppKey,
		"app_secret": h.Cfg.BkashAppSecret,
	}
	jsonBody, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("failed to create grant token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("username", h.Cfg.BkashUsername)
	req.Header.Set("password", h.Cfg.BkashPassword)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("grant token request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result struct {
		StatusCode    string `json:"statusCode"`
		StatusMessage string `json:"statusMessage"`
		IDToken       string `json:"id_token"`
		TokenType     string `json:"token_type"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to parse grant token response: %w", err)
	}

	if result.IDToken == "" {
		return "", fmt.Errorf("bKash grant token failed: %s", string(body))
	}

	return result.IDToken, nil
}

// BkashCreatePayment handles POST /api/checkout/bkash/create
// Creates a bKash payment and returns the bkashURL for redirect.
func (h *Handler) BkashCreatePayment(w http.ResponseWriter, r *http.Request) {
	_ = GetUser(r) // Ensure authenticated

	var body struct {
		Amount float64 `json:"amount"`
	}
	if err := DecodeJSON(r, &body); err != nil || body.Amount <= 0 {
		RespondError(w, 400, "Invalid amount.")
		return
	}

	// Step 1: Get grant token
	idToken, err := h.bkashGrantToken()
	if err != nil {
		RespondError(w, 500, "Failed to connect to bKash: "+err.Error())
		return
	}

	// Step 2: Create payment
	createURL := h.Cfg.BkashBaseURL + "/tokenized/checkout/create"
	invoiceNumber := fmt.Sprintf("INV-%s-%03d", time.Now().Format("20060102150405"), randomInt(1, 999))
	callbackURL := h.Cfg.FrontendURL + "/checkout/bkash/callback"

	payload := map[string]string{
		"mode":                  "0011",
		"payerReference":        " ",
		"callbackURL":           callbackURL,
		"amount":                fmt.Sprintf("%.2f", body.Amount),
		"currency":              "BDT",
		"intent":                "sale",
		"merchantInvoiceNumber": invoiceNumber,
	}
	jsonBody, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", createURL, bytes.NewBuffer(jsonBody))
	if err != nil {
		RespondError(w, 500, "Failed to create bKash payment request.")
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", idToken)
	req.Header.Set("X-APP-Key", h.Cfg.BkashAppKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		RespondError(w, 500, "bKash create payment request failed.")
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	var createResult struct {
		StatusCode            string `json:"statusCode"`
		StatusMessage         string `json:"statusMessage"`
		PaymentID             string `json:"paymentID"`
		BkashURL              string `json:"bkashURL"`
		CallbackURL           string `json:"callbackURL"`
		SuccessCallbackURL    string `json:"successCallbackURL"`
		FailureCallbackURL    string `json:"failureCallbackURL"`
		CancelledCallbackURL  string `json:"cancelledCallbackURL"`
		Amount                string `json:"amount"`
		Intent                string `json:"intent"`
		Currency              string `json:"currency"`
		PaymentCreateTime     string `json:"paymentCreateTime"`
		TransactionStatus     string `json:"transactionStatus"`
		MerchantInvoiceNumber string `json:"merchantInvoiceNumber"`
	}
	if err := json.Unmarshal(respBody, &createResult); err != nil {
		RespondError(w, 500, "Failed to parse bKash response.")
		return
	}

	if createResult.PaymentID == "" || createResult.BkashURL == "" {
		RespondError(w, 500, fmt.Sprintf("bKash payment creation failed: %s", createResult.StatusMessage))
		return
	}

	RespondJSON(w, 200, map[string]interface{}{
		"bkashURL":  createResult.BkashURL,
		"paymentID": createResult.PaymentID,
	})
}

// BkashExecutePayment handles POST /api/checkout/bkash/execute
// Executes the bKash payment and places the order.
func (h *Handler) BkashExecutePayment(w http.ResponseWriter, r *http.Request) {
	user := GetUser(r)
	ctx := r.Context()

	var body struct {
		PaymentID string `json:"paymentID"`
		Items     []struct {
			ProductID string `json:"productId"`
			Quantity  int    `json:"quantity"`
		} `json:"items"`
		ShippingAddress string `json:"shippingAddress"`
		ShippingCity    string `json:"shippingCity"`
		ShippingPhone   string `json:"shippingPhone"`
		PromoCode       string `json:"promoCode"`
		Notes           string `json:"notes"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, 400, "Invalid request body.")
		return
	}

	if body.PaymentID == "" {
		RespondError(w, 400, "Payment ID is required.")
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

	// Step 1: Execute payment with bKash
	idToken, err := h.bkashGrantToken()
	if err != nil {
		RespondError(w, 500, "Failed to connect to bKash.")
		return
	}

	executeURL := h.Cfg.BkashBaseURL + "/tokenized/checkout/execute"
	payload := map[string]string{"paymentID": body.PaymentID}
	jsonBody, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", executeURL, bytes.NewBuffer(jsonBody))
	if err != nil {
		RespondError(w, 500, "Failed to create execute request.")
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", idToken)
	req.Header.Set("X-APP-Key", h.Cfg.BkashAppKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		RespondError(w, 500, "bKash execute payment request failed.")
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	var execResult struct {
		StatusCode            string `json:"statusCode"`
		StatusMessage         string `json:"statusMessage"`
		PaymentID             string `json:"paymentID"`
		TrxID                 string `json:"trxID"`
		TransactionStatus     string `json:"transactionStatus"`
		Amount                string `json:"amount"`
		Currency              string `json:"currency"`
		Intent                string `json:"intent"`
		MerchantInvoiceNumber string `json:"merchantInvoiceNumber"`
	}
	if err := json.Unmarshal(respBody, &execResult); err != nil {
		RespondError(w, 500, "Failed to parse bKash execute response.")
		return
	}

	if execResult.StatusCode != "0000" || execResult.TransactionStatus != "Completed" {
		RespondError(w, 400, fmt.Sprintf("bKash payment failed: %s", execResult.StatusMessage))
		return
	}

	// Step 2: Payment succeeded — place the order
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
	err = h.DB.QueryRow(ctx, `SELECT id FROM customers WHERE user_id = $1`, user.ID).Scan(&customerID)
	if err != nil {
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

	// Build notes with bKash TrxID
	var notes *string
	bkashNote := fmt.Sprintf("[bKash TrxID: %s]", execResult.TrxID)
	if body.Notes != "" {
		combined := bkashNote + " " + body.Notes
		notes = &combined
	} else {
		notes = &bkashNote
	}

	var shippingCity *string
	if body.ShippingCity != "" {
		shippingCity = &body.ShippingCity
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO orders (id, order_number, customer_id, shipping_address, shipping_city, shipping_phone, promo_code, subtotal, discount, shipping_fee, payment_method, order_type, status, total, notes, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'B2C', 'CONFIRMED', $12, $13, $14, $14)`,
		orderID, orderNumber, customerID, body.ShippingAddress, shippingCity, body.ShippingPhone,
		promoCodeStr, subtotal, discount, shippingFee, "BKASH", total, notes, now)
	if err != nil {
		RespondError(w, 500, "Failed to create order.")
		return
	}

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

	// Create timeline entries
	tx.Exec(ctx, `INSERT INTO order_timeline (id, order_id, status, note, created_at) VALUES ($1, $2, 'PENDING', 'Order placed via bKash', $3)`,
		uuid.New().String(), orderID, now)
	tx.Exec(ctx, `INSERT INTO order_timeline (id, order_id, status, note, created_at) VALUES ($1, $2, 'CONFIRMED', $3, $4)`,
		uuid.New().String(), orderID, fmt.Sprintf("Payment confirmed via bKash (TrxID: %s)", execResult.TrxID), now)

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
		"orderNumber": orderNumber, "total": total, "items": respItems, "paymentMethod": "BKASH",
	})
	go h.Email.SendAdminNewOrderEmail(map[string]interface{}{
		"orderNumber": orderNumber, "total": total, "customerName": user.Name, "itemCount": len(orderItems),
	})

	RespondJSON(w, 201, map[string]interface{}{
		"message": "Order placed successfully via bKash!",
		"order": map[string]interface{}{
			"id": orderID, "orderNumber": orderNumber, "status": "CONFIRMED", "total": total,
			"subtotal": subtotal, "discount": discount, "shippingFee": shippingFee,
			"bkashTrxId": execResult.TrxID,
		},
	})
}

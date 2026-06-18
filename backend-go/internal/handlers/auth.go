package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// ── Helpers ─────────────────────────────────────────

// generateOTP returns a random 6-digit string in [100000, 999999].
func generateOTP() (string, error) {
	// crypto/rand: range = 999999 - 100000 + 1 = 900000
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%d", n.Int64()+100000), nil
}

// generateReferralCode builds PREFIX(4 alpha)+SUFFIX(4 hex).
func generateReferralCode(name string) (string, error) {
	// Keep only ASCII letters, take first 4, uppercase.
	var alpha []rune
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') {
			alpha = append(alpha, r)
		}
		if len(alpha) == 4 {
			break
		}
	}
	prefix := strings.ToUpper(string(alpha))

	buf := make([]byte, 2)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	suffix := strings.ToUpper(hex.EncodeToString(buf))
	return prefix + suffix, nil
}

// generateJWT creates a signed JWT with {"userId": id}.
func (h *Handler) generateJWT(userID string) (string, error) {
	claims := jwt.MapClaims{
		"userId": userID,
		"exp":    time.Now().Add(h.Cfg.JWTExpiry).Unix(),
		"iat":    time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.Cfg.JWTSecret))
}

// ─── Register ────────────────────────────────────────

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email        string `json:"email"`
		Password     string `json:"password"`
		Name         string `json:"name"`
		Phone        string `json:"phone"`
		ReferralCode string `json:"referralCode"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body.")
		return
	}

	if body.Email == "" || body.Password == "" || body.Name == "" {
		RespondError(w, http.StatusBadRequest, "Email, password, and name are required.")
		return
	}
	if len(body.Password) < 6 {
		RespondError(w, http.StatusBadRequest, "Password must be at least 6 characters.")
		return
	}

	email := strings.ToLower(body.Email)
	ctx := r.Context()

	// Check existing user
	var existingID string
	err := h.DB.QueryRow(ctx,
		`SELECT id FROM users WHERE email = $1`, email,
	).Scan(&existingID)
	if err == nil {
		RespondError(w, http.StatusConflict, "An account with this email already exists.")
		return
	}

	// Validate referral code if provided
	var referrerID *string
	if body.ReferralCode != "" {
		var rid string
		err := h.DB.QueryRow(ctx,
			`SELECT id FROM users WHERE referral_code = $1`,
			strings.ToUpper(body.ReferralCode),
		).Scan(&rid)
		if err == nil {
			referrerID = &rid
		}
		// Don't fail registration if referral code is invalid, just ignore it
	}

	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 12)
	if err != nil {
		log.Println("bcrypt hash error:", err)
		RespondError(w, http.StatusInternalServerError, "Internal server error.")
		return
	}

	newReferralCode, err := generateReferralCode(body.Name)
	if err != nil {
		log.Println("referral code generation error:", err)
		RespondError(w, http.StatusInternalServerError, "Internal server error.")
		return
	}

	userID := uuid.New().String()

	var phone *string
	if body.Phone != "" {
		phone = &body.Phone
	}

	var userEmail string
	var userName, userRole string
	var userEmailVerified bool

	err = h.DB.QueryRow(ctx,
		`INSERT INTO users (id, email, password_hash, name, phone, role, email_verified, referral_code, referred_by_id)
		 VALUES ($1, $2, $3, $4, $5, 'CUSTOMER', false, $6, $7)
		 RETURNING id, email, name, role, email_verified`,
		userID, email, string(passwordHash), body.Name, phone, newReferralCode, referrerID,
	).Scan(&userID, &userEmail, &userName, &userRole, &userEmailVerified)
	if err != nil {
		log.Println("user creation error:", err)
		RespondError(w, http.StatusInternalServerError, "Failed to create account.")
		return
	}

	// Create referral record if user was referred
	if referrerID != nil {
		_, err := h.DB.Exec(ctx,
			`INSERT INTO referrals (id, referrer_id, referred_user_id) VALUES ($1, $2, $3)`,
			uuid.New().String(), *referrerID, userID,
		)
		if err != nil {
			log.Println("Referral creation failed:", err)
		}
	}

	token, err := h.generateJWT(userID)
	if err != nil {
		log.Println("JWT generation error:", err)
		RespondError(w, http.StatusInternalServerError, "Internal server error.")
		return
	}

	RespondJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Account created successfully.",
		"token":   token,
		"user": map[string]interface{}{
			"id":            userID,
			"email":         userEmail,
			"name":          userName,
			"role":          userRole,
			"emailVerified": userEmailVerified,
		},
	})
}

// ─── Verify OTP ──────────────────────────────────────

func (h *Handler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
		OTP   string `json:"otp"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body.")
		return
	}

	if body.Email == "" || body.OTP == "" {
		RespondError(w, http.StatusBadRequest, "Email and OTP are required.")
		return
	}

	email := strings.ToLower(body.Email)
	ctx := r.Context()

	var (
		userID        string
		userName      string
		emailVerified bool
		otpCode       *string
		otpExpiresAt  *time.Time
		otpAttempts   int
		referredByID  *string
	)
	err := h.DB.QueryRow(ctx,
		`SELECT id, name, email_verified, otp_code, otp_expires_at, otp_attempts, referred_by_id
		 FROM users WHERE email = $1`, email,
	).Scan(&userID, &userName, &emailVerified, &otpCode, &otpExpiresAt, &otpAttempts, &referredByID)
	if err != nil {
		RespondError(w, http.StatusNotFound, "User not found.")
		return
	}

	if emailVerified {
		RespondError(w, http.StatusBadRequest, "Email is already verified.")
		return
	}

	if otpCode == nil || *otpCode == "" {
		RespondError(w, http.StatusBadRequest, "No OTP found. Please request a new one.")
		return
	}

	// Check attempts
	if otpAttempts >= 5 {
		RespondError(w, http.StatusTooManyRequests, "Too many attempts. Please request a new OTP.")
		return
	}

	// Check expiry
	if otpExpiresAt != nil && time.Now().After(*otpExpiresAt) {
		RespondError(w, http.StatusBadRequest, "OTP has expired. Please request a new one.")
		return
	}

	// Verify OTP
	if err := bcrypt.CompareHashAndPassword([]byte(*otpCode), []byte(body.OTP)); err != nil {
		// Increment attempts
		h.DB.Exec(ctx,
			`UPDATE users SET otp_attempts = otp_attempts + 1 WHERE id = $1`, userID,
		)
		remaining := 5 - (otpAttempts + 1)
		RespondError(w, http.StatusBadRequest, fmt.Sprintf("Invalid OTP. %d attempt(s) remaining.", remaining))
		return
	}

	// Generate referral code for the user
	referralCode, err := generateReferralCode(userName)
	if err != nil {
		log.Println("referral code generation error:", err)
		RespondError(w, http.StatusInternalServerError, "Internal server error.")
		return
	}

	// Verify the user
	_, err = h.DB.Exec(ctx,
		`UPDATE users SET email_verified = true, otp_code = NULL, otp_expires_at = NULL,
		 otp_attempts = 0, verify_token = NULL, referral_code = $1
		 WHERE id = $2`,
		referralCode, userID,
	)
	if err != nil {
		log.Println("user update error:", err)
		RespondError(w, http.StatusInternalServerError, "Internal server error.")
		return
	}

	// Create referral record if user was referred
	if referredByID != nil {
		_, err := h.DB.Exec(ctx,
			`INSERT INTO referrals (id, referrer_id, referred_user_id) VALUES ($1, $2, $3)`,
			uuid.New().String(), *referredByID, userID,
		)
		if err != nil {
			log.Println("Referral creation failed:", err)
		}
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Email verified successfully! You can now log in.",
	})
}

// ─── Resend OTP ──────────────────────────────────────

func (h *Handler) ResendOTP(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body.")
		return
	}

	if body.Email == "" {
		RespondError(w, http.StatusBadRequest, "Email is required.")
		return
	}

	email := strings.ToLower(body.Email)
	ctx := r.Context()

	var (
		userID        string
		userName      string
		userEmail     string
		emailVerified bool
		otpExpiresAt  *time.Time
	)
	err := h.DB.QueryRow(ctx,
		`SELECT id, name, email, email_verified, otp_expires_at
		 FROM users WHERE email = $1`, email,
	).Scan(&userID, &userName, &userEmail, &emailVerified, &otpExpiresAt)
	if err != nil {
		RespondError(w, http.StatusNotFound, "User not found.")
		return
	}

	if emailVerified {
		RespondError(w, http.StatusBadRequest, "Email is already verified.")
		return
	}

	// Rate limit: check if last OTP was sent less than 60 seconds ago
	if otpExpiresAt != nil {
		// OTP was set to expire 5 minutes after creation, so creation time = expiresAt - 5min
		otpCreatedAt := otpExpiresAt.Add(-5 * time.Minute)
		otpAge := time.Since(otpCreatedAt)
		if otpAge < 60*time.Second {
			waitSeconds := int((60*time.Second - otpAge).Seconds()) + 1
			RespondError(w, http.StatusTooManyRequests,
				fmt.Sprintf("Please wait %d seconds before requesting a new OTP.", waitSeconds))
			return
		}
	}

	otp, err := generateOTP()
	if err != nil {
		log.Println("OTP generation error:", err)
		RespondError(w, http.StatusInternalServerError, "Internal server error.")
		return
	}

	otpHash, err := bcrypt.GenerateFromPassword([]byte(otp), 10)
	if err != nil {
		log.Println("bcrypt hash error:", err)
		RespondError(w, http.StatusInternalServerError, "Internal server error.")
		return
	}

	expiresAt := time.Now().Add(5 * time.Minute)

	_, err = h.DB.Exec(ctx,
		`UPDATE users SET otp_code = $1, otp_expires_at = $2, otp_attempts = 0 WHERE id = $3`,
		string(otpHash), expiresAt, userID,
	)
	if err != nil {
		log.Println("user update error:", err)
		RespondError(w, http.StatusInternalServerError, "Internal server error.")
		return
	}

	go h.Email.SendOTPEmail(userEmail, userName, otp)

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "New verification code sent to your email.",
	})
}

// ─── Login ───────────────────────────────────────────

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body.")
		return
	}

	if body.Email == "" || body.Password == "" {
		RespondError(w, http.StatusBadRequest, "Email and password are required.")
		return
	}

	email := strings.ToLower(body.Email)
	ctx := r.Context()

	var (
		userID        string
		userEmail     string
		userName      string
		userRole      string
		emailVerified bool
		passwordHash  string
	)
	err := h.DB.QueryRow(ctx,
		`SELECT id, email, name, role, email_verified, password_hash
		 FROM users WHERE email = $1`, email,
	).Scan(&userID, &userEmail, &userName, &userRole, &emailVerified, &passwordHash)
	if err != nil {
		RespondError(w, http.StatusUnauthorized, "Invalid email or password.")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(body.Password)); err != nil {
		RespondError(w, http.StatusUnauthorized, "Invalid email or password.")
		return
	}

	token, err := h.generateJWT(userID)
	if err != nil {
		log.Println("JWT generation error:", err)
		RespondError(w, http.StatusInternalServerError, "Internal server error.")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Login successful.",
		"token":   token,
		"user": map[string]interface{}{
			"id":            userID,
			"email":         userEmail,
			"name":          userName,
			"role":          userRole,
			"emailVerified": emailVerified,
		},
	})
}

// ─── Get Current User ────────────────────────────────

func (h *Handler) GetMe(w http.ResponseWriter, r *http.Request) {
	user := GetUser(r)
	if user == nil {
		RespondError(w, http.StatusUnauthorized, "Not authenticated.")
		return
	}
	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"user": user,
	})
}

// ─── Forgot Password ─────────────────────────────────

func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body.")
		return
	}

	if body.Email == "" {
		RespondError(w, http.StatusBadRequest, "Email is required.")
		return
	}

	email := strings.ToLower(body.Email)
	ctx := r.Context()

	successMsg := "If an account exists with this email, a reset code has been sent."

	var (
		userID    string
		userName  string
		userEmail string
	)
	err := h.DB.QueryRow(ctx,
		`SELECT id, name, email FROM users WHERE email = $1`, email,
	).Scan(&userID, &userName, &userEmail)
	if err != nil {
		// Don't reveal whether email exists
		RespondJSON(w, http.StatusOK, map[string]string{"message": successMsg})
		return
	}

	otp, err := generateOTP()
	if err != nil {
		log.Println("OTP generation error:", err)
		RespondError(w, http.StatusInternalServerError, "Internal server error.")
		return
	}

	otpHash, err := bcrypt.GenerateFromPassword([]byte(otp), 10)
	if err != nil {
		log.Println("bcrypt hash error:", err)
		RespondError(w, http.StatusInternalServerError, "Internal server error.")
		return
	}

	resetExpires := time.Now().Add(10 * time.Minute)

	_, err = h.DB.Exec(ctx,
		`UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3`,
		string(otpHash), resetExpires, userID,
	)
	if err != nil {
		log.Println("user update error:", err)
		RespondError(w, http.StatusInternalServerError, "Internal server error.")
		return
	}

	go h.Email.SendPasswordResetEmail(userEmail, userName, otp)

	RespondJSON(w, http.StatusOK, map[string]string{"message": successMsg})
}

// ─── Verify Reset OTP ────────────────────────────────

func (h *Handler) VerifyResetOTP(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
		OTP   string `json:"otp"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body.")
		return
	}

	if body.Email == "" || body.OTP == "" {
		RespondError(w, http.StatusBadRequest, "Email and OTP are required.")
		return
	}

	email := strings.ToLower(body.Email)
	ctx := r.Context()

	var (
		resetToken   *string
		resetExpires *time.Time
	)
	err := h.DB.QueryRow(ctx,
		`SELECT reset_token, reset_expires FROM users WHERE email = $1`, email,
	).Scan(&resetToken, &resetExpires)
	if err != nil || resetToken == nil {
		RespondError(w, http.StatusBadRequest, "Invalid or expired reset code.")
		return
	}

	if resetExpires != nil && time.Now().After(*resetExpires) {
		RespondError(w, http.StatusBadRequest, "Reset code has expired. Please request a new one.")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*resetToken), []byte(body.OTP)); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid reset code.")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"message":  "OTP verified successfully.",
		"verified": true,
	})
}

// ─── Reset Password ──────────────────────────────────

func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email       string `json:"email"`
		OTP         string `json:"otp"`
		NewPassword string `json:"newPassword"`
	}
	if err := DecodeJSON(r, &body); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body.")
		return
	}

	if body.Email == "" || body.OTP == "" || body.NewPassword == "" {
		RespondError(w, http.StatusBadRequest, "Email, OTP, and new password are required.")
		return
	}
	if len(body.NewPassword) < 6 {
		RespondError(w, http.StatusBadRequest, "Password must be at least 6 characters.")
		return
	}

	email := strings.ToLower(body.Email)
	ctx := r.Context()

	var (
		userID       string
		resetToken   *string
		resetExpires *time.Time
	)
	err := h.DB.QueryRow(ctx,
		`SELECT id, reset_token, reset_expires FROM users WHERE email = $1`, email,
	).Scan(&userID, &resetToken, &resetExpires)
	if err != nil || resetToken == nil {
		RespondError(w, http.StatusBadRequest, "Invalid or expired reset code.")
		return
	}

	if resetExpires != nil && time.Now().After(*resetExpires) {
		RespondError(w, http.StatusBadRequest, "Reset code has expired. Please request a new one.")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*resetToken), []byte(body.OTP)); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid reset code.")
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), 12)
	if err != nil {
		log.Println("bcrypt hash error:", err)
		RespondError(w, http.StatusInternalServerError, "Internal server error.")
		return
	}

	_, err = h.DB.Exec(ctx,
		`UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2`,
		string(newHash), userID,
	)
	if err != nil {
		log.Println("user update error:", err)
		RespondError(w, http.StatusInternalServerError, "Internal server error.")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Password reset successfully. You can now log in with your new password.",
	})
}


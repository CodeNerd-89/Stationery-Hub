package handlers

import (
	"fmt"
	"net/http"
)

// ─── Get My Referral Code & Stats ────────────────────

func (h *Handler) GetMyReferralCode(w http.ResponseWriter, r *http.Request) {
	user := GetUser(r)
	if user == nil {
		RespondError(w, http.StatusUnauthorized, "Not authenticated.")
		return
	}

	ctx := r.Context()

	// Get user's referral code
	var referralCode *string
	err := h.DB.QueryRow(ctx,
		`SELECT referral_code FROM users WHERE id = $1`, user.ID,
	).Scan(&referralCode)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Failed to fetch referral code.")
		return
	}

	// Count referrals where referrer_id = user.id
	var referralCount int
	err = h.DB.QueryRow(ctx,
		`SELECT COUNT(*) FROM referrals WHERE referrer_id = $1`, user.ID,
	).Scan(&referralCount)
	if err != nil {
		referralCount = 0
	}

	code := ""
	if referralCode != nil {
		code = *referralCode
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"referralCode":  code,
		"referralCount": referralCount,
		"referralLink":  fmt.Sprintf("%s/register?ref=%s", h.Cfg.FrontendURL, code),
	})
}

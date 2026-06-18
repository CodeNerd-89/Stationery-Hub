package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"stationery-hub-backend/internal/config"
	"stationery-hub-backend/internal/models"
	"stationery-hub-backend/internal/services"
)

// Handler holds shared dependencies for all route handlers.
type Handler struct {
	DB    *pgxpool.Pool
	Cfg   *config.Config
	Email *services.EmailService
}

// RespondJSON writes a JSON response with the given status code.
func RespondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

// RespondError writes a JSON error response: {"error": "message"}.
func RespondError(w http.ResponseWriter, status int, message string) {
	RespondJSON(w, status, map[string]string{"error": message})
}

// GetUser extracts the authenticated user from the request context.
func GetUser(r *http.Request) *models.User {
	user, _ := r.Context().Value(models.UserContextKey).(*models.User)
	return user
}

// DecodeJSON decodes the request body into the given target.
func DecodeJSON(r *http.Request, target interface{}) error {
	decoder := json.NewDecoder(r.Body)
	return decoder.Decode(target)
}

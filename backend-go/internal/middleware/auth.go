package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"stationery-hub-backend/internal/models"
)

// Authenticate verifies the JWT from the Authorization header and loads the user.
func Authenticate(db *pgxpool.Pool, jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				writeError(w, 401, "Access denied. No token provided.")
				return
			}

			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

			claims := jwt.MapClaims{}
			token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
				return []byte(jwtSecret), nil
			})

			if err != nil || !token.Valid {
				if err != nil && strings.Contains(err.Error(), "expired") {
					writeError(w, 401, "Token expired. Please login again.")
					return
				}
				writeError(w, 401, "Invalid token.")
				return
			}

			userID, ok := claims["userId"].(string)
			if !ok || userID == "" {
				writeError(w, 401, "Invalid token.")
				return
			}

			var user models.User
			err = db.QueryRow(r.Context(),
				`SELECT id, email, name, role, email_verified, phone FROM users WHERE id = $1`,
				userID,
			).Scan(&user.ID, &user.Email, &user.Name, &user.Role, &user.EmailVerified, &user.Phone)

			if err != nil {
				writeError(w, 401, "Invalid token. User not found.")
				return
			}

			ctx := context.WithValue(r.Context(), models.UserContextKey, &user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// Authorize checks that the authenticated user has one of the required roles.
func Authorize(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(models.UserContextKey).(*models.User)
			if !ok || user == nil {
				writeError(w, 401, "Access denied.")
				return
			}

			allowed := false
			for _, role := range roles {
				if user.Role == role {
					allowed = true
					break
				}
			}

			if !allowed {
				writeError(w, 403, "Access denied. Required role: "+strings.Join(roles, " or "))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

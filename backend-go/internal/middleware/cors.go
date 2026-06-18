package middleware

import (
	"net/http"

	"github.com/go-chi/cors"
)

// CORSMiddleware returns CORS middleware configured for the frontend URL.
func CORSMiddleware(frontendURL string) func(http.Handler) http.Handler {
	return cors.Handler(cors.Options{
		AllowedOrigins:   []string{frontendURL},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Requested-With"},
		ExposedHeaders:   []string{"Content-Disposition", "Content-Length"},
		AllowCredentials: true,
		MaxAge:           300,
	})
}

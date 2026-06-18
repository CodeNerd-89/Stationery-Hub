package middleware

import (
	"log"
	"net/http"
	"runtime/debug"
)

// Recoverer catches panics and returns a 500 error.
func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("Panic: %v\n%s", err, debug.Stack())
				writeError(w, 500, "Internal server error.")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"stationery-hub-backend/internal/config"
	"stationery-hub-backend/internal/router"
)

func main() {
	cfg := config.Load()
	db := config.NewDBPool(cfg)
	defer db.Close()

	// Auto-create tables if they don't exist (idempotent)
	config.RunMigrations(db)

	// Ensure uploads directory exists
	if err := os.MkdirAll("./uploads", 0755); err != nil {
		log.Printf("Warning: could not create uploads directory: %v", err)
	}

	r := router.Setup(db, cfg)

	addr := fmt.Sprintf(":%d", cfg.Port)
	fmt.Printf("\n  🏪 Stationery Hub API running on http://localhost%s\n", addr)
	fmt.Printf("  📦 Environment: %s\n\n", cfg.Env)

	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal(err)
	}
}

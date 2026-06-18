package config

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewDBPool(cfg *Config) *pgxpool.Pool {
	// Remove Prisma-specific parameters (e.g. ?schema=public) from the URL
	dbURL := cfg.DatabaseURL
	if idx := strings.Index(dbURL, "?schema="); idx != -1 {
		dbURL = dbURL[:idx]
	}

	poolConfig, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Fatalf("Unable to parse database URL: %v", err)
	}

	poolConfig.MaxConns = 20
	poolConfig.MinConns = 2
	poolConfig.MaxConnLifetime = time.Hour
	poolConfig.MaxConnIdleTime = 30 * time.Minute

	ctx := context.Background()
	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		log.Fatalf("Unable to create connection pool: %v", err)
	}

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}

	fmt.Println("  📦 Connected to PostgreSQL database")
	return pool
}

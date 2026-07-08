package config

import (
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        int
	Env         string
	DatabaseURL string
	JWTSecret   string
	JWTExpiry   time.Duration
	SMTPHost    string
	SMTPPort    int
	SMTPUser    string
	SMTPPass    string
	SMTPFrom    string
	FrontendURL string
	// Resend (HTTP email API — used in production)
	ResendAPIKey string
	ResendFrom   string
	// bKash Sandbox
	BkashBaseURL   string
	BkashUsername  string
	BkashPassword  string
	BkashAppKey    string
	BkashAppSecret string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	port, _ := strconv.Atoi(getEnv("PORT", "5000"))
	smtpPort, _ := strconv.Atoi(getEnv("SMTP_PORT", "587"))

	return &Config{
		Port:        port,
		Env:         getEnv("ENV", getEnv("NODE_ENV", "development")),
		DatabaseURL: getEnv("DATABASE_URL", ""),
		JWTSecret:   getEnv("JWT_SECRET", "secret"),
		JWTExpiry:   parseDuration(getEnv("JWT_EXPIRES_IN", "7d")),
		SMTPHost:    getEnv("SMTP_HOST", ""),
		SMTPPort:    smtpPort,
		SMTPUser:    getEnv("SMTP_USER", ""),
		SMTPPass:    getEnv("SMTP_PASS", ""),
		SMTPFrom:    getEnv("SMTP_FROM", ""),
		FrontendURL:    getEnv("FRONTEND_URL", "http://localhost:5173"),
		ResendAPIKey:   getEnv("RESEND_API_KEY", ""),
		ResendFrom:     getEnv("RESEND_FROM", "Stationery Hub <onboarding@resend.dev>"),
		BkashBaseURL:   getEnv("BKASH_BASE_URL", "https://tokenized.sandbox.bka.sh/v1.2.0-beta"),
		BkashUsername:  getEnv("BKASH_USERNAME", ""),
		BkashPassword:  getEnv("BKASH_PASSWORD", ""),
		BkashAppKey:    getEnv("BKASH_APP_KEY", ""),
		BkashAppSecret: getEnv("BKASH_APP_SECRET", ""),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

// parseDuration handles "7d", "24h", "30m" etc.
func parseDuration(s string) time.Duration {
	s = strings.TrimSpace(s)
	if strings.HasSuffix(s, "d") {
		days, err := strconv.Atoi(strings.TrimSuffix(s, "d"))
		if err == nil {
			return time.Duration(days) * 24 * time.Hour
		}
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return 7 * 24 * time.Hour // Default: 7 days
	}
	return d
}

package config

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

// RunMigrations creates all database tables and types if they don't exist.
// This is safe to run multiple times (idempotent).
func RunMigrations(pool *pgxpool.Pool) {
	ctx := context.Background()

	// Each statement uses IF NOT EXISTS so it's safe to re-run
	statements := []string{
		// ─── Enum Types ───
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF', 'CUSTOMER'); END IF; END $$`,
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QuotationStatus') THEN CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'); END IF; END $$`,
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderStatus') THEN CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'); END IF; END $$`,
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScanStatus') THEN CREATE TYPE "ScanStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED', 'CONVERTED', 'ERROR'); END IF; END $$`,
		// Add missing enum values to existing databases
		`DO $$ BEGIN ALTER TYPE "ScanStatus" ADD VALUE IF NOT EXISTS 'CONVERTED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TYPE "ScanStatus" ADD VALUE IF NOT EXISTS 'ERROR'; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiscountType') THEN CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED'); END IF; END $$`,

		// ─── Tables ───
		`CREATE TABLE IF NOT EXISTS "users" (
			"id" TEXT NOT NULL,
			"email" TEXT NOT NULL,
			"password_hash" TEXT NOT NULL,
			"name" TEXT NOT NULL,
			"role" "Role" NOT NULL DEFAULT 'CUSTOMER',
			"email_verified" BOOLEAN NOT NULL DEFAULT false,
			"verify_token" TEXT,
			"reset_token" TEXT,
			"reset_expires" TIMESTAMP(3),
			"phone" TEXT,
			"otp_code" TEXT,
			"otp_expires_at" TIMESTAMP(3),
			"otp_attempts" INTEGER NOT NULL DEFAULT 0,
			"referral_code" TEXT,
			"referred_by_id" TEXT,
			"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "users_pkey" PRIMARY KEY ("id")
		)`,

		`CREATE TABLE IF NOT EXISTS "categories" (
			"id" TEXT NOT NULL,
			"name" TEXT NOT NULL,
			"slug" TEXT NOT NULL,
			"description" TEXT,
			"image_url" TEXT,
			"sort_order" INTEGER NOT NULL DEFAULT 0,
			"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
		)`,

		`CREATE TABLE IF NOT EXISTS "products" (
			"id" TEXT NOT NULL,
			"name" TEXT NOT NULL,
			"slug" TEXT NOT NULL,
			"sku" TEXT NOT NULL,
			"category_id" TEXT NOT NULL,
			"description" TEXT,
			"price" DECIMAL(10,2) NOT NULL,
			"stock" INTEGER NOT NULL DEFAULT 0,
			"unit" TEXT NOT NULL DEFAULT 'pc',
			"image_url" TEXT,
			"is_active" BOOLEAN NOT NULL DEFAULT true,
			"average_rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
			"review_count" INTEGER NOT NULL DEFAULT 0,
			"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "products_pkey" PRIMARY KEY ("id")
		)`,

		`CREATE TABLE IF NOT EXISTS "customers" (
			"id" TEXT NOT NULL,
			"user_id" TEXT,
			"company_name" TEXT,
			"contact_person" TEXT NOT NULL,
			"phone" TEXT,
			"email" TEXT,
			"address" TEXT,
			"notes" TEXT,
			"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
		)`,

		`CREATE TABLE IF NOT EXISTS "quotations" (
			"id" TEXT NOT NULL,
			"quotation_number" TEXT NOT NULL,
			"customer_id" TEXT,
			"created_by_id" TEXT NOT NULL,
			"status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
			"subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
			"discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
			"total" DECIMAL(10,2) NOT NULL DEFAULT 0,
			"notes" TEXT,
			"valid_until" TIMESTAMP(3),
			"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
		)`,

		`CREATE TABLE IF NOT EXISTS "quotation_items" (
			"id" TEXT NOT NULL,
			"quotation_id" TEXT NOT NULL,
			"product_id" TEXT,
			"product_name" TEXT NOT NULL,
			"quantity" INTEGER NOT NULL,
			"unit_price" DECIMAL(10,2) NOT NULL,
			"discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
			"line_total" DECIMAL(10,2) NOT NULL,
			"notes" TEXT,
			CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
		)`,

		`CREATE TABLE IF NOT EXISTS "orders" (
			"id" TEXT NOT NULL,
			"order_number" TEXT NOT NULL,
			"quotation_id" TEXT,
			"customer_id" TEXT NOT NULL,
			"shipping_address" TEXT,
			"shipping_city" TEXT,
			"shipping_phone" TEXT,
			"promo_code" TEXT,
			"subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
			"discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
			"shipping_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
			"payment_method" TEXT NOT NULL DEFAULT 'COD',
			"order_type" TEXT NOT NULL DEFAULT 'B2C',
			"status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
			"total" DECIMAL(10,2) NOT NULL,
			"notes" TEXT,
			"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
		)`,

		`CREATE TABLE IF NOT EXISTS "scan_jobs" (
			"id" TEXT NOT NULL,
			"uploaded_by_id" TEXT NOT NULL,
			"file_url" TEXT NOT NULL,
			"file_type" TEXT NOT NULL,
			"raw_text" TEXT,
			"extracted_items" JSONB,
			"status" "ScanStatus" NOT NULL DEFAULT 'PROCESSING',
			"quotation_id" TEXT,
			"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "scan_jobs_pkey" PRIMARY KEY ("id")
		)`,

		`CREATE TABLE IF NOT EXISTS "promo_codes" (
			"id" TEXT NOT NULL,
			"code" TEXT NOT NULL,
			"discount_type" "DiscountType" NOT NULL,
			"discount_value" DECIMAL(10,2) NOT NULL,
			"min_order_amount" DECIMAL(10,2),
			"valid_from" TIMESTAMP(3) NOT NULL,
			"valid_until" TIMESTAMP(3) NOT NULL,
			"usage_limit" INTEGER,
			"used_count" INTEGER NOT NULL DEFAULT 0,
			"is_active" BOOLEAN NOT NULL DEFAULT true,
			"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
		)`,

		`CREATE TABLE IF NOT EXISTS "order_items" (
			"id" TEXT NOT NULL,
			"order_id" TEXT NOT NULL,
			"product_id" TEXT NOT NULL,
			"product_name" TEXT NOT NULL,
			"quantity" INTEGER NOT NULL,
			"unit_price" DECIMAL(10,2) NOT NULL,
			"line_total" DECIMAL(10,2) NOT NULL,
			CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
		)`,

		`CREATE TABLE IF NOT EXISTS "order_timeline" (
			"id" TEXT NOT NULL,
			"order_id" TEXT NOT NULL,
			"status" "OrderStatus" NOT NULL,
			"note" TEXT,
			"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "order_timeline_pkey" PRIMARY KEY ("id")
		)`,

		`CREATE TABLE IF NOT EXISTS "reviews" (
			"id" TEXT NOT NULL,
			"user_id" TEXT NOT NULL,
			"product_id" TEXT NOT NULL,
			"rating" INTEGER NOT NULL,
			"title" TEXT,
			"comment" TEXT,
			"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
		)`,

		`CREATE TABLE IF NOT EXISTS "wishlists" (
			"id" TEXT NOT NULL,
			"user_id" TEXT NOT NULL,
			"product_id" TEXT NOT NULL,
			"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
		)`,

		`CREATE TABLE IF NOT EXISTS "referrals" (
			"id" TEXT NOT NULL,
			"referrer_id" TEXT NOT NULL,
			"referred_user_id" TEXT NOT NULL,
			"reward_given" BOOLEAN NOT NULL DEFAULT false,
			"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
		)`,

		// ─── Unique Indexes ───
		`CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_key" ON "users"("referral_code")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_key" ON "categories"("slug")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "products_slug_key" ON "products"("slug")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "products_sku_key" ON "products"("sku")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "customers_user_id_key" ON "customers"("user_id")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "quotations_quotation_number_key" ON "quotations"("quotation_number")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_key" ON "orders"("order_number")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "orders_quotation_id_key" ON "orders"("quotation_id")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "scan_jobs_quotation_id_key" ON "scan_jobs"("quotation_id")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_key" ON "promo_codes"("code")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "reviews_user_id_product_id_key" ON "reviews"("user_id", "product_id")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "wishlists_user_id_product_id_key" ON "wishlists"("user_id", "product_id")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "referrals_referred_user_id_key" ON "referrals"("referred_user_id")`,

		// ─── Foreign Keys (use DO $$ to skip if already exists) ───
		`DO $$ BEGIN ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "orders" ADD CONSTRAINT "orders_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "order_timeline" ADD CONSTRAINT "order_timeline_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`DO $$ BEGIN ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
	}

	for i, stmt := range statements {
		if _, err := pool.Exec(ctx, stmt); err != nil {
			log.Fatalf("Migration statement %d failed: %v", i+1, err)
		}
	}

	fmt.Println("  ✅ Database migrations completed successfully")
}

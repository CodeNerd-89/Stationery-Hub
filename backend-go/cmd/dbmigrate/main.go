package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"stationery-hub-backend/internal/config"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run ./cmd/dbmigrate <database-url> [backup-file]")
		os.Exit(1)
	}

	dbURL := os.Args[1]
	ctx := context.Background()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatal("Failed to connect:", err)
	}
	defer pool.Close()

	fmt.Println("✅ Connected to Neon database!")

	// Run migrations
	fmt.Println("\n═══ Running Migrations ═══")
	config.RunMigrations(pool)
	fmt.Println("✅ Migrations complete!")

	// If backup file provided, restore data
	if len(os.Args) >= 3 {
		backupFile := os.Args[2]
		fmt.Printf("\n═══ Restoring data from %s ═══\n", backupFile)

		data, err := os.ReadFile(backupFile)
		if err != nil {
			log.Fatal("Failed to read backup:", err)
		}

		var backup map[string][]map[string]interface{}
		if err := json.Unmarshal(data, &backup); err != nil {
			log.Fatal("Failed to parse backup:", err)
		}

		// Restore users
		users := backup["users"]
		fmt.Printf("  Restoring %d users...\n", len(users))
		for _, u := range users {
			_, err := pool.Exec(ctx, `
				INSERT INTO users (id, email, password_hash, name, phone, role, email_verified, referral_code, referred_by_id, reset_token, reset_expires, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
				ON CONFLICT (id) DO NOTHING`,
				u["id"], u["email"], u["password_hash"], u["name"], u["phone"],
				u["role"], u["email_verified"], u["referral_code"], u["referred_by_id"],
				u["reset_token"], u["reset_expires"], u["created_at"], u["updated_at"])
			if err != nil {
				log.Printf("  ⚠ User %v: %v", u["email"], err)
			}
		}

		// Restore categories (from seed since backup had 0 - they come from products' category_id)
		// Let's get unique categories from products
		fmt.Println("  Running seed for categories and products...")
		config.RunSeed(pool)

		// Restore customers
		customers := backup["customers"]
		fmt.Printf("  Restoring %d customers...\n", len(customers))
		for _, c := range customers {
			_, err := pool.Exec(ctx, `
				INSERT INTO customers (id, user_id, email, contact_person, company_name, phone, address, city, created_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				ON CONFLICT (id) DO NOTHING`,
				c["id"], c["user_id"], c["email"], c["contact_person"], c["company_name"],
				c["phone"], c["address"], c["city"], c["created_at"])
			if err != nil {
				log.Printf("  ⚠ Customer %v: %v", c["id"], err)
			}
		}

		// Restore orders
		orders := backup["orders"]
		fmt.Printf("  Restoring %d orders...\n", len(orders))
		for _, o := range orders {
			_, err := pool.Exec(ctx, `
				INSERT INTO orders (id, order_number, customer_id, promo_code, subtotal, discount, shipping_fee, payment_method, order_type, status, total, notes, shipping_phone, shipping_address, shipping_city, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
				ON CONFLICT (id) DO NOTHING`,
				o["id"], o["order_number"], o["customer_id"], o["promo_code"],
				o["subtotal"], o["discount"], o["shipping_fee"], o["payment_method"],
				o["order_type"], o["status"], o["total"], o["notes"],
				o["shipping_phone"], o["shipping_address"], o["shipping_city"],
				o["created_at"], o["updated_at"])
			if err != nil {
				log.Printf("  ⚠ Order %v: %v", o["order_number"], err)
			}
		}

		// Restore order items
		items := backup["order_items"]
		fmt.Printf("  Restoring %d order items...\n", len(items))
		for _, i := range items {
			_, err := pool.Exec(ctx, `
				INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, line_total)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
				ON CONFLICT (id) DO NOTHING`,
				i["id"], i["order_id"], i["product_id"], i["product_name"],
				i["unit_price"], i["quantity"], i["line_total"])
			if err != nil {
				log.Printf("  ⚠ Order item %v: %v", i["id"], err)
			}
		}

		fmt.Println("\n🎉 Data restoration complete!")
	}

	// Verify
	fmt.Println("\n═══ Verification ═══")
	tables := []string{"users", "products", "categories", "orders", "customers"}
	for _, t := range tables {
		var count int
		pool.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", t)).Scan(&count)
		fmt.Printf("  %-15s  %d rows\n", t, count)
	}
}

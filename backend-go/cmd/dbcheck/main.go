package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dbURL := os.Args[1]
	ctx := context.Background()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatal("Failed to connect:", err)
	}
	defer pool.Close()

	fmt.Println("✅ Connected to database!\n")

	// List all tables
	fmt.Println("═══ TABLES ═══")
	rows, _ := pool.Query(ctx, `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`)
	for rows.Next() {
		var name string
		rows.Scan(&name)
		fmt.Println("  •", name)
	}
	rows.Close()

	// Users summary
	fmt.Println("\n═══ USERS ═══")
	rows, _ = pool.Query(ctx, `SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC`)
	fmt.Printf("  %-36s  %-30s  %-20s  %-10s  %s\n", "ID", "EMAIL", "NAME", "ROLE", "CREATED")
	fmt.Println("  " + repeat("─", 130))
	for rows.Next() {
		var id, email, name, role string
		var created interface{}
		rows.Scan(&id, &email, &name, &role, &created)
		fmt.Printf("  %-36s  %-30s  %-20s  %-10s  %v\n", id, email, name, role, created)
	}
	rows.Close()

	// Products count by category
	fmt.Println("\n═══ PRODUCTS BY CATEGORY ═══")
	rows, _ = pool.Query(ctx, `SELECT c.name, COUNT(p.id) as cnt FROM categories c LEFT JOIN products p ON p.category_id = c.id GROUP BY c.name ORDER BY c.name`)
	for rows.Next() {
		var catName string
		var cnt int
		rows.Scan(&catName, &cnt)
		fmt.Printf("  %-30s  %d products\n", catName, cnt)
	}
	rows.Close()

	// Orders summary
	fmt.Println("\n═══ RECENT ORDERS ═══")
	rows, _ = pool.Query(ctx, `SELECT o.order_number, o.status, o.total, o.payment_method, o.created_at, u.name as customer FROM orders o LEFT JOIN customers c ON o.customer_id = c.id LEFT JOIN users u ON c.user_id = u.id ORDER BY o.created_at DESC LIMIT 10`)
	fmt.Printf("  %-15s  %-12s  %-10s  %-15s  %-20s  %s\n", "ORDER#", "STATUS", "TOTAL", "PAYMENT", "DATE", "CUSTOMER")
	fmt.Println("  " + repeat("─", 100))
	for rows.Next() {
		var orderNum, status, pm string
		var total float64
		var created, customer interface{}
		rows.Scan(&orderNum, &status, &total, &pm, &created, &customer)
		custName := ""
		if customer != nil {
			custName = fmt.Sprintf("%v", customer)
		}
		fmt.Printf("  %-15s  %-12s  ৳%-9.0f  %-15s  %-20v  %s\n", orderNum, status, total, pm, created, custName)
	}
	rows.Close()

	// Counts summary
	fmt.Println("\n═══ TOTALS ═══")
	tables := []string{"users", "products", "categories", "orders", "customers", "reviews"}
	for _, t := range tables {
		var count int
		pool.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", t)).Scan(&count)
		fmt.Printf("  %-15s  %d\n", t, count)
	}
}

func repeat(s string, n int) string {
	result := ""
	for i := 0; i < n; i++ {
		result += s
	}
	return result
}

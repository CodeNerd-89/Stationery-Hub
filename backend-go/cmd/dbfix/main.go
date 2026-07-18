package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	if len(os.Args) < 3 {
		fmt.Println("Usage: go run ./cmd/dbfix <source-url> <dest-url>")
		os.Exit(1)
	}

	sourceURL := os.Args[1]
	destURL := os.Args[2]
	ctx := context.Background()

	// Connect to source (Render)
	src, err := pgxpool.New(ctx, sourceURL)
	if err != nil {
		log.Fatal("Failed to connect to source:", err)
	}
	defer src.Close()
	fmt.Println("✅ Connected to Render (source)")

	// Connect to dest (Neon)
	dst, err := pgxpool.New(ctx, destURL)
	if err != nil {
		log.Fatal("Failed to connect to dest:", err)
	}
	defer dst.Close()
	fmt.Println("✅ Connected to Neon (destination)")

	// Copy customers
	fmt.Println("\n═══ Copying customers ═══")
	rows, err := src.Query(ctx, `SELECT * FROM customers`)
	if err != nil {
		log.Fatal("Failed to query customers:", err)
	}
	custCount := 0
	for rows.Next() {
		vals, _ := rows.Values()
		cols := rows.FieldDescriptions()
		
		// Build dynamic insert
		placeholders := ""
		colNames := ""
		for i, col := range cols {
			if i > 0 {
				placeholders += ", "
				colNames += ", "
			}
			placeholders += fmt.Sprintf("$%d", i+1)
			colNames += string(col.Name)
		}
		
		_, err := dst.Exec(ctx, fmt.Sprintf("INSERT INTO customers (%s) VALUES (%s) ON CONFLICT (id) DO NOTHING", colNames, placeholders), vals...)
		if err != nil {
			log.Printf("  ⚠ Customer: %v", err)
		} else {
			custCount++
		}
	}
	rows.Close()
	fmt.Printf("  ✅ Copied %d customers\n", custCount)

	// Copy orders
	fmt.Println("\n═══ Copying orders ═══")
	rows, err = src.Query(ctx, `SELECT * FROM orders ORDER BY created_at`)
	if err != nil {
		log.Fatal("Failed to query orders:", err)
	}
	orderCount := 0
	for rows.Next() {
		vals, _ := rows.Values()
		cols := rows.FieldDescriptions()
		
		placeholders := ""
		colNames := ""
		for i, col := range cols {
			if i > 0 {
				placeholders += ", "
				colNames += ", "
			}
			placeholders += fmt.Sprintf("$%d", i+1)
			colNames += string(col.Name)
		}
		
		_, err := dst.Exec(ctx, fmt.Sprintf("INSERT INTO orders (%s) VALUES (%s) ON CONFLICT (id) DO NOTHING", colNames, placeholders), vals...)
		if err != nil {
			log.Printf("  ⚠ Order: %v", err)
		} else {
			orderCount++
		}
	}
	rows.Close()
	fmt.Printf("  ✅ Copied %d orders\n", orderCount)

	// Copy order_items
	fmt.Println("\n═══ Copying order items ═══")
	rows, err = src.Query(ctx, `SELECT * FROM order_items`)
	if err != nil {
		log.Fatal("Failed to query order_items:", err)
	}
	itemCount := 0
	for rows.Next() {
		vals, _ := rows.Values()
		cols := rows.FieldDescriptions()
		
		placeholders := ""
		colNames := ""
		for i, col := range cols {
			if i > 0 {
				placeholders += ", "
				colNames += ", "
			}
			placeholders += fmt.Sprintf("$%d", i+1)
			colNames += string(col.Name)
		}
		
		_, err := dst.Exec(ctx, fmt.Sprintf("INSERT INTO order_items (%s) VALUES (%s) ON CONFLICT (id) DO NOTHING", colNames, placeholders), vals...)
		if err != nil {
			log.Printf("  ⚠ Item: %v", err)
		} else {
			itemCount++
		}
	}
	rows.Close()
	fmt.Printf("  ✅ Copied %d order items\n", itemCount)

	// Copy order_timeline
	fmt.Println("\n═══ Copying order timeline ═══")
	rows, err = src.Query(ctx, `SELECT * FROM order_timeline`)
	if err != nil {
		log.Printf("  No timeline table or error: %v", err)
	} else {
		tlCount := 0
		for rows.Next() {
			vals, _ := rows.Values()
			cols := rows.FieldDescriptions()
			
			placeholders := ""
			colNames := ""
			for i, col := range cols {
				if i > 0 {
					placeholders += ", "
					colNames += ", "
				}
				placeholders += fmt.Sprintf("$%d", i+1)
				colNames += string(col.Name)
			}
			
			_, err := dst.Exec(ctx, fmt.Sprintf("INSERT INTO order_timeline (%s) VALUES (%s) ON CONFLICT (id) DO NOTHING", colNames, placeholders), vals...)
			if err != nil {
				log.Printf("  ⚠ Timeline: %v", err)
			} else {
				tlCount++
			}
		}
		rows.Close()
		fmt.Printf("  ✅ Copied %d timeline entries\n", tlCount)
	}

	// Copy wishlists
	fmt.Println("\n═══ Copying wishlists ═══")
	rows, _ = src.Query(ctx, `SELECT * FROM wishlists`)
	if rows != nil {
		wlCount := 0
		for rows.Next() {
			vals, _ := rows.Values()
			cols := rows.FieldDescriptions()
			placeholders := ""
			colNames := ""
			for i, col := range cols {
				if i > 0 { placeholders += ", "; colNames += ", " }
				placeholders += fmt.Sprintf("$%d", i+1)
				colNames += string(col.Name)
			}
			dst.Exec(ctx, fmt.Sprintf("INSERT INTO wishlists (%s) VALUES (%s) ON CONFLICT (id) DO NOTHING", colNames, placeholders), vals...)
			wlCount++
		}
		rows.Close()
		fmt.Printf("  ✅ Copied %d wishlists\n", wlCount)
	}

	// Copy referrals
	fmt.Println("\n═══ Copying referrals ═══")
	rows, _ = src.Query(ctx, `SELECT * FROM referrals`)
	if rows != nil {
		refCount := 0
		for rows.Next() {
			vals, _ := rows.Values()
			cols := rows.FieldDescriptions()
			placeholders := ""
			colNames := ""
			for i, col := range cols {
				if i > 0 { placeholders += ", "; colNames += ", " }
				placeholders += fmt.Sprintf("$%d", i+1)
				colNames += string(col.Name)
			}
			dst.Exec(ctx, fmt.Sprintf("INSERT INTO referrals (%s) VALUES (%s) ON CONFLICT (id) DO NOTHING", colNames, placeholders), vals...)
			refCount++
		}
		rows.Close()
		fmt.Printf("  ✅ Copied %d referrals\n", refCount)
	}

	// Final verification
	fmt.Println("\n═══ Final Verification (Neon) ═══")
	_ = time.Now()
	tables := []string{"users", "products", "categories", "orders", "order_items", "customers", "order_timeline"}
	for _, t := range tables {
		var count int
		dst.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", t)).Scan(&count)
		fmt.Printf("  %-18s  %d rows\n", t, count)
	}
	
	fmt.Println("\n🎉 Migration complete!")
}

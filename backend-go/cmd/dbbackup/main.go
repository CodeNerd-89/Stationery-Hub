package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	if len(os.Args) < 3 {
		fmt.Println("Usage: go run ./cmd/dbbackup <source-url> <output-file>")
		os.Exit(1)
	}

	sourceURL := os.Args[1]
	outputFile := os.Args[2]
	ctx := context.Background()

	pool, err := pgxpool.New(ctx, sourceURL)
	if err != nil {
		log.Fatal("Failed to connect:", err)
	}
	defer pool.Close()

	fmt.Println("✅ Connected to source database")

	backup := map[string]interface{}{}

	// Backup categories
	fmt.Println("  Backing up categories...")
	rows, _ := pool.Query(ctx, `SELECT id, name, slug, description, image_url, is_active, created_at, updated_at FROM categories ORDER BY created_at`)
	var categories []map[string]interface{}
	for rows.Next() {
		var id, name string
		var slug, description, imageURL *string
		var isActive bool
		var createdAt, updatedAt time.Time
		rows.Scan(&id, &name, &slug, &description, &imageURL, &isActive, &createdAt, &updatedAt)
		categories = append(categories, map[string]interface{}{
			"id": id, "name": name, "slug": slug, "description": description,
			"image_url": imageURL, "is_active": isActive, "created_at": createdAt, "updated_at": updatedAt,
		})
	}
	rows.Close()
	backup["categories"] = categories
	fmt.Printf("    → %d categories\n", len(categories))

	// Backup users
	fmt.Println("  Backing up users...")
	rows, _ = pool.Query(ctx, `SELECT id, email, password_hash, name, phone, role, email_verified, referral_code, referred_by_id, reset_token, reset_expires, created_at, updated_at FROM users ORDER BY created_at`)
	var users []map[string]interface{}
	for rows.Next() {
		var id, email, passwordHash, name, role string
		var phone, referralCode, referredByID, resetToken *string
		var resetExpires *time.Time
		var emailVerified bool
		var createdAt, updatedAt time.Time
		rows.Scan(&id, &email, &passwordHash, &name, &phone, &role, &emailVerified, &referralCode, &referredByID, &resetToken, &resetExpires, &createdAt, &updatedAt)
		users = append(users, map[string]interface{}{
			"id": id, "email": email, "password_hash": passwordHash, "name": name, "phone": phone,
			"role": role, "email_verified": emailVerified, "referral_code": referralCode,
			"referred_by_id": referredByID, "reset_token": resetToken, "reset_expires": resetExpires,
			"created_at": createdAt, "updated_at": updatedAt,
		})
	}
	rows.Close()
	backup["users"] = users
	fmt.Printf("    → %d users\n", len(users))

	// Backup products
	fmt.Println("  Backing up products...")
	rows, _ = pool.Query(ctx, `SELECT id, name, slug, sku, category_id, description, price, stock, unit, image_url, is_active, average_rating, review_count, created_at, updated_at FROM products ORDER BY created_at`)
	var products []map[string]interface{}
	for rows.Next() {
		var id, name, slug, sku, categoryID string
		var description, imageURL *string
		var price, avgRating float64
		var stock, reviewCount int
		var unit string
		var isActive bool
		var createdAt, updatedAt time.Time
		rows.Scan(&id, &name, &slug, &sku, &categoryID, &description, &price, &stock, &unit, &imageURL, &isActive, &avgRating, &reviewCount, &createdAt, &updatedAt)
		products = append(products, map[string]interface{}{
			"id": id, "name": name, "slug": slug, "sku": sku, "category_id": categoryID,
			"description": description, "price": price, "stock": stock, "unit": unit,
			"image_url": imageURL, "is_active": isActive, "average_rating": avgRating,
			"review_count": reviewCount, "created_at": createdAt, "updated_at": updatedAt,
		})
	}
	rows.Close()
	backup["products"] = products
	fmt.Printf("    → %d products\n", len(products))

	// Backup customers
	fmt.Println("  Backing up customers...")
	rows, _ = pool.Query(ctx, `SELECT id, user_id, email, contact_person, company_name, phone, address, city, created_at FROM customers ORDER BY created_at`)
	var customers []map[string]interface{}
	for rows.Next() {
		var id string
		var userID, email, contactPerson, companyName, phone, address, city *string
		var createdAt time.Time
		rows.Scan(&id, &userID, &email, &contactPerson, &companyName, &phone, &address, &city, &createdAt)
		customers = append(customers, map[string]interface{}{
			"id": id, "user_id": userID, "email": email, "contact_person": contactPerson,
			"company_name": companyName, "phone": phone, "address": address, "city": city, "created_at": createdAt,
		})
	}
	rows.Close()
	backup["customers"] = customers
	fmt.Printf("    → %d customers\n", len(customers))

	// Backup orders
	fmt.Println("  Backing up orders...")
	rows, _ = pool.Query(ctx, `SELECT id, order_number, customer_id, promo_code, subtotal, discount, shipping_fee, payment_method, order_type, status, total, notes, shipping_phone, shipping_address, shipping_city, created_at, updated_at FROM orders ORDER BY created_at`)
	var orders []map[string]interface{}
	for rows.Next() {
		var id, orderNumber, customerID, paymentMethod, orderType, status string
		var promoCode, notes, shippingPhone, shippingAddress, shippingCity *string
		var subtotal, discount, shippingFee, total float64
		var createdAt, updatedAt time.Time
		rows.Scan(&id, &orderNumber, &customerID, &promoCode, &subtotal, &discount, &shippingFee, &paymentMethod, &orderType, &status, &total, &notes, &shippingPhone, &shippingAddress, &shippingCity, &createdAt, &updatedAt)
		orders = append(orders, map[string]interface{}{
			"id": id, "order_number": orderNumber, "customer_id": customerID, "promo_code": promoCode,
			"subtotal": subtotal, "discount": discount, "shipping_fee": shippingFee,
			"payment_method": paymentMethod, "order_type": orderType, "status": status, "total": total,
			"notes": notes, "shipping_phone": shippingPhone, "shipping_address": shippingAddress,
			"shipping_city": shippingCity, "created_at": createdAt, "updated_at": updatedAt,
		})
	}
	rows.Close()
	backup["orders"] = orders
	fmt.Printf("    → %d orders\n", len(orders))

	// Backup order_items
	fmt.Println("  Backing up order items...")
	rows, _ = pool.Query(ctx, `SELECT id, order_id, product_id, product_name, unit_price, quantity, line_total FROM order_items`)
	var orderItems []map[string]interface{}
	for rows.Next() {
		var id, orderID, productID, productName string
		var unitPrice, lineTotal float64
		var quantity int
		rows.Scan(&id, &orderID, &productID, &productName, &unitPrice, &quantity, &lineTotal)
		orderItems = append(orderItems, map[string]interface{}{
			"id": id, "order_id": orderID, "product_id": productID, "product_name": productName,
			"unit_price": unitPrice, "quantity": quantity, "line_total": lineTotal,
		})
	}
	rows.Close()
	backup["order_items"] = orderItems
	fmt.Printf("    → %d order items\n", len(orderItems))

	// Save to file
	data, err := json.MarshalIndent(backup, "", "  ")
	if err != nil {
		log.Fatal("Failed to marshal backup:", err)
	}

	err = os.WriteFile(outputFile, data, 0644)
	if err != nil {
		log.Fatal("Failed to write backup file:", err)
	}

	fmt.Printf("\n🎉 Backup saved to %s (%d bytes)\n", outputFile, len(data))
}

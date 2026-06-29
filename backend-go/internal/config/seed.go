package config

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// seedCategory holds the data for a category to seed.
type seedCategory struct {
	ID          string
	Name        string
	Slug        string
	Description string
	ImageURL    string
	SortOrder   int
}

// seedProduct holds the data for a product to seed.
type seedProduct struct {
	Name        string
	SKU         string
	CategoryID  string
	Description string
	Price       float64
	Stock       int
	Unit        string
	ImageURL    string
}

func slugifySeed(name string) string {
	s := strings.ToLower(name)
	// Replace non-alphanumeric with hyphens
	result := []byte{}
	for _, ch := range []byte(s) {
		if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') {
			result = append(result, ch)
		} else {
			result = append(result, '-')
		}
	}
	s = string(result)
	// Collapse multiple hyphens
	for strings.Contains(s, "--") {
		s = strings.ReplaceAll(s, "--", "-")
	}
	s = strings.Trim(s, "-")
	return s
}

// RunSeed inserts sample categories and products if the database is empty.
// This is safe to run multiple times — it only seeds when there are 0 categories.
func RunSeed(pool *pgxpool.Pool) {
	ctx := context.Background()

	// Check if data already exists
	var categoryCount int
	err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM categories").Scan(&categoryCount)
	if err != nil {
		log.Printf("Seed: could not check categories count: %v", err)
		return
	}

	if categoryCount > 0 {
		fmt.Println("  📋 Database already has data, skipping seed")
		return
	}

	fmt.Println("  🌱 Seeding database with sample data...")

	now := time.Now()

	// ─── Categories ───
	categories := []seedCategory{
		{
			ID:          uuid.New().String(),
			Name:        "Pens & Pencils",
			Slug:        "pens-pencils",
			Description: "High-quality writing instruments including ballpoint pens, gel pens, markers, and pencils",
			ImageURL:    "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400",
			SortOrder:   1,
		},
		{
			ID:          uuid.New().String(),
			Name:        "Notebooks & Paper",
			Slug:        "notebooks-paper",
			Description: "Premium notebooks, notepads, loose leaf paper, and specialty paper products",
			ImageURL:    "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400",
			SortOrder:   2,
		},
		{
			ID:          uuid.New().String(),
			Name:        "Office Supplies",
			Slug:        "office-supplies",
			Description: "Essential office supplies including staplers, scissors, tape, and desk accessories",
			ImageURL:    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400",
			SortOrder:   3,
		},
		{
			ID:          uuid.New().String(),
			Name:        "Art Supplies",
			Slug:        "art-supplies",
			Description: "Creative art materials including paints, brushes, canvases, and drawing tools",
			ImageURL:    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400",
			SortOrder:   4,
		},
		{
			ID:          uuid.New().String(),
			Name:        "Filing & Organization",
			Slug:        "filing-organization",
			Description: "Folders, binders, file organizers, and storage solutions for your workspace",
			ImageURL:    "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400",
			SortOrder:   5,
		},
		{
			ID:          uuid.New().String(),
			Name:        "School Supplies",
			Slug:        "school-supplies",
			Description: "Back-to-school essentials including backpacks, geometry sets, and study materials",
			ImageURL:    "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400",
			SortOrder:   6,
		},
	}

	// Insert categories
	for _, cat := range categories {
		_, err := pool.Exec(ctx, `
			INSERT INTO categories (id, name, slug, description, image_url, sort_order, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, cat.ID, cat.Name, cat.Slug, cat.Description, cat.ImageURL, cat.SortOrder, now)
		if err != nil {
			log.Printf("Seed: failed to insert category %s: %v", cat.Name, err)
			return
		}
	}

	// ─── Products ───
	products := []seedProduct{
		// Pens & Pencils
		{Name: "Pilot G2 Gel Pen (Black)", SKU: "PEN-PLT-G2-BK", CategoryID: categories[0].ID, Description: "Premium retractable gel pen with smooth writing experience. Fine point 0.7mm tip provides consistent ink flow. Comfortable rubber grip for extended writing sessions.", Price: 45.00, Stock: 200, Unit: "pc", ImageURL: "https://images.unsplash.com/photo-1585336261022-680e295ce3fe?w=400"},
		{Name: "Faber-Castell Classic Pencil Set (12pc)", SKU: "PEN-FC-CLS-12", CategoryID: categories[0].ID, Description: "Set of 12 high-quality graphite pencils ranging from 2H to 8B. Perfect for writing, sketching, and technical drawing. Break-resistant lead.", Price: 180.00, Stock: 150, Unit: "set", ImageURL: "https://images.unsplash.com/photo-1589125451673-4775ee9f4d52?w=400"},
		{Name: "Staedtler Triplus Fineliner (10 Colors)", SKU: "PEN-STD-TRI-10", CategoryID: categories[0].ID, Description: "Set of 10 vibrant fineliner pens with ergonomic triangular barrel. Superfine metal-clad tip for precise lines. Dry-safe ink stays fresh for days without capping.", Price: 320.00, Stock: 100, Unit: "set", ImageURL: "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400"},
		{Name: "Uni-ball Signo Broad Gel Pen (Blue)", SKU: "PEN-UNI-SIG-BL", CategoryID: categories[0].ID, Description: "Bold 1.0mm gel pen with vibrant blue ink. Fade-proof and water-resistant. Ideal for signatures and bold writing.", Price: 65.00, Stock: 300, Unit: "pc", ImageURL: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400"},
		{Name: "Sharpie Permanent Marker (Black)", SKU: "PEN-SHP-PMK-BK", CategoryID: categories[0].ID, Description: "Quick-drying permanent marker with fine point tip. Marks on most surfaces including plastic, metal, and glass. Fade and water-resistant ink.", Price: 85.00, Stock: 250, Unit: "pc", ImageURL: "https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=400"},

		// Notebooks & Paper
		{Name: "Moleskine Classic Notebook (A5)", SKU: "NB-MOL-CLS-A5", CategoryID: categories[1].ID, Description: "Iconic hardcover notebook with 240 ruled pages. Acid-free ivory paper with bookmark ribbon and elastic closure. Expandable inner pocket for loose notes.", Price: 850.00, Stock: 75, Unit: "pc", ImageURL: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400"},
		{Name: "Campus Spiral Notebook (B5, 5-Subject)", SKU: "NB-CMP-SPR-B5", CategoryID: categories[1].ID, Description: "5-subject spiral notebook with 200 pages divided by tabbed dividers. Micro-perforated pages tear cleanly. 3-hole punched for binder compatibility.", Price: 220.00, Stock: 120, Unit: "pc", ImageURL: "https://images.unsplash.com/photo-1517842645767-c639042777db?w=400"},
		{Name: "A4 Copy Paper (500 Sheets)", SKU: "PPR-A4-CPY-500", CategoryID: categories[1].ID, Description: "Premium 80gsm white copy paper suitable for everyday printing and photocopying. Compatible with all laser and inkjet printers. Ream of 500 sheets.", Price: 350.00, Stock: 500, Unit: "ream", ImageURL: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=400"},
		{Name: "Legal Pad Yellow (A4, 50 Sheets)", SKU: "NB-LGL-YLW-A4", CategoryID: categories[1].ID, Description: "Classic yellow ruled legal pad with 50 perforated sheets. Sturdy chipboard backing for writing on-the-go. Wide ruled lines for easy reading.", Price: 90.00, Stock: 200, Unit: "pc", ImageURL: "https://images.unsplash.com/photo-1572726729207-a78d6feb18d7?w=400"},
		{Name: "Sticky Notes Assorted Colors (3x3, 5 Pack)", SKU: "PPR-STK-AST-5", CategoryID: categories[1].ID, Description: "Pack of 5 vibrant sticky note pads, 100 sheets each. Strong adhesive that sticks and re-sticks without residue. Perfect for reminders and bookmarks.", Price: 120.00, Stock: 300, Unit: "pack", ImageURL: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=400"},

		// Office Supplies
		{Name: "Heavy Duty Stapler (Full Strip)", SKU: "OFF-STP-HDY-FS", CategoryID: categories[2].ID, Description: "Robust full-strip stapler that handles up to 25 sheets. Soft-grip handle reduces hand fatigue. Uses standard 26/6 staples. Built-in staple remover.", Price: 280.00, Stock: 80, Unit: "pc", ImageURL: "https://images.unsplash.com/photo-1568738351265-aa9a4e20e3d4?w=400"},
		{Name: "Premium Scissors (8 inch)", SKU: "OFF-SCR-PRE-8", CategoryID: categories[2].ID, Description: "Stainless steel scissors with comfortable ergonomic handles. Ultra-sharp blades for clean cuts through paper, cardboard, and fabric. Right and left-hand friendly.", Price: 150.00, Stock: 100, Unit: "pc", ImageURL: "https://images.unsplash.com/photo-1590736704728-f4730bb30770?w=400"},
		{Name: "Scotch Transparent Tape (3 Pack)", SKU: "OFF-TPE-SCT-3", CategoryID: categories[2].ID, Description: "Crystal-clear transparent tape, virtually invisible on paper. Easy to tear, easy to use. Each roll is 18mm x 33m. Includes desktop dispenser.", Price: 180.00, Stock: 250, Unit: "pack", ImageURL: "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=400"},
		{Name: "Desk Organizer (Wooden, 5 Compartments)", SKU: "OFF-ORG-WDN-5", CategoryID: categories[2].ID, Description: "Beautiful wooden desk organizer with 5 compartments for pens, clips, and accessories. Natural bamboo finish adds elegance to any workspace.", Price: 550.00, Stock: 40, Unit: "pc", ImageURL: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400"},
		{Name: "Paper Clips (Assorted, 200 Pack)", SKU: "OFF-CLP-AST-200", CategoryID: categories[2].ID, Description: "Assortment of 200 paper clips in various sizes and colors. Smooth finish prevents snagging. Packaged in a reusable clear container.", Price: 75.00, Stock: 400, Unit: "pack", ImageURL: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400"},

		// Art Supplies
		{Name: "Acrylic Paint Set (24 Colors)", SKU: "ART-ACR-SET-24", CategoryID: categories[3].ID, Description: "Professional-grade acrylic paint set with 24 vibrant colors. Non-toxic, fast-drying formula. Each tube contains 12ml. Suitable for canvas, wood, and paper.", Price: 650.00, Stock: 60, Unit: "set", ImageURL: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400"},
		{Name: "Watercolor Brush Set (12 Brushes)", SKU: "ART-BRS-WCL-12", CategoryID: categories[3].ID, Description: "Set of 12 premium watercolor brushes with natural and synthetic bristles. Variety of shapes and sizes for versatile techniques. Comfortable wooden handles.", Price: 420.00, Stock: 45, Unit: "set", ImageURL: "https://images.unsplash.com/photo-1560421683-6856ea585c78?w=400"},
		{Name: "Stretched Canvas (A3, 3 Pack)", SKU: "ART-CNV-A3-3", CategoryID: categories[3].ID, Description: "Pack of 3 pre-stretched canvases on wooden frames. Triple-primed 100% cotton. Suitable for oil, acrylic, and mixed media. Gallery-quality profile.", Price: 480.00, Stock: 35, Unit: "pack", ImageURL: "https://images.unsplash.com/photo-1579762714453-51d9c8d07ff9?w=400"},
		{Name: "Sketch Pad (A4, 100 Sheets)", SKU: "ART-SKP-A4-100", CategoryID: categories[3].ID, Description: "Heavy-weight 160gsm sketch pad perfect for pencil, charcoal, and pastel drawing. Spiral-bound for easy page turning. Micro-perforated for clean removal.", Price: 280.00, Stock: 80, Unit: "pc", ImageURL: "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400"},

		// Filing & Organization
		{Name: "Manila Folders (A4, 50 Pack)", SKU: "FIL-MNL-A4-50", CategoryID: categories[4].ID, Description: "Pack of 50 durable manila folders with reinforced tabs. Half-cut tabs for easy labeling. 250gsm card stock for long-lasting use.", Price: 350.00, Stock: 100, Unit: "pack", ImageURL: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400"},
		{Name: "Ring Binder (A4, 2-inch, Black)", SKU: "FIL-RNG-A4-2BK", CategoryID: categories[4].ID, Description: "Professional 2-inch ring binder with sturdy D-ring mechanism. Holds up to 350 sheets. Clear overlay pockets on front, back, and spine for customization.", Price: 220.00, Stock: 70, Unit: "pc", ImageURL: "https://images.unsplash.com/photo-1568738351265-aa9a4e20e3d4?w=400"},
		{Name: "Expanding File Folder (12 Pockets)", SKU: "FIL-EXP-12-BL", CategoryID: categories[4].ID, Description: "Accordion-style expanding file with 12 labeled pockets for monthly organization. Elastic closure keeps documents secure. Durable polypropylene construction.", Price: 320.00, Stock: 55, Unit: "pc", ImageURL: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400"},
		{Name: "Label Maker (Handheld)", SKU: "FIL-LBL-HND-01", CategoryID: categories[4].ID, Description: "Compact handheld label maker with QWERTY keyboard. Prints on 6mm, 9mm, and 12mm tapes. Multiple fonts, styles, and borders. Runs on 6 AAA batteries.", Price: 750.00, Stock: 30, Unit: "pc", ImageURL: "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=400"},

		// School Supplies
		{Name: "Geometry Box Set (15 Pieces)", SKU: "SCH-GEO-SET-15", CategoryID: categories[5].ID, Description: "Complete geometry set with compass, protractor, set squares, divider, ruler, and more. Durable metal instruments in a sturdy plastic case.", Price: 250.00, Stock: 120, Unit: "set", ImageURL: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400"},
		{Name: "Scientific Calculator (FX-991)", SKU: "SCH-CAL-FX991", CategoryID: categories[5].ID, Description: "Advanced scientific calculator with 552 functions. Natural textbook display shows formulas as they appear in textbooks. Solar powered with battery backup.", Price: 1200.00, Stock: 60, Unit: "pc", ImageURL: "https://images.unsplash.com/photo-1564939558297-fc396f18e5c7?w=400"},
		{Name: "School Backpack (Ergonomic, Blue)", SKU: "SCH-BAG-ERG-BL", CategoryID: categories[5].ID, Description: "Ergonomic school backpack with padded shoulder straps and back panel. Multiple compartments including laptop sleeve. Water-resistant nylon fabric.", Price: 1500.00, Stock: 40, Unit: "pc", ImageURL: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400"},
		{Name: "Correction Tape (5mm, 3 Pack)", SKU: "SCH-CRT-5MM-3", CategoryID: categories[5].ID, Description: "Quick-drying correction tape for instant corrections. 5mm width covers text cleanly. Each tape is 8 meters long. Can write over immediately.", Price: 95.00, Stock: 200, Unit: "pack", ImageURL: "https://images.unsplash.com/photo-1568738351265-aa9a4e20e3d4?w=400"},
		{Name: "Eraser Set (Dust-Free, 4 Pack)", SKU: "SCH-ERS-DF-4", CategoryID: categories[5].ID, Description: "Pack of 4 premium dust-free erasers. Soft and gentle on paper, no smudging. Erases cleanly without tearing. Individually sleeved for cleanliness.", Price: 60.00, Stock: 350, Unit: "pack", ImageURL: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400"},
	}

	// Insert products
	for _, prod := range products {
		id := uuid.New().String()
		slug := slugifySeed(prod.Name)

		_, err := pool.Exec(ctx, `
			INSERT INTO products (id, name, slug, sku, category_id, description, price, stock, unit, image_url, is_active, average_rating, review_count, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, 0, 0, $11, $11)
		`, id, prod.Name, slug, prod.SKU, prod.CategoryID, prod.Description, prod.Price, prod.Stock, prod.Unit, prod.ImageURL, now)
		if err != nil {
			log.Printf("Seed: failed to insert product %s: %v", prod.Name, err)
			return
		}
	}

	fmt.Printf("  ✅ Seeded %d categories and %d products\n", len(categories), len(products))
}

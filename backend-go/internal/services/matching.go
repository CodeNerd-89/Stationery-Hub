package services

import (
	"math"
	"regexp"
	"strconv"
	"strings"
)

// scoredProduct pairs a product with its fuzzy match score.
type scoredProduct struct {
	product ProductForMatch
	score   float64
}

// ─── Types ──────────────────────────────────────────

// ExtractedItem represents a single item parsed from OCR text.
type ExtractedItem struct {
	Name      string  `json:"name"`
	Quantity  int     `json:"quantity"`
	Unit      string  `json:"unit"`
	UnitPrice float64 `json:"unitPrice"`
	RawLine   string  `json:"rawLine"`
}

// ProductForMatch is the product data needed for fuzzy matching.
type ProductForMatch struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	SKU         string  `json:"sku"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	Stock       int     `json:"stock"`
	Unit        string  `json:"unit"`
	Category    string  `json:"category"`
}

// MatchedProductInfo is the matched product detail in the result.
type MatchedProductInfo struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	SKU   string  `json:"sku"`
	Price float64 `json:"price"`
	Stock int     `json:"stock"`
	Unit  string  `json:"unit"`
}

// Suggestion is a candidate match for an extracted item.
type Suggestion struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	SKU        string  `json:"sku"`
	Price      float64 `json:"price"`
	Confidence float64 `json:"confidence"`
}

// MatchedItem is the final result for each extracted item.
type MatchedItem struct {
	ExtractedName  string              `json:"extractedName"`
	MatchedProduct *MatchedProductInfo `json:"matchedProduct"`
	Confidence     float64             `json:"confidence"`
	Quantity       int                 `json:"quantity"`
	Unit           string              `json:"unit"`
	UnitPrice      float64             `json:"unitPrice"`
	Suggestions    []Suggestion        `json:"suggestions"`
	RawLine        string              `json:"rawLine"`
}

// ─── Regex Patterns ─────────────────────────────────
// All 5 patterns from the JS matching.service.js

var (
	// "5 pcs A4 Paper" or "10 box Stapler Pins"
	patternQtyFirst = regexp.MustCompile(`(?i)^(\d+)\s*(pcs?|packs?|box(?:es)?|reams?|sets?|rolls?|dozens?|units?)?\s+(.+)$`)
	// "A4 Paper x 5" or "A4 Paper × 5"
	patternCross = regexp.MustCompile(`(?i)^(.+?)\s*[x×]\s*(\d+)\s*(pcs?|packs?|box(?:es)?|reams?|sets?|rolls?|dozens?|units?)?$`)
	// "A4 Paper - 5 pcs"
	patternDash = regexp.MustCompile(`(?i)^(.+?)\s*[-–—]\s*(\d+)\s*(pcs?|packs?|box(?:es)?|reams?|sets?|rolls?|dozens?|units?)?$`)
	// "A4 Paper    5    pcs" (tabular with spaces)
	patternTabular = regexp.MustCompile(`(?i)^(.+?)\s{3,}(\d+)\s*(pcs?|packs?|box(?:es)?|reams?|sets?|rolls?|dozens?|units?)?$`)
	// "1. A4 Paper 5pcs" (numbered list)
	patternNumbered = regexp.MustCompile(`(?i)^\d+[.)]\s*(.+?)\s+(\d+)\s*(pcs?|packs?|box(?:es)?|reams?|sets?|rolls?|dozens?|units?)?$`)

	// PO table row: "1 A4 Copier Paper 80 GSM 20 Ream 550.00 11,000.00"
	// Matches: <item_no> <description> <qty> <unit> <unit_price> <total>
	patternPOTable = regexp.MustCompile(`(?i)^\d+\s+(.+?)\s+(\d+)\s+(pcs?|pieces?|packs?|box(?:es)?|reams?|sets?|rolls?|dozens?|units?)\s+([\d,]+\.\d{2})\s+[\d,]+\.\d{2}$`)

	// Skip lines that look like headers/metadata
	skipLinePattern = regexp.MustCompile(`(?i)^(date|from|to|total|subtotal|tax|vat|note|phone|email|address|invoice|purchase\s+order|order\s*#|po\s|p\.o|item\s*no|description|qty|quantity|unit\s*price|amount|vendor|supplier|ship|delivery|payment|authorized|designation|grand\s*total|net\s)`)
	// Extract a number from a line
	numberPattern = regexp.MustCompile(`(\d+)`)
	// Extract decimal prices from a line (e.g., 550.00, 1,800.00)
	pricePattern = regexp.MustCompile(`([\d,]+\.\d{2})`)
	// Strip all digits
	digitPattern = regexp.MustCompile(`\d+`)
	// Collapse multiple spaces
	spacesPattern = regexp.MustCompile(`\s+`)
)

// ─── ParseExtractedItems ────────────────────────────

// ParseExtractedItems parses raw OCR text into structured line items.
func ParseExtractedItems(rawText string) []ExtractedItem {
	if rawText == "" {
		return []ExtractedItem{}
	}

	lines := strings.Split(rawText, "\n")
	var items []ExtractedItem

	for _, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		if len(line) <= 3 {
			continue
		}

		// Skip header/metadata lines
		if skipLinePattern.MatchString(line) {
			continue
		}

		matched := false

		// Pattern 0 (PO Table): "1 A4 Copier Paper 20 Ream 550.00 11,000.00"
		if m := patternPOTable.FindStringSubmatch(line); m != nil {
			qty, _ := strconv.Atoi(m[2])
			price := parsePrice(m[4])
			items = append(items, ExtractedItem{
				Name:      strings.TrimSpace(m[1]),
				Quantity:  qty,
				Unit:      normalizeUnit(m[3]),
				UnitPrice: price,
				RawLine:   line,
			})
			matched = true
		}

		// Pattern 1: QTY UNIT ITEM_NAME
		if !matched {
			if m := patternQtyFirst.FindStringSubmatch(line); m != nil {
				qty, _ := strconv.Atoi(m[1])
				price := extractLastPrice(m[3])
				name := removePrices(m[3])
				items = append(items, ExtractedItem{
					Name:      strings.TrimSpace(name),
					Quantity:  qty,
					Unit:      normalizeUnit(m[2]),
					UnitPrice: price,
					RawLine:   line,
				})
				matched = true
			}
		}

		// Pattern 2: ITEM_NAME x QTY
		if !matched {
			if m := patternCross.FindStringSubmatch(line); m != nil {
				qty, _ := strconv.Atoi(m[2])
				items = append(items, ExtractedItem{
					Name:      strings.TrimSpace(m[1]),
					Quantity:  qty,
					Unit:      normalizeUnit(m[3]),
					UnitPrice: extractLastPrice(m[1]),
					RawLine:   line,
				})
				matched = true
			}
		}

		// Pattern 3: ITEM_NAME - QTY
		if !matched {
			if m := patternDash.FindStringSubmatch(line); m != nil {
				qty, _ := strconv.Atoi(m[2])
				items = append(items, ExtractedItem{
					Name:      strings.TrimSpace(m[1]),
					Quantity:  qty,
					Unit:      normalizeUnit(m[3]),
					UnitPrice: extractLastPrice(m[1]),
					RawLine:   line,
				})
				matched = true
			}
		}

		// Pattern 4: ITEM_NAME     QTY (tabular)
		if !matched {
			if m := patternTabular.FindStringSubmatch(line); m != nil {
				qty, _ := strconv.Atoi(m[2])
				items = append(items, ExtractedItem{
					Name:      strings.TrimSpace(m[1]),
					Quantity:  qty,
					Unit:      normalizeUnit(m[3]),
					UnitPrice: extractLastPrice(m[1]),
					RawLine:   line,
				})
				matched = true
			}
		}

		// Pattern 5: Numbered list — "1. ITEM_NAME QTY"
		if !matched {
			if m := patternNumbered.FindStringSubmatch(line); m != nil {
				qty, _ := strconv.Atoi(m[2])
				items = append(items, ExtractedItem{
					Name:      strings.TrimSpace(m[1]),
					Quantity:  qty,
					Unit:      normalizeUnit(m[3]),
					UnitPrice: extractLastPrice(m[1]),
					RawLine:   line,
				})
				matched = true
			}
		}

		// Fallback: extract price from any line with numbers
		if !matched && len(line) > 5 {
			if numMatch := numberPattern.FindStringSubmatch(line); numMatch != nil {
				qty, _ := strconv.Atoi(numMatch[1])
				if qty > 0 && qty < 10000 {
					price := extractLastPrice(line)
					name := removePrices(line)
					name = digitPattern.ReplaceAllString(name, "")
					name = spacesPattern.ReplaceAllString(name, " ")
					name = strings.TrimSpace(name)
					if name != "" {
						items = append(items, ExtractedItem{
							Name:      name,
							Quantity:  qty,
							Unit:      "",
							UnitPrice: price,
							RawLine:   line,
						})
					}
				}
			}
		}
	}

	return items
}

// ─── normalizeUnit ──────────────────────────────────

func normalizeUnit(unit string) string {
	if unit == "" {
		return "pc"
	}
	u := strings.ToLower(unit)
	// Remove trailing 's' (plurals)
	u = strings.TrimSuffix(u, "s")

	unitMap := map[string]string{
		"pc": "pc", "piece": "pc",
		"pack": "pack", "packet": "pack",
		"box": "box", "boxe": "box",
		"ream": "ream",
		"set":  "set",
		"roll": "roll",
		"dozen": "dozen",
		"unit": "pc",
	}

	if normalized, ok := unitMap[u]; ok {
		return normalized
	}
	return "pc"
}

// ─── Price Helpers ──────────────────────────────────

// parsePrice converts a price string like "1,800.00" to float64.
func parsePrice(s string) float64 {
	s = strings.ReplaceAll(s, ",", "")
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

// extractLastPrice finds prices (e.g., "550.00", "11,000.00") in text.
// If 2+ prices found, returns the second-to-last (unit price, not total).
// If 1 price found, returns it.
func extractLastPrice(text string) float64 {
	matches := pricePattern.FindAllString(text, -1)
	if len(matches) >= 2 {
		return parsePrice(matches[len(matches)-2]) // second-to-last = unit price
	}
	if len(matches) == 1 {
		return parsePrice(matches[0])
	}
	return 0
}

// removePrices strips price patterns (like 550.00, 11,000.00) from text.
func removePrices(text string) string {
	return pricePattern.ReplaceAllString(text, "")
}

// ─── Fuzzy Matching ─────────────────────────────────

// MatchWithCatalog fuzzy-matches extracted items against the product catalog.
func MatchWithCatalog(items []ExtractedItem, products []ProductForMatch) []MatchedItem {
	if len(items) == 0 {
		return []MatchedItem{}
	}

	if len(products) == 0 {
		result := make([]MatchedItem, len(items))
		for i, item := range items {
			result[i] = MatchedItem{
				ExtractedName:  item.Name,
				MatchedProduct: nil,
				Confidence:     0,
				Quantity:       item.Quantity,
				Unit:           item.Unit,
				UnitPrice:      0,
				Suggestions:    []Suggestion{},
				RawLine:        item.RawLine,
			}
		}
		return result
	}

	result := make([]MatchedItem, len(items))
	for i, item := range items {
		var scored_list []scoredProduct

		queryLower := strings.ToLower(item.Name)

		for _, p := range products {
			// Weighted fuzzy score across name (0.6), sku (0.2), description (0.2)
			nameScore := fuzzyScore(queryLower, strings.ToLower(p.Name))
			skuScore := fuzzyScore(queryLower, strings.ToLower(p.SKU))
			descScore := fuzzyScore(queryLower, strings.ToLower(p.Description))

			combined := nameScore*0.6 + skuScore*0.2 + descScore*0.2
			if combined > 0.05 { // Only keep non-trivial matches
				scored_list = append(scored_list, scoredProduct{product: p, score: combined})
			}
		}

		// Sort by score descending
		sortScored(scored_list)

		confidence := 0.0
		if len(scored_list) > 0 {
			confidence = math.Round(scored_list[0].score*100) / 100
		}

		var matchedProduct *MatchedProductInfo
		unitPrice := item.UnitPrice // Use extracted price from OCR as default

		// Auto-match if confidence > 0.6
		if confidence > 0.6 && len(scored_list) > 0 {
			top := scored_list[0].product
			matchedProduct = &MatchedProductInfo{
				ID:    top.ID,
				Name:  top.Name,
				SKU:   top.SKU,
				Price: top.Price,
				Stock: top.Stock,
				Unit:  top.Unit,
			}
			// Use catalog price if available, else keep extracted price
			if top.Price > 0 {
				unitPrice = top.Price
			}
		}

		// Top 3 suggestions
		suggestions := make([]Suggestion, 0, 3)
		limit := 3
		if len(scored_list) < limit {
			limit = len(scored_list)
		}
		for j := 0; j < limit; j++ {
			s := scored_list[j]
			suggestions = append(suggestions, Suggestion{
				ID:         s.product.ID,
				Name:       s.product.Name,
				SKU:        s.product.SKU,
				Price:      s.product.Price,
				Confidence: math.Round(s.score*100) / 100,
			})
		}

		unit := item.Unit
		if unit == "" {
			if matchedProduct != nil {
				unit = matchedProduct.Unit
			}
			if unit == "" {
				unit = "pc"
			}
		}

		result[i] = MatchedItem{
			ExtractedName:  item.Name,
			MatchedProduct: matchedProduct,
			Confidence:     confidence,
			Quantity:       item.Quantity,
			Unit:           unit,
			UnitPrice:      unitPrice,
			Suggestions:    suggestions,
			RawLine:        item.RawLine,
		}
	}

	return result
}

// ─── Levenshtein-based fuzzy score ──────────────────

// fuzzyScore returns a similarity score between 0 and 1 for two strings.
// Uses a combination of Levenshtein distance and substring matching,
// similar to how Fuse.js calculates its score.
func fuzzyScore(query, target string) float64 {
	if query == "" || target == "" {
		return 0
	}

	// Exact match
	if query == target {
		return 1.0
	}

	// Substring containment bonus
	containsBonus := 0.0
	if strings.Contains(target, query) {
		containsBonus = 0.3
	} else if strings.Contains(query, target) {
		containsBonus = 0.2
	}

	// Word-level matching
	queryWords := strings.Fields(query)
	targetWords := strings.Fields(target)
	wordMatches := 0
	for _, qw := range queryWords {
		for _, tw := range targetWords {
			if strings.Contains(tw, qw) || strings.Contains(qw, tw) {
				wordMatches++
				break
			}
		}
	}
	wordScore := 0.0
	if len(queryWords) > 0 {
		wordScore = float64(wordMatches) / float64(len(queryWords))
	}

	// Levenshtein distance score
	maxLen := len(query)
	if len(target) > maxLen {
		maxLen = len(target)
	}
	dist := levenshtein(query, target)
	levScore := 1.0 - float64(dist)/float64(maxLen)
	if levScore < 0 {
		levScore = 0
	}

	// Combined score: levenshtein (40%), word matching (40%), containment (20%)
	combined := levScore*0.4 + wordScore*0.4 + containsBonus*0.2/0.3
	if combined > 1.0 {
		combined = 1.0
	}

	return combined
}

// levenshtein computes the edit distance between two strings.
func levenshtein(a, b string) int {
	la, lb := len(a), len(b)
	if la == 0 {
		return lb
	}
	if lb == 0 {
		return la
	}

	// Use two rows to save memory
	prev := make([]int, lb+1)
	curr := make([]int, lb+1)

	for j := 0; j <= lb; j++ {
		prev[j] = j
	}

	for i := 1; i <= la; i++ {
		curr[0] = i
		for j := 1; j <= lb; j++ {
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			curr[j] = min3(curr[j-1]+1, prev[j]+1, prev[j-1]+cost)
		}
		prev, curr = curr, prev
	}

	return prev[lb]
}

func min3(a, b, c int) int {
	if a < b {
		if a < c {
			return a
		}
		return c
	}
	if b < c {
		return b
	}
	return c
}

// sortScored sorts scored items by score descending (simple insertion sort for small N).
func sortScored(items []scoredProduct) {
	for i := 1; i < len(items); i++ {
		key := items[i]
		j := i - 1
		for j >= 0 && items[j].score < key.score {
			items[j+1] = items[j]
			j--
		}
		items[j+1] = key
	}
}

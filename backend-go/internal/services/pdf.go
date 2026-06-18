package services

import (
	"bytes"
	"fmt"
	"math"

	"github.com/go-pdf/fpdf"
)

// Currency prefix – using "Tk." since default PDF fonts don't support ৳
const cur = "Tk."

func formatCurrencyPDF(value float64) string {
	num := math.Abs(value)
	s := fmt.Sprintf("%.0f", num)
	// Add Indian-style commas
	if len(s) > 3 {
		result := s[len(s)-3:]
		s = s[:len(s)-3]
		for len(s) > 2 {
			result = s[len(s)-2:] + "," + result
			s = s[:len(s)-2]
		}
		if len(s) > 0 {
			result = s + "," + result
		}
		s = result
	}
	prefix := cur + " "
	if value < 0 {
		prefix = "-" + prefix
	}
	return prefix + s
}

// GenerateQuotationPDF generates a professional quotation PDF matching the original PDFKit layout.
func GenerateQuotationPDF(q map[string]interface{}) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetAutoPageBreak(true, 20)
	pdf.AddPage()

	// ─── Header ──────────────────────────
	pdf.SetFont("Helvetica", "B", 20)
	pdf.SetTextColor(79, 70, 229) // #4f46e5
	pdf.Text(15, 20, "Stationery Hub")

	pdf.SetFont("Helvetica", "", 8)
	pdf.SetTextColor(100, 116, 139) // #64748b
	pdf.Text(15, 26, "Basundhara R/A, Dhaka, Bangladesh")
	pdf.Text(15, 30, "Phone: +880 1700-000001 | Email: info@stationeryhub.com")

	// Quotation badge
	quotationNumber, _ := q["quotationNumber"].(string)
	pdf.SetFont("Helvetica", "B", 16)
	pdf.SetTextColor(30, 41, 59) // #1e293b
	pdf.Text(155, 20, "QUOTATION")
	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(100, 116, 139)
	pdf.Text(155, 26, "#"+quotationNumber)

	// Divider
	pdf.SetDrawColor(226, 232, 240) // #e2e8f0
	pdf.Line(15, 35, 195, 35)

	// ─── Info Section ────────────────────
	infoY := 42.0

	// Left: Customer Info
	customer, _ := q["customer"].(map[string]interface{})
	pdf.SetFont("Helvetica", "B", 8)
	pdf.SetTextColor(148, 163, 184) // #94a3b8
	pdf.Text(15, infoY, "BILL TO")

	contactPerson := "Walk-in Customer"
	if cp, ok := customer["contactPerson"].(string); ok && cp != "" {
		contactPerson = cp
	}
	pdf.SetFont("Helvetica", "B", 10)
	pdf.SetTextColor(30, 41, 59)
	pdf.Text(15, infoY+6, contactPerson)

	lineY := infoY + 12.0
	pdf.SetFont("Helvetica", "", 8)
	pdf.SetTextColor(100, 116, 139)
	if cn, ok := customer["companyName"].(string); ok && cn != "" {
		pdf.Text(15, lineY, cn)
		lineY += 4
	}
	if addr, ok := customer["address"].(string); ok && addr != "" {
		pdf.Text(15, lineY, addr)
		lineY += 4
	}
	if ph, ok := customer["phone"].(string); ok && ph != "" {
		pdf.Text(15, lineY, "Phone: "+ph)
		lineY += 4
	}
	if em, ok := customer["email"].(string); ok && em != "" {
		pdf.Text(15, lineY, "Email: "+em)
	}

	// Right: Details
	pdf.SetFont("Helvetica", "B", 8)
	pdf.SetTextColor(148, 163, 184)
	pdf.Text(155, infoY, "DETAILS")

	pdf.SetFont("Helvetica", "", 8)
	pdf.SetTextColor(100, 116, 139)
	createdAt, _ := q["createdAt"].(string)
	validUntil, _ := q["validUntil"].(string)
	status, _ := q["status"].(string)
	pdf.Text(155, infoY+6, "Date: "+formatDatePDF(createdAt))
	pdf.Text(155, infoY+10, "Valid Until: "+formatDatePDF(validUntil))
	pdf.Text(155, infoY+14, "Status: "+status)
	if createdBy, ok := q["createdBy"].(map[string]interface{}); ok {
		if name, ok := createdBy["name"].(string); ok {
			pdf.Text(155, infoY+18, "Created By: "+name)
		}
	}

	// ─── Items Table ─────────────────────
	tableY := infoY + 35

	// Table header
	pdf.SetFillColor(241, 245, 249) // #f1f5f9
	pdf.Rect(15, tableY, 180, 8, "F")
	pdf.SetFont("Helvetica", "B", 7)
	pdf.SetTextColor(71, 85, 105) // #475569

	pdf.Text(17, tableY+5, "#")
	pdf.Text(25, tableY+5, "Product")
	pdf.Text(100, tableY+5, "Qty")
	pdf.Text(115, tableY+5, "Unit Price")
	pdf.Text(143, tableY+5, "Disc %")
	pdf.Text(165, tableY+5, "Total")

	tableY += 8

	// Table rows
	items, _ := q["items"].([]map[string]interface{})
	for idx, item := range items {
		if tableY > 260 {
			pdf.AddPage()
			tableY = 20
		}

		if idx%2 == 0 {
			pdf.SetFillColor(250, 251, 252) // #fafbfc
			pdf.Rect(15, tableY, 180, 7, "F")
		}

		productName, _ := item["productName"].(string)
		quantity := getIntFromInterface(item["quantity"])
		unitPrice := getFloatFromInterface(item["unitPrice"])
		discountPercent := getFloatFromInterface(item["discountPercent"])
		lineTotal := getFloatFromInterface(item["lineTotal"])

		pdf.SetFont("Helvetica", "", 8)
		pdf.SetTextColor(51, 65, 85) // #334155
		pdf.Text(17, tableY+5, fmt.Sprintf("%d", idx+1))
		// Truncate product name if too long
		if len(productName) > 40 {
			productName = productName[:40] + "..."
		}
		pdf.Text(25, tableY+5, productName)
		pdf.Text(100, tableY+5, fmt.Sprintf("%d", quantity))
		pdf.Text(115, tableY+5, formatCurrencyPDF(unitPrice))
		pdf.Text(143, tableY+5, fmt.Sprintf("%.0f%%", discountPercent))
		pdf.Text(165, tableY+5, formatCurrencyPDF(lineTotal))

		tableY += 7
	}

	// Bottom border
	pdf.SetDrawColor(226, 232, 240)
	pdf.Line(15, tableY, 195, tableY)

	// ─── Totals ──────────────────────────
	tableY += 6

	subtotal := getFloatFromInterface(q["subtotal"])
	discountAmount := getFloatFromInterface(q["discountAmount"])
	total := getFloatFromInterface(q["total"])

	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(100, 116, 139)
	pdf.Text(135, tableY, "Subtotal")
	pdf.SetTextColor(30, 41, 59)
	pdf.Text(165, tableY, formatCurrencyPDF(subtotal))
	tableY += 6

	if discountAmount > 0 {
		pdf.SetTextColor(100, 116, 139)
		pdf.Text(135, tableY, "Discount")
		pdf.SetTextColor(30, 41, 59)
		pdf.Text(165, tableY, "-"+formatCurrencyPDF(discountAmount))
		tableY += 6
	}

	// Total highlight
	pdf.SetFillColor(241, 245, 249)
	pdf.Rect(130, tableY-4, 65, 9, "F")
	pdf.SetFont("Helvetica", "B", 10)
	pdf.SetTextColor(30, 41, 59)
	pdf.Text(135, tableY+2, "TOTAL")
	pdf.SetTextColor(79, 70, 229)
	pdf.Text(165, tableY+2, formatCurrencyPDF(total))
	tableY += 12

	// ─── Notes ───────────────────────────
	if notes, ok := q["notes"].(string); ok && notes != "" {
		pdf.SetFont("Helvetica", "B", 8)
		pdf.SetTextColor(148, 163, 184)
		pdf.Text(15, tableY, "NOTES")
		pdf.SetFont("Helvetica", "", 8)
		pdf.SetTextColor(100, 116, 139)
		pdf.Text(15, tableY+5, notes)
	}

	// ─── Footer ──────────────────────────
	footerY := 280.0
	pdf.SetDrawColor(226, 232, 240)
	pdf.Line(15, footerY, 195, footerY)
	pdf.SetFont("Helvetica", "", 8)
	pdf.SetTextColor(148, 163, 184)
	pdf.Text(60, footerY+5, "Thank you for your business!")
	pdf.SetFont("Helvetica", "", 6)
	pdf.Text(42, footerY+10, "This is a computer-generated document. No signature required.")

	// Output
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("failed to generate PDF: %w", err)
	}
	return buf.Bytes(), nil
}

func formatDatePDF(dateStr string) string {
	if dateStr == "" {
		return "-"
	}
	// Try to parse and reformat
	if len(dateStr) >= 10 {
		return dateStr[:10]
	}
	return dateStr
}

func getFloatFromInterface(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case string:
		var f float64
		fmt.Sscanf(val, "%f", &f)
		return f
	default:
		return 0
	}
}

func getIntFromInterface(v interface{}) int {
	switch val := v.(type) {
	case int:
		return val
	case int64:
		return int(val)
	case float64:
		return int(val)
	case string:
		var i int
		fmt.Sscanf(val, "%d", &i)
		return i
	default:
		return 0
	}
}

func getStringSlice(q map[string]interface{}, key string) []map[string]interface{} {
	if v, ok := q[key]; ok {
		if items, ok := v.([]map[string]interface{}); ok {
			return items
		}
	}
	return nil
}

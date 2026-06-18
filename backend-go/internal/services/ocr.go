package services

import (
	"bytes"
	"fmt"
	"log"
	"os/exec"
	"path/filepath"
	"strings"

	pdfread "github.com/ledongthuc/pdf"
)

// ExtractText extracts text from an image or PDF file.
func ExtractText(filePath, fileType string) (string, error) {
	ext := strings.ToLower(fileType)
	if ext == "" {
		ext = strings.ToLower(filepath.Ext(filePath))
	}

	if ext == ".pdf" || ext == "application/pdf" {
		return extractTextFromPDF(filePath)
	}
	return extractTextFromImage(filePath)
}

// extractTextFromImage uses the Tesseract CLI for OCR.
func extractTextFromImage(filePath string) (string, error) {
	log.Printf("  🔍 Running OCR on image: %s", filepath.Base(filePath))

	cmd := exec.Command("tesseract", filePath, "stdout", "-l", "eng")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("tesseract OCR failed: %w\nStderr: %s\nIs Tesseract installed? Install from https://github.com/tesseract-ocr/tesseract", err, stderr.String())
	}

	log.Println("  ✅ OCR complete")
	return stdout.String(), nil
}

// extractTextFromPDF extracts text from a PDF using ledongthuc/pdf.
func extractTextFromPDF(filePath string) (string, error) {
	log.Printf("  📄 Extracting text from PDF: %s", filepath.Base(filePath))

	f, r, err := pdfread.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open PDF: %w", err)
	}
	defer f.Close()

	var text strings.Builder
	totalPages := r.NumPage()

	for i := 1; i <= totalPages; i++ {
		p := r.Page(i)
		if p.V.IsNull() {
			continue
		}
		rows, err := p.GetTextByRow()
		if err != nil {
			continue
		}
		for _, row := range rows {
			for _, word := range row.Content {
				text.WriteString(word.S)
			}
			text.WriteString("\n")
		}
	}

	log.Printf("  ✅ PDF text extracted (%d pages)", totalPages)
	return text.String(), nil
}

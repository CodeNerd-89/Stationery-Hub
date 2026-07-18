package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
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

// ocrSpaceResponse represents the JSON response from OCR.space API.
type ocrSpaceResponse struct {
	ParsedResults []struct {
		ParsedText string `json:"ParsedText"`
	} `json:"ParsedResults"`
	IsErroredOnProcessing bool   `json:"IsErroredOnProcessing"`
	ErrorMessage          []string `json:"ErrorMessage"`
}

// extractTextFromImage uses the OCR.space free API for OCR.
func extractTextFromImage(filePath string) (string, error) {
	log.Printf("  🔍 Running OCR (OCR.space) on image: %s", filepath.Base(filePath))

	// Open the image file
	f, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open image file: %w", err)
	}
	defer f.Close()

	// Build multipart form body
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	// Add API key
	writer.WriteField("apikey", "helloworld")
	writer.WriteField("language", "eng")
	writer.WriteField("isOverlayRequired", "false")

	// Attach the image file
	part, err := writer.CreateFormFile("file", filepath.Base(filePath))
	if err != nil {
		return "", fmt.Errorf("failed to create form file: %w", err)
	}
	if _, err := io.Copy(part, f); err != nil {
		return "", fmt.Errorf("failed to copy file to form: %w", err)
	}
	writer.Close()

	// Send POST request to OCR.space
	req, err := http.NewRequest("POST", "https://api.ocr.space/parse/image", &body)
	if err != nil {
		return "", fmt.Errorf("failed to create OCR request: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("OCR.space API request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read OCR response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("OCR.space API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	// Parse response JSON
	var ocrResp ocrSpaceResponse
	if err := json.Unmarshal(respBody, &ocrResp); err != nil {
		return "", fmt.Errorf("failed to parse OCR response: %w", err)
	}

	if ocrResp.IsErroredOnProcessing {
		return "", fmt.Errorf("OCR.space processing error: %v", ocrResp.ErrorMessage)
	}

	if len(ocrResp.ParsedResults) == 0 {
		return "", fmt.Errorf("OCR.space returned no results")
	}

	log.Println("  ✅ OCR complete (OCR.space)")
	return ocrResp.ParsedResults[0].ParsedText, nil
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

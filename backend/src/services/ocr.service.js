// ─── OCR Service ─────────────────────────────────────
// Extracts text from images (Tesseract.js) and PDFs (pdf-parse)

const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

/**
 * Extract text from an image file using Tesseract.js OCR
 */
async function extractTextFromImage(filePath) {
  console.log(`  🔍 Running OCR on image: ${path.basename(filePath)}`);
  
  const { data } = await Tesseract.recognize(filePath, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        process.stdout.write(`\r  OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  console.log('\n  ✅ OCR complete');
  return data.text;
}

/**
 * Extract text from a PDF file using pdf-parse
 */
async function extractTextFromPDF(filePath) {
  console.log(`  📄 Extracting text from PDF: ${path.basename(filePath)}`);
  
  const pdfParse = require('pdf-parse');
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);
  
  console.log(`  ✅ PDF text extracted (${pdfData.numpages} pages)`);
  return pdfData.text;
}

/**
 * Extract text from any supported file
 */
async function extractText(filePath, fileType) {
  const ext = fileType?.toLowerCase() || path.extname(filePath).toLowerCase();

  if (['.pdf', 'application/pdf'].includes(ext)) {
    return extractTextFromPDF(filePath);
  }

  // Default: treat as image
  return extractTextFromImage(filePath);
}

module.exports = { extractText, extractTextFromImage, extractTextFromPDF };

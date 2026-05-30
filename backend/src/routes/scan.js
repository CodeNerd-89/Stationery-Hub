// ─── Scan Routes ─────────────────────────────────────
// Upload & OCR processing of purchase orders

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { extractText } = require('../services/ocr.service');
const { parseExtractedItems, matchWithCatalog } = require('../services/matching.service');

// ─── Multer Config ───────────────────────────────────
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `scan_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP images and PDF files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ─── POST /api/scan/upload ───────────────────────────
// Upload a file, run OCR, parse items, fuzzy-match with catalog
router.post(
  '/upload',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const filePath = req.file.path;
      const fileType = req.file.mimetype;

      // Step 1: Extract text via OCR / PDF parse
      console.log('\n📄 Starting scan pipeline...');
      const rawText = await extractText(filePath, fileType);

      // Step 2: Parse items from extracted text
      const extractedItems = parseExtractedItems(rawText);
      console.log(`  📝 Extracted ${extractedItems.length} items from text`);

      // Step 3: Fetch all active products
      const products = await prisma.product.findMany({
        where: { isActive: true },
        include: { category: true },
      });

      // Step 4: Fuzzy-match extracted items with catalog
      const matchedItems = matchWithCatalog(extractedItems, products);
      console.log(`  🎯 Matched ${matchedItems.filter((m) => m.matchedProduct).length}/${matchedItems.length} items`);

      // Step 5: Save scan job to database
      const scanJob = await prisma.scanJob.create({
        data: {
          uploadedById: req.user.id,
          fileUrl: `/uploads/${req.file.filename}`,
          fileType: fileType,
          rawText: rawText,
          extractedItems: matchedItems,
          status: 'COMPLETED',
        },
      });

      console.log(`  ✅ Scan job ${scanJob.id} saved\n`);

      res.json({
        scanJobId: scanJob.id,
        rawText,
        extractedItems,
        matchedItems,
        stats: {
          totalExtracted: extractedItems.length,
          autoMatched: matchedItems.filter((m) => m.confidence > 0.6).length,
          needsReview: matchedItems.filter((m) => m.confidence > 0.3 && m.confidence <= 0.6).length,
          unmatched: matchedItems.filter((m) => m.confidence <= 0.3).length,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/scan/:scanJobId/create-quotation ─────
// Create a quotation from scan results
router.post(
  '/:scanJobId/create-quotation',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  async (req, res, next) => {
    try {
      const { scanJobId } = req.params;
      const { customerId, items, notes } = req.body;

      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'At least one item is required' });
      }

      // Verify scan job exists
      const scanJob = await prisma.scanJob.findUnique({ where: { id: scanJobId } });
      if (!scanJob) {
        return res.status(404).json({ error: 'Scan job not found' });
      }

      // Generate quotation number
      const lastQ = await prisma.quotation.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { quotationNumber: true },
      });
      const nextNum = lastQ
        ? parseInt(lastQ.quotationNumber.replace('QT-', ''), 10) + 1
        : 1001;
      const quotationNumber = `QT-${nextNum}`;

      // Calculate totals
      const quotationItems = items.map((item) => {
        const qty = parseInt(item.quantity, 10) || 1;
        const unitPrice = parseFloat(item.unitPrice) || 0;
        const discountPercent = parseFloat(item.discountPercent) || 0;
        const lineTotal = qty * unitPrice * (1 - discountPercent / 100);

        return {
          productId: item.productId || null,
          productName: item.productName,
          quantity: qty,
          unitPrice,
          discountPercent,
          lineTotal: Math.round(lineTotal * 100) / 100,
        };
      });

      const subtotal = quotationItems.reduce((sum, i) => sum + i.lineTotal, 0);

      // Create quotation with items
      const quotation = await prisma.quotation.create({
        data: {
          quotationNumber,
          customerId: customerId || null,
          createdById: req.user.id,
          status: 'DRAFT',
          subtotal,
          total: subtotal,
          notes: notes || null,
          items: { create: quotationItems },
        },
        include: {
          items: { include: { product: true } },
          customer: true,
          createdBy: { select: { name: true, email: true } },
        },
      });

      // Link scan job to quotation
      await prisma.scanJob.update({
        where: { id: scanJobId },
        data: { quotationId: quotation.id },
      });

      res.status(201).json(quotation);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

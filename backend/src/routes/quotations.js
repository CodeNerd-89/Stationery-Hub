const express = require('express');
const prisma = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { generateQuotationPDF } = require('../services/pdf.service');

const router = express.Router();
router.use(authenticate);

// Generate quotation number: QT-20260508-001
const generateQuotationNumber = async () => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `QT-${dateStr}`;

  const lastQuotation = await prisma.quotation.findFirst({
    where: { quotationNumber: { startsWith: prefix } },
    orderBy: { quotationNumber: 'desc' },
  });

  let sequence = 1;
  if (lastQuotation) {
    const lastSeq = parseInt(lastQuotation.quotationNumber.split('-').pop());
    sequence = lastSeq + 1;
  }

  return `${prefix}-${String(sequence).padStart(3, '0')}`;
};

// ─── Get All Quotations ──────────────────────────────
router.get('/', authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { status, customerId, search, page = 1, limit = 20 } = req.query;

    const where = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { quotationNumber: { contains: search, mode: 'insensitive' } },
        { customer: { contactPerson: { contains: search, mode: 'insensitive' } } },
        { customer: { companyName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        include: {
          customer: { select: { id: true, contactPerson: true, companyName: true } },
          createdBy: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.quotation.count({ where }),
    ]);

    res.json({
      quotations,
      pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (error) {
    next(error);
  }
});

// ─── Get Quotation by ID ─────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        createdBy: { select: { name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, imageUrl: true } },
          },
        },
        scanJob: { select: { id: true, fileUrl: true, status: true } },
      },
    });

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }

    // Customers can only see their own quotations
    if (req.user.role === 'CUSTOMER') {
      const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } });
      if (!customer || quotation.customerId !== customer.id) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }

    res.json({ quotation });
  } catch (error) {
    next(error);
  }
});

// ─── Create Quotation ────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { customerId, items, notes, validUntil, discountAmount } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required.' });
    }

    const quotationNumber = await generateQuotationNumber();

    // Calculate totals
    let subtotal = 0;
    const itemsData = items.map((item) => {
      const lineTotal = item.quantity * item.unitPrice * (1 - (item.discountPercent || 0) / 100);
      subtotal += lineTotal;
      return {
        productId: item.productId || null,
        productName: item.productName,
        quantity: parseInt(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        discountPercent: parseFloat(item.discountPercent) || 0,
        lineTotal: Math.round(lineTotal * 100) / 100,
        notes: item.notes || null,
      };
    });

    const discount = parseFloat(discountAmount) || 0;
    const total = Math.round((subtotal - discount) * 100) / 100;

    // If user is a CUSTOMER and no customerId, auto-link or create customer record
    let resolvedCustomerId = customerId || null;
    if (!resolvedCustomerId && req.user.role === 'CUSTOMER') {
      let customer = await prisma.customer.findUnique({ where: { userId: req.user.id } });
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            userId: req.user.id,
            contactPerson: req.user.name,
            email: req.user.email,
            phone: req.user.phone || null,
          },
        });
      }
      resolvedCustomerId = customer.id;
    }

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        customerId: resolvedCustomerId,
        createdById: req.user.id,
        status: 'DRAFT',
        subtotal,
        discountAmount: discount,
        total,
        notes: notes || null,
        validUntil: validUntil ? new Date(validUntil) : null,
        items: {
          create: itemsData,
        },
      },
      include: {
        customer: true,
        items: { include: { product: true } },
        createdBy: { select: { name: true } },
      },
    });

    res.status(201).json({ message: 'Quotation created.', quotation });
  } catch (error) {
    next(error);
  }
});

// ─── Update Quotation ────────────────────────────────
router.put('/:id', authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { customerId, items, notes, validUntil, discountAmount, status } = req.body;

    const existing = await prisma.quotation.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Quotation not found.' });

    // Only allow editing draft quotations
    if (existing.status !== 'DRAFT' && !status) {
      return res.status(400).json({ error: 'Can only edit draft quotations.' });
    }

    const data = {};
    if (customerId !== undefined) data.customerId = customerId;
    if (notes !== undefined) data.notes = notes;
    if (validUntil) data.validUntil = new Date(validUntil);
    if (status) data.status = status;

    // Recalculate if items provided
    if (items && items.length > 0) {
      // Delete existing items
      await prisma.quotationItem.deleteMany({ where: { quotationId: req.params.id } });

      let subtotal = 0;
      const itemsData = items.map((item) => {
        const lineTotal = item.quantity * item.unitPrice * (1 - (item.discountPercent || 0) / 100);
        subtotal += lineTotal;
        return {
          quotationId: req.params.id,
          productId: item.productId || null,
          productName: item.productName,
          quantity: parseInt(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
          discountPercent: parseFloat(item.discountPercent) || 0,
          lineTotal: Math.round(lineTotal * 100) / 100,
          notes: item.notes || null,
        };
      });

      await prisma.quotationItem.createMany({ data: itemsData });

      const discount = parseFloat(discountAmount) || existing.discountAmount || 0;
      data.subtotal = subtotal;
      data.discountAmount = discount;
      data.total = Math.round((subtotal - discount) * 100) / 100;
    }

    const quotation = await prisma.quotation.update({
      where: { id: req.params.id },
      data,
      include: {
        customer: true,
        items: { include: { product: true } },
        createdBy: { select: { name: true } },
      },
    });

    res.json({ message: 'Quotation updated.', quotation });
  } catch (error) {
    next(error);
  }
});

// ─── Convert Quotation to Order ──────────────────────
router.post('/:id/convert', authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: { customer: true },
    });

    if (!quotation) return res.status(404).json({ error: 'Quotation not found.' });
    if (quotation.status !== 'ACCEPTED') {
      return res.status(400).json({ error: 'Only accepted quotations can be converted to orders.' });
    }
    if (!quotation.customerId) {
      return res.status(400).json({ error: 'Quotation must have a customer to create an order.' });
    }

    // Generate order number
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const orderCount = await prisma.order.count();
    const orderNumber = `ORD-${today}-${String(orderCount + 1).padStart(3, '0')}`;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        quotationId: quotation.id,
        customerId: quotation.customerId,
        total: quotation.total,
        notes: req.body.notes || null,
      },
      include: {
        quotation: { include: { items: true } },
        customer: true,
      },
    });

    // Update quotation status
    await prisma.quotation.update({
      where: { id: req.params.id },
      data: { status: 'ACCEPTED' },
    });

    res.status(201).json({ message: 'Order created from quotation.', order });
  } catch (error) {
    next(error);
  }
});

// ─── Download Quotation PDF ──────────────────────────
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        createdBy: { select: { name: true, email: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } },
          },
        },
      },
    });

    if (!quotation) {
      return res.status(404).json({ error: 'Quotation not found.' });
    }

    const pdfBuffer = await generateQuotationPDF(quotation);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${quotation.quotationNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

// ─── Delete Quotation ────────────────────────────────
router.delete('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    await prisma.quotation.delete({ where: { id: req.params.id } });
    res.json({ message: 'Quotation deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

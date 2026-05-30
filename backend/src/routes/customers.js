const express = require('express');
const prisma = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ─── Get All Customers ───────────────────────────────
router.get('/', authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          _count: { select: { quotations: true, orders: true } },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      customers,
      pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (error) {
    next(error);
  }
});

// ─── Get Customer by ID ──────────────────────────────
router.get('/:id', authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        quotations: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: { select: { name: true } },
          },
        },
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        user: {
          select: { email: true, name: true },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    res.json({ customer });
  } catch (error) {
    next(error);
  }
});

// ─── Create Customer ─────────────────────────────────
router.post('/', authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { companyName, contactPerson, phone, email, address, notes } = req.body;

    if (!contactPerson) {
      return res.status(400).json({ error: 'Contact person name is required.' });
    }

    const customer = await prisma.customer.create({
      data: {
        companyName: companyName || null,
        contactPerson,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
      },
    });

    res.status(201).json({ message: 'Customer created.', customer });
  } catch (error) {
    next(error);
  }
});

// ─── Update Customer ─────────────────────────────────
router.put('/:id', authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { companyName, contactPerson, phone, email, address, notes } = req.body;

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        companyName,
        contactPerson,
        phone,
        email,
        address,
        notes,
      },
    });

    res.json({ message: 'Customer updated.', customer });
  } catch (error) {
    next(error);
  }
});

// ─── Delete Customer ─────────────────────────────────
router.delete('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const orderCount = await prisma.order.count({
      where: { customerId: req.params.id },
    });

    if (orderCount > 0) {
      return res.status(400).json({
        error: `Cannot delete customer with ${orderCount} order(s). Archive instead.`,
      });
    }

    await prisma.customer.delete({ where: { id: req.params.id } });
    res.json({ message: 'Customer deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

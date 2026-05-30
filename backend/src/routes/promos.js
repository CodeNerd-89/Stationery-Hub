const express = require('express');
const prisma = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(authorize('ADMIN'));

// ─── Get All Promo Codes ─────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const promos = await prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ promos });
  } catch (error) {
    next(error);
  }
});

// ─── Create Promo Code ───────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { code, discountType, discountValue, validFrom, validUntil, usageLimit, minOrderAmount } = req.body;

    if (!code || !discountType || !discountValue || !validUntil) {
      return res.status(400).json({ error: 'Code, discount type, value, and valid until date are required.' });
    }

    const promo = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        discountType,
        discountValue: parseFloat(discountValue),
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: new Date(validUntil),
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null,
      },
    });

    res.status(201).json({ message: 'Promo code created.', promo });
  } catch (error) {
    next(error);
  }
});

// ─── Update Promo Code ───────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const { code, discountType, discountValue, validFrom, validUntil, usageLimit, isActive, minOrderAmount } = req.body;

    const promo = await prisma.promoCode.update({
      where: { id: req.params.id },
      data: {
        ...(code && { code: code.toUpperCase() }),
        ...(discountType && { discountType }),
        ...(discountValue && { discountValue: parseFloat(discountValue) }),
        ...(validFrom && { validFrom: new Date(validFrom) }),
        ...(validUntil && { validUntil: new Date(validUntil) }),
        ...(usageLimit !== undefined && { usageLimit: usageLimit ? parseInt(usageLimit) : null }),
        ...(isActive !== undefined && { isActive }),
        ...(minOrderAmount !== undefined && { minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null }),
      },
    });

    res.json({ message: 'Promo code updated.', promo });
  } catch (error) {
    next(error);
  }
});

// ─── Delete Promo Code ───────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.promoCode.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ message: 'Promo code deactivated.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

const express = require('express');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ─── Get Wishlist ────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const wishlist = await prisma.wishlist.findMany({
      where: { userId: req.user.id },
      include: {
        product: {
          include: { category: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ wishlist });
  } catch (error) {
    next(error);
  }
});

// ─── Toggle Wishlist ─────────────────────────────────
router.post('/:productId', async (req, res, next) => {
  try {
    const existing = await prisma.wishlist.findUnique({
      where: {
        userId_productId: { userId: req.user.id, productId: req.params.productId },
      },
    });

    if (existing) {
      await prisma.wishlist.delete({ where: { id: existing.id } });
      return res.json({ message: 'Removed from wishlist.', wishlisted: false });
    }

    const product = await prisma.product.findUnique({ where: { id: req.params.productId } });
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    await prisma.wishlist.create({
      data: { userId: req.user.id, productId: req.params.productId },
    });

    res.status(201).json({ message: 'Added to wishlist.', wishlisted: true });
  } catch (error) {
    next(error);
  }
});

// ─── Remove from Wishlist ────────────────────────────
router.delete('/:productId', async (req, res, next) => {
  try {
    await prisma.wishlist.deleteMany({
      where: { userId: req.user.id, productId: req.params.productId },
    });
    res.json({ message: 'Removed from wishlist.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

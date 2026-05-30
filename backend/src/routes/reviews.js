const express = require('express');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Helper: recalculate product rating
const updateProductRating = async (productId) => {
  const result = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      averageRating: result._avg.rating || 0,
      reviewCount: result._count.rating || 0,
    },
  });
};

// ─── Get Reviews for Product ─────────────────────────
router.get('/product/:productId', async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { productId: req.params.productId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.review.count({ where: { productId: req.params.productId } }),
    ]);

    // Get rating distribution
    const distribution = await prisma.review.groupBy({
      by: ['rating'],
      where: { productId: req.params.productId },
      _count: true,
    });

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach(d => { ratingDistribution[d.rating] = d._count; });

    res.json({
      reviews,
      ratingDistribution,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
});

// ─── Create/Update Review ────────────────────────────
router.post('/product/:productId', authenticate, async (req, res, next) => {
  try {
    const { rating, title, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    const product = await prisma.product.findUnique({ where: { id: req.params.productId } });
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const review = await prisma.review.upsert({
      where: {
        userId_productId: { userId: req.user.id, productId: req.params.productId },
      },
      update: { rating, title, comment },
      create: {
        userId: req.user.id,
        productId: req.params.productId,
        rating,
        title,
        comment,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    await updateProductRating(req.params.productId);

    res.status(201).json({ message: 'Review submitted.', review });
  } catch (error) {
    next(error);
  }
});

// ─── Delete Review ───────────────────────────────────
router.delete('/:reviewId', authenticate, async (req, res, next) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.reviewId } });
    if (!review) return res.status(404).json({ error: 'Review not found.' });

    if (review.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You can only delete your own reviews.' });
    }

    await prisma.review.delete({ where: { id: req.params.reviewId } });
    await updateProductRating(review.productId);

    res.json({ message: 'Review deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

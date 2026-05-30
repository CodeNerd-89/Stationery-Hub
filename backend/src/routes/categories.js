const express = require('express');
const prisma = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ─── Get All Categories (Public) ─────────────────────
router.get('/', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });
    res.json({ categories });
  } catch (error) {
    next(error);
  }
});

// ─── Get Category by ID (Public) ─────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: {
        products: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    res.json({ category });
  } catch (error) {
    next(error);
  }
});

// ─── Create Category (Admin) ─────────────────────────
router.post('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { name, description, imageUrl, sortOrder } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description: description || null,
        imageUrl: imageUrl || null,
        sortOrder: sortOrder || 0,
      },
    });

    res.status(201).json({ message: 'Category created.', category });
  } catch (error) {
    next(error);
  }
});

// ─── Update Category (Admin) ─────────────────────────
router.put('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { name, description, imageUrl, sortOrder } = req.body;

    const data = {};
    if (name) {
      data.name = name;
      data.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (description !== undefined) data.description = description;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ message: 'Category updated.', category });
  } catch (error) {
    next(error);
  }
});

// ─── Delete Category (Admin) ─────────────────────────
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    // Check if category has products
    const productCount = await prisma.product.count({
      where: { categoryId: req.params.id },
    });

    if (productCount > 0) {
      return res.status(400).json({
        error: `Cannot delete category. It has ${productCount} products. Move or delete them first.`,
      });
    }

    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ message: 'Category deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

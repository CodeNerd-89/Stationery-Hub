const express = require('express');
const prisma = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ─── Get All Products (Public, with search & filter) ─
router.get('/', async (req, res, next) => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      sortBy = 'name',
      order = 'asc',
      page = 1,
      limit = 20,
    } = req.query;

    const where = { isActive: true };

    // Search by name or SKU
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by category
    if (category) {
      where.categoryId = category;
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }

    // Sorting
    const validSorts = ['name', 'price', 'createdAt', 'stock'];
    const sortField = validSorts.includes(sortBy) ? sortBy : 'name';
    const sortOrder = order === 'desc' ? 'desc' : 'asc';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { [sortField]: sortOrder },
        skip,
        take,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── Get All Products (Admin - includes inactive) ────
router.get('/admin/all', authenticate, authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { search, category, page = 1, limit = 50 } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.categoryId = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── Get Product by ID or Slug (Public) ──────────────
router.get('/:idOrSlug', async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;

    // Try by ID first, then by slug
    let product = await prisma.product.findUnique({
      where: { id: idOrSlug },
      include: { category: true },
    });

    if (!product) {
      product = await prisma.product.findUnique({
        where: { slug: idOrSlug },
        include: { category: true },
      });
    }

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    res.json({ product });
  } catch (error) {
    next(error);
  }
});

// ─── Create Product (Admin) ──────────────────────────
router.post('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { name, sku, categoryId, description, price, stock, unit, imageUrl, isActive } = req.body;

    if (!name || !sku || !categoryId || price === undefined) {
      return res.status(400).json({
        error: 'Name, SKU, category, and price are required.',
      });
    }

    // Verify category exists
    const categoryExists = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!categoryExists) {
      return res.status(400).json({ error: 'Category not found.' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        sku: sku.toUpperCase(),
        categoryId,
        description: description || null,
        price: parseFloat(price),
        stock: parseInt(stock) || 0,
        unit: unit || 'pc',
        imageUrl: imageUrl || null,
        isActive: isActive !== false,
      },
      include: { category: true },
    });

    res.status(201).json({ message: 'Product created.', product });
  } catch (error) {
    next(error);
  }
});

// ─── Update Product (Admin) ──────────────────────────
router.put('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { name, sku, categoryId, description, price, stock, unit, imageUrl, isActive } = req.body;

    const data = {};
    if (name) {
      data.name = name;
      data.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (sku) data.sku = sku.toUpperCase();
    if (categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!cat) return res.status(400).json({ error: 'Category not found.' });
      data.categoryId = categoryId;
    }
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = parseFloat(price);
    if (stock !== undefined) data.stock = parseInt(stock);
    if (unit) data.unit = unit;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (isActive !== undefined) data.isActive = isActive;

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
      include: { category: true },
    });

    res.json({ message: 'Product updated.', product });
  } catch (error) {
    next(error);
  }
});

// ─── Delete Product (Admin) ──────────────────────────
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    // Soft delete - just mark as inactive
    await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ message: 'Product deactivated.' });
  } catch (error) {
    next(error);
  }
});

// ─── Hard Delete Product (Admin) ─────────────────────
router.delete('/:id/permanent', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    // Check if product is in any quotation
    const quotationCount = await prisma.quotationItem.count({
      where: { productId: req.params.id },
    });

    if (quotationCount > 0) {
      return res.status(400).json({
        error: `Cannot permanently delete. Product is referenced in ${quotationCount} quotation(s). Use deactivate instead.`,
      });
    }

    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ message: 'Product permanently deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

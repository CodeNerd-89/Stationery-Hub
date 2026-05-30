const express = require('express');
const prisma = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ─── Dashboard Stats (Admin) ─────────────────────────
router.get('/stats', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const [
      totalProducts,
      activeProducts,
      totalCategories,
      totalCustomers,
      totalQuotations,
      totalOrders,
      pendingOrders,
      totalUsers,
      recentQuotations,
      recentOrders,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.category.count(),
      prisma.customer.count(),
      prisma.quotation.count(),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.user.count(),
      prisma.quotation.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { contactPerson: true, companyName: true } },
          createdBy: { select: { name: true } },
        },
      }),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { contactPerson: true, companyName: true } },
        },
      }),
    ]);

    // Quotation status breakdown
    const quotationsByStatus = await prisma.quotation.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    // Orders status breakdown
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    // Revenue (from completed orders)
    const revenue = await prisma.order.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { total: true },
    });

    // Low stock products (less than 10)
    const lowStockProducts = await prisma.product.findMany({
      where: { stock: { lte: 10 }, isActive: true },
      orderBy: { stock: 'asc' },
      take: 10,
      include: { category: { select: { name: true } } },
    });

    res.json({
      stats: {
        totalProducts,
        activeProducts,
        totalCategories,
        totalCustomers,
        totalQuotations,
        totalOrders,
        pendingOrders,
        totalUsers,
        revenue: revenue._sum.total || 0,
      },
      quotationsByStatus: quotationsByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {}),
      ordersByStatus: ordersByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {}),
      recentQuotations,
      recentOrders,
      lowStockProducts,
    });
  } catch (error) {
    next(error);
  }
});

// ─── Manage Users (Admin) ────────────────────────────
router.get('/users', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;

    const where = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
          phone: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (error) {
    next(error);
  }
});

// ─── Update User Role (Admin) ────────────────────────
router.put('/users/:id/role', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { role } = req.body;
    const validRoles = ['ADMIN', 'STAFF', 'CUSTOMER'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be ADMIN, STAFF, or CUSTOMER.' });
    }

    // Prevent changing own role
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot change your own role.' });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });

    res.json({ message: `User role updated to ${role}.`, user });
  } catch (error) {
    next(error);
  }
});

// ─── Delete User (Admin) ─────────────────────────────
router.delete('/users/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'User deleted.' });
  } catch (error) {
    next(error);
  }
});

// ─── Analytics Data (Admin) ──────────────────────────
router.get('/analytics', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ── Daily quotations for last 7 days ──
    const dailyQuotations = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const count = await prisma.quotation.count({
        where: { createdAt: { gte: dayStart, lte: dayEnd } },
      });
      dailyQuotations.push({
        date: dayStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        count,
      });
    }

    // ── Daily new users for last 7 days ──
    const dailyUsers = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const count = await prisma.user.count({
        where: { createdAt: { gte: dayStart, lte: dayEnd } },
      });
      dailyUsers.push({
        date: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
        count,
      });
    }

    // ── Top products by quotation demand ──
    const topItems = await prisma.quotationItem.groupBy({
      by: ['productName'],
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 8,
    });

    // ── Category distribution ──
    const categoryDist = await prisma.product.groupBy({
      by: ['categoryId'],
      _count: { id: true },
      where: { isActive: true },
    });
    const catIds = categoryDist.map((c) => c.categoryId).filter(Boolean);
    const catNames = await prisma.category.findMany({
      where: { id: { in: catIds } },
      select: { id: true, name: true },
    });
    const catMap = Object.fromEntries(catNames.map((c) => [c.id, c.name]));
    const categories = categoryDist.map((c) => ({
      name: catMap[c.categoryId] || 'Uncategorized',
      count: c._count.id,
    })).sort((a, b) => b.count - a.count);

    // ── Quotation conversion rate ──
    const totalQuotations = await prisma.quotation.count();
    const acceptedQuotations = await prisma.quotation.count({ where: { status: 'ACCEPTED' } });
    const conversionRate = totalQuotations > 0 ? Math.round((acceptedQuotations / totalQuotations) * 100) : 0;

    // ── New users last 30 days ──
    const newUsersMonth = await prisma.user.count({ where: { createdAt: { gte: last30Days } } });
    const newUsersWeek = await prisma.user.count({ where: { createdAt: { gte: last7Days } } });

    // ── Recent activity ──
    const recentActivity = [];
    const recentQ = await prisma.quotation.findMany({
      take: 5, orderBy: { createdAt: 'desc' },
      include: { customer: { select: { contactPerson: true } }, createdBy: { select: { name: true } } },
    });
    recentQ.forEach((q) => recentActivity.push({
      type: 'quotation', text: `Quotation ${q.quotationNumber} created`,
      detail: q.customer?.contactPerson || q.createdBy?.name || 'Unknown',
      time: q.createdAt, status: q.status,
    }));
    const recentU = await prisma.user.findMany({
      take: 5, orderBy: { createdAt: 'desc' },
      select: { name: true, email: true, role: true, createdAt: true },
    });
    recentU.forEach((u) => recentActivity.push({
      type: 'user', text: `${u.name} registered`,
      detail: u.email, time: u.createdAt, status: u.role,
    }));
    recentActivity.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json({
      dailyQuotations,
      dailyUsers,
      topProducts: topItems.map((i) => ({
        name: i.productName,
        totalQty: i._sum.quantity || 0,
        timesOrdered: i._count.id,
      })),
      categories,
      conversionRate,
      newUsersMonth,
      newUsersWeek,
      recentActivity: recentActivity.slice(0, 10),
    });
  } catch (error) {
    next(error);
  }
});

// ─── Delete Top Product Quotation Items (Admin) ─────
router.delete('/analytics/top-product', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { productName } = req.body;
    if (!productName) return res.status(400).json({ error: 'Product name is required.' });

    const deleted = await prisma.quotationItem.deleteMany({
      where: { productName: productName },
    });

    res.json({ message: `Deleted ${deleted.count} quotation items for "${productName}".`, count: deleted.count });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

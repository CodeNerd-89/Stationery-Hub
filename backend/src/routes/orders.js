const express = require('express');
const prisma = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { sendOrderStatusUpdateEmail } = require('../config/email');

const router = express.Router();
router.use(authenticate);

// ─── Get My Orders (Customer) ────────────────────────
router.get('/my', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    // Find customer record for this user
    const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } });
    if (!customer) {
      return res.json({ orders: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } });
    }

    const where = { customerId: customer.id };
    if (status) where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: { include: { product: { select: { imageUrl: true, slug: true, name: true, price: true } } } },
          quotation: { select: { quotationNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
      pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (error) {
    next(error);
  }
});

// ─── Get All Orders (Admin/Staff) ────────────────────
router.get('/', authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { status, customerId, orderType, page = 1, limit = 20 } = req.query;

    const where = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (orderType) where.orderType = orderType;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, contactPerson: true, companyName: true } },
          quotation: { select: { quotationNumber: true, _count: { select: { items: true } } } },
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
      pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (error) {
    next(error);
  }
});

// ─── Get New Order Count (Admin) ─────────────────────
router.get('/new-count', authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const count = await prisma.order.count({ where: { status: 'PENDING' } });
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

// ─── Get Order by ID ─────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        items: {
          include: { product: { select: { name: true, sku: true, imageUrl: true, slug: true } } },
        },
        quotation: {
          include: {
            items: {
              include: { product: { select: { name: true, sku: true, imageUrl: true } } },
            },
            createdBy: { select: { name: true } },
          },
        },
        timeline: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) return res.status(404).json({ error: 'Order not found.' });

    // Customers can only see their own orders
    if (req.user.role === 'CUSTOMER') {
      const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } });
      if (!customer || order.customerId !== customer.id) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }

    res.json({ order });
  } catch (error) {
    next(error);
  }
});

// ─── Get Order Timeline ──────────────────────────────
router.get('/:id/timeline', async (req, res, next) => {
  try {
    const timeline = await prisma.orderTimeline.findMany({
      where: { orderId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ timeline });
  } catch (error) {
    next(error);
  }
});

// ─── Update Order Status (Admin/Staff) ───────────────
router.put('/:id/status', authorize('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        customer: { select: { contactPerson: true, companyName: true, email: true, userId: true } },
      },
    });

    // Create timeline entry
    await prisma.orderTimeline.create({
      data: {
        orderId: req.params.id,
        status,
        note: note || `Status updated to ${status}`,
      },
    });

    // Send status update email to customer
    try {
      if (order.customer?.email) {
        await sendOrderStatusUpdateEmail(order.customer.email, order, status);
      }
    } catch (err) {
      console.error('Status update email failed:', err.message);
    }

    res.json({ message: `Order status updated to ${status}.`, order });
  } catch (error) {
    next(error);
  }
});

// ─── Cancel Order (Customer) ─────────────────────────
router.put('/:id/cancel', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });

    if (!order) return res.status(404).json({ error: 'Order not found.' });

    // Verify ownership
    const customer = await prisma.customer.findUnique({ where: { userId: req.user.id } });
    if (!customer || order.customerId !== customer.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (order.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending orders can be cancelled.' });
    }

    // Update order status
    await prisma.order.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });

    // Restore stock
    for (const item of order.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }

    // Create timeline entry
    await prisma.orderTimeline.create({
      data: {
        orderId: req.params.id,
        status: 'CANCELLED',
        note: 'Order cancelled by customer',
      },
    });

    res.json({ message: 'Order cancelled successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

const express = require('express');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { sendOrderConfirmationEmail, sendAdminNewOrderEmail } = require('../config/email');

const router = express.Router();
router.use(authenticate);

// ─── Place Order (B2C Direct Checkout) ───────────────
router.post('/', async (req, res, next) => {
  try {
    const { items, shippingAddress, shippingCity, shippingPhone, notes, promoCode, paymentMethod } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }
    if (!shippingAddress || !shippingCity || !shippingPhone) {
      return res.status(400).json({ error: 'Shipping address, city, and phone are required.' });
    }

    // Validate all products
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });

    if (products.length !== items.length) {
      return res.status(400).json({ error: 'Some products are unavailable.' });
    }

    // Check stock
    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (item.quantity > product.stock) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}. Available: ${product.stock}` });
      }
    }

    // Calculate totals
    let subtotal = 0;
    const orderItems = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      const lineTotal = Number(product.price) * item.quantity;
      subtotal += lineTotal;
      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: Number(product.price),
        lineTotal,
      };
    });

    // Apply promo code if provided
    let discount = 0;
    let appliedPromo = null;
    if (promoCode) {
      appliedPromo = await prisma.promoCode.findUnique({ where: { code: promoCode.toUpperCase() } });
      if (!appliedPromo || !appliedPromo.isActive) {
        return res.status(400).json({ error: 'Invalid promo code.' });
      }
      if (new Date() < appliedPromo.validFrom || new Date() > appliedPromo.validUntil) {
        return res.status(400).json({ error: 'Promo code has expired.' });
      }
      if (appliedPromo.usageLimit && appliedPromo.usedCount >= appliedPromo.usageLimit) {
        return res.status(400).json({ error: 'Promo code usage limit reached.' });
      }
      if (appliedPromo.minOrderAmount && subtotal < Number(appliedPromo.minOrderAmount)) {
        return res.status(400).json({ error: `Minimum order amount for this promo is ৳${Number(appliedPromo.minOrderAmount).toLocaleString()}.` });
      }

      if (appliedPromo.discountType === 'PERCENTAGE') {
        discount = subtotal * (Number(appliedPromo.discountValue) / 100);
      } else {
        discount = Number(appliedPromo.discountValue);
      }
      discount = Math.min(discount, subtotal); // Don't exceed subtotal
    }

    const shippingFee = subtotal >= 5000 ? 0 : 150;
    const total = subtotal - discount + shippingFee;

    // Generate order number
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await prisma.order.count() + 1;
    const orderNumber = `ORD-${today}-${count.toString().padStart(3, '0')}`;

    // Find or create customer record for this user
    let customer = await prisma.customer.findUnique({ where: { userId: req.user.id } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          userId: req.user.id,
          contactPerson: req.user.name,
          phone: shippingPhone,
          email: req.user.email,
          address: shippingAddress,
        },
      });
    }

    // Create order with items and initial timeline entry
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        status: 'PENDING',
        subtotal,
        discount,
        shippingFee,
        total,
        shippingAddress,
        shippingCity,
        shippingPhone,
        promoCode: promoCode ? promoCode.toUpperCase() : null,
        paymentMethod: paymentMethod || 'COD',
        orderType: 'B2C',
        notes: notes || null,
        items: {
          create: orderItems,
        },
        timeline: {
          create: {
            status: 'PENDING',
            note: 'Order placed successfully',
          },
        },
      },
      include: {
        items: true,
        customer: true,
        timeline: true,
      },
    });

    // Decrement stock
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Increment promo usage
    if (appliedPromo) {
      await prisma.promoCode.update({
        where: { id: appliedPromo.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    // Send confirmation email
    try {
      await sendOrderConfirmationEmail(req.user.email, order);
    } catch (err) {
      console.error('Order confirmation email failed:', err.message);
    }

    // Send admin notification email
    try {
      await sendAdminNewOrderEmail(order);
    } catch (err) {
      console.error('Admin notification email failed:', err.message);
    }

    res.status(201).json({
      message: 'Order placed successfully!',
      order,
    });
  } catch (error) {
    next(error);
  }
});

// ─── Validate Promo Code ─────────────────────────────
router.post('/validate-promo', async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Promo code is required.' });
    }

    const promo = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
    if (!promo || !promo.isActive) {
      return res.status(404).json({ error: 'Invalid promo code.' });
    }
    if (new Date() < promo.validFrom || new Date() > promo.validUntil) {
      return res.status(400).json({ error: 'Promo code has expired.' });
    }
    if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
      return res.status(400).json({ error: 'Promo code usage limit reached.' });
    }
    if (promo.minOrderAmount && subtotal && subtotal < Number(promo.minOrderAmount)) {
      return res.status(400).json({ error: `Minimum order amount is ৳${Number(promo.minOrderAmount).toLocaleString()}.` });
    }

    let discount = 0;
    if (subtotal) {
      if (promo.discountType === 'PERCENTAGE') {
        discount = subtotal * (Number(promo.discountValue) / 100);
      } else {
        discount = Number(promo.discountValue);
      }
      discount = Math.min(discount, subtotal);
    }

    res.json({
      valid: true,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: Number(promo.discountValue),
      discount,
      message: promo.discountType === 'PERCENTAGE'
        ? `${Number(promo.discountValue)}% off applied!`
        : `৳${Number(promo.discountValue)} off applied!`,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

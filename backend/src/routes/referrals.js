const express = require('express');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ─── Get My Referral Code & Stats ────────────────────
router.get('/my-code', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { referralCode: true },
    });

    const referralCount = await prisma.referral.count({
      where: { referrerId: req.user.id },
    });

    res.json({
      referralCode: user.referralCode,
      referralCount,
      referralLink: `${process.env.FRONTEND_URL}/register?ref=${user.referralCode || ''}`,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

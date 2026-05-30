const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/db');
const { sendOTPEmail } = require('../config/email');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Helper: generate 6-digit OTP
const generateOTP = () => crypto.randomInt(100000, 999999).toString();

// Helper: generate referral code
const generateReferralCode = (name) => {
  const prefix = name.replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase();
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}${suffix}`;
};

// ─── Register ────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, phone, referralCode } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Validate referral code if provided
    let referrer = null;
    if (referralCode) {
      referrer = await prisma.user.findFirst({ where: { referralCode: referralCode.toUpperCase() } });
      // Don't fail registration if referral code is invalid, just ignore it
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const newReferralCode = generateReferralCode(name);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        phone: phone || null,
        role: 'CUSTOMER',
        emailVerified: true,
        referralCode: newReferralCode,
        referredById: referrer?.id || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
      },
    });

    // Create referral record if user was referred
    if (referrer) {
      try {
        await prisma.referral.create({
          data: {
            referrerId: referrer.id,
            referredUserId: user.id,
          },
        });
      } catch (err) {
        console.error('Referral creation failed:', err.message);
      }
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.status(201).json({
      message: 'Account created successfully.',
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
});

// ─── Verify OTP ──────────────────────────────────────
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required.' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email is already verified.' });
    }

    if (!user.otpCode) {
      return res.status(400).json({ error: 'No OTP found. Please request a new one.' });
    }

    // Check attempts
    if (user.otpAttempts >= 5) {
      return res.status(429).json({ error: 'Too many attempts. Please request a new OTP.' });
    }

    // Check expiry
    if (user.otpExpiresAt && new Date() > user.otpExpiresAt) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // Verify OTP
    const isValid = await bcrypt.compare(otp.toString(), user.otpCode);
    if (!isValid) {
      await prisma.user.update({
        where: { id: user.id },
        data: { otpAttempts: { increment: 1 } },
      });
      const remaining = 5 - (user.otpAttempts + 1);
      return res.status(400).json({ error: `Invalid OTP. ${remaining} attempt(s) remaining.` });
    }

    // Generate referral code for the user
    const referralCode = generateReferralCode(user.name);

    // Verify the user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        otpCode: null,
        otpExpiresAt: null,
        otpAttempts: 0,
        verifyToken: null,
        referralCode,
      },
    });

    // Create referral record if user was referred
    if (user.referredById) {
      try {
        await prisma.referral.create({
          data: {
            referrerId: user.referredById,
            referredUserId: user.id,
          },
        });
      } catch (err) {
        console.error('Referral creation failed:', err.message);
      }
    }

    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    next(error);
  }
});

// ─── Resend OTP ──────────────────────────────────────
router.post('/resend-otp', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email is already verified.' });
    }

    // Rate limit: check if last OTP was sent less than 60 seconds ago
    if (user.otpExpiresAt) {
      const otpAge = Date.now() - (user.otpExpiresAt.getTime() - 5 * 60 * 1000);
      if (otpAge < 60 * 1000) {
        const waitSeconds = Math.ceil((60 * 1000 - otpAge) / 1000);
        return res.status(429).json({ error: `Please wait ${waitSeconds} seconds before requesting a new OTP.` });
      }
    }

    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: otpHash,
        otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        otpAttempts: 0,
      },
    });

    await sendOTPEmail(user.email, user.name, otp);

    res.json({ message: 'New verification code sent to your email.' });
  } catch (error) {
    next(error);
  }
});

// ─── Login ───────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── Get Current User ────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;

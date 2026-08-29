/**
 * @module Promo Code Public Routes
 * @description Public API route for validating promo codes without authentication.
 *
 * Guests can check if a promo code is valid and see the discount type/value
 * before logging in. This motivates them to create an account.
 *
 * Routes:
 * - POST /api/public/promo/validate — Validate a promo code (no auth required)
 *
 * Does NOT apply the code to any cart or increment usage count.
 */

import { Router, Request, Response } from 'express';
import { PromoCode } from '@pawtag/db';
import { toAppError } from '../lib/app-errors';
import logger from '../lib/logger';
import { createDbRateLimiter } from '../lib/rate-limiter';

const router = Router();

const validateLimiter = createDbRateLimiter({
  settingKey: 'rateLimit.global.max',
  defaultValue: 100,
  windowMs: 60 * 1000,
  message: 'Too many requests, please try again later',
});

/**
 * POST /api/public/promo/validate
 *
 * Validate a promo code and return its details.
 * No authentication required — guests can check if a code is valid.
 *
 * Body: { code: string }
 *
 * Returns:
 * - valid: boolean
 * - code: string (uppercase)
 * - description: string
 * - discountType: 'percentage' | 'fixed'
 * - discountValue: number
 * - minOrderAmount: number
 */
router.post('/validate', validateLimiter, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ success: false, error: 'Promo code is required' });
      return;
    }

    const promoCode = await PromoCode.findOne({
      code: code.toUpperCase().trim(),
      isActive: true,
    });

    if (!promoCode) {
      res.json({
        success: true,
        data: { valid: false, error: 'Promo code is invalid, either old or expired' },
      });
      return;
    }

    // Check validity using the instance method (date range, usage limits)
    const now = new Date();
    const isValid =
      promoCode.isActive &&
      (!promoCode.startsAt || now >= promoCode.startsAt) &&
      (!promoCode.expiresAt || now <= promoCode.expiresAt) &&
      (!promoCode.usageLimit || promoCode.usageCount < promoCode.usageLimit);

    if (!isValid) {
      res.json({
        success: true,
        data: { valid: false, error: 'Promo code is expired or has reached its usage limit' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        valid: true,
        code: promoCode.code,
        description: promoCode.description,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
        maxDiscountAmount: promoCode.maxDiscountAmount || null,
        minOrderAmount: promoCode.minOrderAmount || 0,
      },
    });
  } catch (err) {
    const error = toAppError(err);
    logger.error({ err }, 'Failed to validate promo code');
    res.status(error.httpStatus).json({ success: false, error: 'Failed to validate promo code' });
  }
});

export default router;

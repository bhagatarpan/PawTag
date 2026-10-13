/**
 * @module Commerce Public Routes
 * @description Public API routes for commerce-related read-only data.
 *
 * Routes:
 * - GET /api/public/commerce/cancellation-reasons — List predefined cancellation reasons
 * - GET /api/public/commerce/free-shipping-threshold — Effective free-shipping threshold for the viewer
 *
 * These endpoints do NOT require authentication. They expose non-sensitive
 * configuration that the customer portal needs (e.g., the dropdown of
 * cancellation reasons shown in the cancel modal).
 */

import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Setting } from '@pawtag/db';
import { config } from '../config';
import { toAppError } from '../lib/app-errors';
import { createDbRateLimiter } from '../lib/rate-limiter';
import { membershipEntitlementService } from '../services/membership-entitlement.service';

const router = Router();

const publicLimiter = createDbRateLimiter({
  settingKey: 'rateLimit.global.max',
  defaultValue: 100,
  windowMs: 60 * 1000,
  message: 'Too many requests, please try again later',
});

const DEFAULT_REASONS = [
  'Ordered by mistake',
  'Found a better price',
  'Shipping takes too long',
  'Need to change address or payment',
  'Item not as described',
  'Duplicate order',
  'Financial reasons',
  'Other',
];

/**
 * GET /api/public/commerce/cancellation-reasons
 * Returns the list of predefined cancellation reasons.
 * No auth required — used by the customer cancel modal.
 */
router.get('/cancellation-reasons', publicLimiter, async (_req, res: Response) => {
  try {
    const setting = await Setting.findOne({ key: 'commerce.orders.cancellationReasons' }).lean();
    let reasons: string[] = DEFAULT_REASONS;
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (Array.isArray(parsed) && parsed.every((r) => typeof r === 'string') && parsed.length > 0) {
          reasons = parsed;
        }
      } catch {
        // Fall back to defaults if stored value is not valid JSON
      }
    }
    res.json({ success: true, data: reasons });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * GET /api/public/commerce/free-shipping-threshold
 *
 * Effective free-shipping threshold for the current viewer:
 * - Signed-in member → their tier's `free_shipping_threshold` entitlement;
 * - Guest / non-member → null (free shipping is a membership benefit; the
 *   server never applies an automatic threshold to non-members, so the UI
 *   must not advertise one).
 *
 * Display-only ("$X away from free shipping" progress) — the authoritative
 * free-shipping application stays in cart/checkout totals.
 */
router.get('/free-shipping-threshold', publicLimiter, async (req, res: Response) => {
  try {
    let userId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.split(' ')[1], config.jwtSecret) as { id?: string };
        userId = decoded.id || null;
      } catch {
        // Invalid/expired token → treat as guest; a display endpoint must not 401.
      }
    }

    const threshold = userId
      ? await membershipEntitlementService.getValue<number>(userId, 'free_shipping_threshold')
      : null;

    res.json({
      success: true,
      data: { threshold: typeof threshold === 'number' && threshold > 0 ? threshold : null },
    });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

export default router;

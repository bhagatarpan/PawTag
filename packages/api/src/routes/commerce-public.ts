/**
 * @module Commerce Public Routes
 * @description Public API routes for commerce-related read-only data.
 *
 * Routes:
 * - GET /api/public/commerce/cancellation-reasons — List predefined cancellation reasons
 *
 * These endpoints do NOT require authentication. They expose non-sensitive
 * configuration that the customer portal needs (e.g., the dropdown of
 * cancellation reasons shown in the cancel modal).
 */

import { Router, Response } from 'express';
import { Setting } from '@pawtag/db';
import { toAppError } from '../lib/app-errors';
import { createDbRateLimiter } from '../lib/rate-limiter';

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

export default router;

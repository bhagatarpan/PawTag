/**
 * @module Points Estimate Public Routes
 * @description Public API endpoints for estimating Guardian Points.
 *
 * Routes:
 * - GET /api/public/points/estimate?total=9.99&isGoldMember=false
 * - GET /api/public/points/rates — returns rate and spentAmount for Guardian and Gold
 */

import { Router, Request, Response } from 'express';
import { getGuardianNumber } from '../services/loyalty/guardian-config';
import logger from '../lib/logger';

const router = Router();

/**
 * GET /api/public/points/estimate
 *
 * Calculate estimated Guardian Points for a given order total.
 * Formula: Math.floor((orderTotal / purchaseSpentAmount) * purchaseRate)
 *
 * Query params:
 * - total (number, required) — order total in NZD
 * - isGoldMember (boolean, optional) — whether user has Gold membership
 */
router.get('/estimate', async (req: Request, res: Response) => {
  try {
    const total = parseFloat(req.query.total as string);
    const isGoldMember = req.query.isGoldMember === 'true';

    if (isNaN(total) || total < 0) {
      res.status(400).json({ success: false, error: 'Valid total is required' });
      return;
    }

    const rate = isGoldMember
      ? await getGuardianNumber('purchaseRateGold')
      : await getGuardianNumber('purchaseRateGuardian');
    const spentAmount = isGoldMember
      ? await getGuardianNumber('purchaseSpentAmountGold')
      : await getGuardianNumber('purchaseSpentAmount');

    const points = Math.floor((total / spentAmount) * rate);

    res.json({
      success: true,
      data: { points, isGoldMember },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to estimate points');
    res.status(500).json({ success: false, error: 'Failed to estimate points' });
  }
});

/**
 * GET /api/public/points/rates
 *
 * Return the current points earning rates from CMS settings.
 * Used by Shop and ProductDetail pages to calculate points per product
 * without making an API call for each product.
 */
router.get('/rates', async (_req: Request, res: Response) => {
  try {
    const [guardianRate, guardianSpentAmount, goldRate, goldSpentAmount] = await Promise.all([
      getGuardianNumber('purchaseRateGuardian'),
      getGuardianNumber('purchaseSpentAmount'),
      getGuardianNumber('purchaseRateGold'),
      getGuardianNumber('purchaseSpentAmountGold'),
    ]);

    res.json({
      success: true,
      data: { guardianRate, guardianSpentAmount, goldRate, goldSpentAmount },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch points rates');
    res.status(500).json({ success: false, error: 'Failed to fetch points rates' });
  }
});

export default router;

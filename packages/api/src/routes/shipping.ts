/**
 * @module Shipping Routes
 * @description API routes for shipping operations.
 *
 * Routes:
 * - GET  /api/shipping/rates  — Get available shipping rates
 * - POST /api/shipping/select — Select shipping method
 *
 * All routes require authentication.
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { checkGoldBenefits, getsFreeShipping } from '../middleware/gold-benefits';
import { shippingService } from '../commerce/services/shipping.service';
import { toAppError } from '../lib/app-errors';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);
router.use(checkGoldBenefits);

/**
 * GET /api/shipping/rates
 *
 * Get available shipping rates for the current cart.
 * Requires shipping address in query params.
 */
router.get('/rates', async (req: AuthRequest, res: Response) => {
  try {
    const { line1, city, state, zip, country } = req.query;

    if (!line1 || !city) {
      res.status(400).json({ success: false, error: 'line1 and city are required' });
      return;
    }

    const rates = await shippingService.getRates(req.user!.id, {
      line1: line1 as string,
      city: city as string,
      state: (state as string) || '',
      zip: (zip as string) || '',
      country: (country as string) || 'NZ',
    });

    // Apply Gold member free shipping benefit
    const isGoldMember = (req as any).isGoldMember === true;
    if (isGoldMember) {
      // Gold members get free shipping on orders over $50
      const cartTotal = parseFloat((req.query.cartTotal as string) || '0');
      if (getsFreeShipping(true, cartTotal)) {
        // Override all shipping costs to $0 for Gold members
        const freeRates = rates.map((rate) => ({
          ...rate,
          cost: 0,
          description: rate.description ? `${rate.description} (Gold Free Shipping)` : 'Free (Gold Member)',
        }));
        res.json({ success: true, data: freeRates });
        return;
      }
    }

    res.json({ success: true, data: rates });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * POST /api/shipping/select
 *
 * Select a shipping method for the cart.
 * Body: { methodId, methodName, cost }
 */
router.post('/select', async (req: AuthRequest, res: Response) => {
  try {
    const { methodId, methodName, cost } = req.body;

    if (!methodId || !methodName) {
      res.status(400).json({ success: false, error: 'methodId and methodName are required' });
      return;
    }

    await shippingService.selectMethod(req.user!.id, methodId, methodName, cost ?? 0);

    res.json({ success: true, data: { methodId, methodName, cost } });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

export default router;

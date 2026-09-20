/**
 * @module Shipping Routes
 * @description API routes for shipping operations.
 *
 * Server-authoritative: the client sends only methodId + address.
 * The server looks up the rate, applies free-shipping rules, and
 * stores the authoritative cost on the cart.
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { checkGoldBenefits, getsFreeShipping } from '../middleware/gold-benefits';
import { shippingService } from '../commerce/services/shipping.service';
import { Cart } from '@pawtag/db';
import { toAppError } from '../lib/app-errors';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);
router.use(checkGoldBenefits);

/**
 * GET /api/shipping/rates
 *
 * Server-authoritative: derives cart total from the authenticated cart,
 * never from query parameters.
 */
router.get('/rates', async (req: AuthRequest, res: Response) => {
  try {
    const { line1, city, state, zip, country } = req.query;

    if (!line1 || !city) {
      res.status(400).json({ success: false, error: 'line1 and city are required' });
      return;
    }

    // Server-authoritative: derive cart total from the authenticated cart
    const cart = await Cart.findOne({ userId: req.user!.id, status: 'active' });
    const cartSubtotal = cart?.items?.reduce((sum: number, item: any) => {
      return sum + (item.unitPrice || 0) * (item.quantity || 0);
    }, 0) ?? 0;

    const rates = await shippingService.getRates(req.user!.id, {
      line1: line1 as string,
      city: city as string,
      state: (state as string) || '',
      zip: (zip as string) || '',
      country: (country as string) || 'NZ',
    });

    // Apply Gold member free shipping benefit using server-derived cart total
    const isGoldMember = (req as any).isGoldMember === true;
    if (isGoldMember && await getsFreeShipping(true, cartSubtotal)) {
      const freeRates = rates.map((rate) => ({
        ...rate,
        cost: 0,
        description: rate.description ? `${rate.description} (Gold Free Shipping)` : 'Free (Gold Member)',
      }));
      res.json({ success: true, data: freeRates });
      return;
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
 * Server-authoritative: client sends only methodId.
 * Server looks up the rate from ShippingMethod and stores authoritative cost.
 */
router.post('/select', async (req: AuthRequest, res: Response) => {
  try {
    const { methodId, methodName } = req.body;

    if (!methodId || !methodName) {
      res.status(400).json({ success: false, error: 'methodId and methodName are required' });
      return;
    }

    // Server-authoritative: look up the cost from the ShippingMethod collection
    await shippingService.selectMethod(req.user!.id, methodId, methodName);

    res.json({ success: true, data: { methodId, methodName } });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

export default router;

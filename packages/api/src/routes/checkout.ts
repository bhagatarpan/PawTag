/**
 * @module Checkout Routes
 * @description API routes for the checkout flow.
 *
 * These routes handle the complete checkout process:
 * - Create payment intent (initiates checkout)
 * - Confirm checkout (after payment succeeds)
 * - Handle orphan payments (recovery)
 *
 * All routes require authentication (JWT).
 *
 * Routes:
 * - POST /api/checkout/payment-intent — Create Stripe PaymentIntent
 * - POST /api/checkout/confirm        — Confirm checkout after payment
 * - GET  /api/checkout/pending        — Get current pending order
 *
 * Security:
 * - All amounts validated server-side (never trust frontend prices)
 * - Payment status verified via Stripe API before order creation
 * - Idempotent: same PaymentIntent = same Order
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { checkoutService } from '../commerce/services/checkout.service';
import { PendingOrder } from '@pawtag/db';
import { toAppError } from '../lib/app-errors';
import logger from '../lib/logger';

const router = Router();

// All checkout routes require authentication
router.use(authenticate);

/**
 * POST /api/checkout/payment-intent
 *
 * Create a Stripe PaymentIntent and PendingOrder.
 * Called when customer proceeds to payment step.
 *
 * Returns: { pendingOrderId, paymentIntentId, clientSecret, amount, currency }
 */
router.post('/payment-intent', async (req: AuthRequest, res: Response) => {
  try {
    const { shippingAddress } = req.body || {};
    const result = await checkoutService.createPaymentIntent(req.user!.id, shippingAddress);

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    const error = toAppError(err);
    logger.error({ err, userId: req.user?.id }, 'Failed to create payment intent');
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * POST /api/checkout/confirm
 *
 * Confirm checkout after payment succeeds.
 * Validates payment, creates Order + Invoice, sends notifications.
 *
 * Body: { paymentIntentId }
 *
 * Returns: { order, invoice, invoiceUrl, isNew }
 */
router.post('/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const { paymentIntentId, portal } = req.body;

    if (!paymentIntentId) {
      res.status(400).json({ success: false, error: 'paymentIntentId is required' });
      return;
    }

    const result = await checkoutService.confirmCheckout(req.user!.id, paymentIntentId, portal);

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    const error = toAppError(err);
    logger.error({ err, userId: req.user?.id }, 'Failed to confirm checkout');
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * GET /api/checkout/pending
 *
 * Get the current pending order for the user (if any).
 * Used by frontend to recover after browser refresh.
 *
 * Returns: PendingOrder or null
 */
router.get('/pending', async (req: AuthRequest, res: Response) => {
  try {
    const pending = await PendingOrder.findOne({
      userId: req.user!.id,
      status: { $in: ['pending', 'paid'] },
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: pending || null,
    });
  } catch (err) {
    const error = toAppError(err);
    logger.error({ err, userId: req.user?.id }, 'Failed to get pending order');
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

export default router;

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
    const { shippingAddress, autoRenew, pawRewardsRedemption } = req.body || {};
    const result = await checkoutService.createPaymentIntent(req.user!.id, shippingAddress, autoRenew, pawRewardsRedemption);

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

/**
 * GET /api/checkout/status/:paymentIntentId
 *
 * Get checkout status for a specific PaymentIntent.
 * Provides a clean recovery contract for the frontend.
 *
 * Returns: { status, orderId?, orderNumber?, recoverable, customerMessage }
 */
router.get('/status/:paymentIntentId', async (req: AuthRequest, res: Response) => {
  try {
    const { paymentIntentId } = req.params;

    if (!paymentIntentId) {
      res.status(400).json({ success: false, error: 'paymentIntentId is required' });
      return;
    }

    // Find the PendingOrder (must belong to this user)
    const pending = await PendingOrder.findOne({
      stripePaymentIntentId: paymentIntentId,
      userId: req.user!.id,
    });

    if (!pending) {
      res.json({
        success: true,
        data: {
          status: 'not_found',
          recoverable: false,
          customerMessage: 'No checkout found for this payment.',
        },
      });
      return;
    }

    // If converted, fetch order details
    if (pending.status === 'converted' && pending.convertedOrderId) {
      const { Order } = await import('@pawtag/db');
      const order = await Order.findById(pending.convertedOrderId).select('orderNumber status');
      res.json({
        success: true,
        data: {
          status: 'completed',
          orderId: pending.convertedOrderId,
          orderNumber: order?.orderNumber || null,
          recoverable: false,
          customerMessage: 'Your order has been placed successfully.',
        },
      });
      return;
    }

    // Pending or expired
    const statusMap: Record<string, { recoverable: boolean; customerMessage: string }> = {
      pending: { recoverable: true, customerMessage: 'Payment is being processed. Please wait or try again.' },
      paid: { recoverable: true, customerMessage: 'Payment received. Finalizing your order...' },
      expired: { recoverable: false, customerMessage: 'This checkout has expired. Please start a new order.' },
      failed: { recoverable: false, customerMessage: 'Payment failed. Please try again.' },
    };

    const info = statusMap[pending.status] || { recoverable: false, customerMessage: 'Unknown status.' };

    res.json({
      success: true,
      data: {
        status: pending.status,
        recoverable: info.recoverable,
        customerMessage: info.customerMessage,
      },
    });
  } catch (err) {
    const error = toAppError(err);
    logger.error({ err, userId: req.user?.id }, 'Failed to get checkout status');
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

export default router;

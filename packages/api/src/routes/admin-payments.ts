/**
 * @module Admin Payment Routes
 * @description Admin API routes for payment management and reconciliation.
 *
 * Provides endpoints for:
 * - Listing payment transactions with filters
 * - Viewing transaction details
 * - Reconciliation: comparing PawTag orders vs Stripe payments
 * - Recording manual payment adjustments
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { Order, PaymentTransaction } from '@pawtag/db';
import { stripePaymentProvider } from '../commerce/providers/stripe';
import { toAppError } from '../lib/app-errors';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

/**
 * GET /api/admin/commerce/payments
 * List payment transactions with pagination and filters.
 */
router.get('/', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, status, type, provider, search } = req.query;

    const query: Record<string, any> = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (provider) query.provider = provider;
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { providerTransactionId: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await PaymentTransaction.countDocuments(query);
    const items = await PaymentTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: {
        items,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

/**
 * GET /api/admin/commerce/payments/:id
 * Get transaction details.
 */
router.get('/:id', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const txn = await PaymentTransaction.findById(req.params.id);
    if (!txn) {
      res.status(404).json({ success: false, error: 'Transaction not found' });
      return;
    }
    res.json({ success: true, data: txn });
  } catch (err) {
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

/**
 * GET /api/admin/commerce/payments/reconciliation
 * Compare PawTag order payment state vs Stripe payment state.
 * Returns orders with potential discrepancies.
 */
router.get('/reconciliation', requirePermission('order.read'), async (_req: AuthRequest, res: Response) => {
  try {
    // Get all orders with payment intent IDs
    const orders = await Order.find({
      'payment.stripePaymentIntentId': { $exists: true, $ne: null },
      'payment.status': { $in: ['completed', 'failed', 'refunded'] },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const discrepancies: Array<{
      orderNumber: string;
      orderPaymentStatus: string;
      stripeStatus: string | null;
      amount: number;
      stripeAmount: number | null;
      stripePaymentIntentId: string;
      issue: string;
    }> = [];

    // Check each order against Stripe (only in non-demo mode)
    const isConfigured = stripePaymentProvider.isConfigured();
    if (!isConfigured) {
      res.json({
        success: true,
        data: {
          mode: 'demo',
          message: 'Stripe is not configured — reconciliation requires live Stripe API',
          orders: [],
          discrepancyCount: 0,
        },
      });
      return;
    }

    for (const order of orders) {
      const piId = order.payment?.stripePaymentIntentId;
      if (!piId || piId.startsWith('pi_demo_')) continue;

      try {
        const stripeIntent = await stripePaymentProvider.retrievePaymentIntent(piId);

        // Compare statuses
        const statusMap: Record<string, string> = {
          succeeded: 'completed',
          requires_capture: 'completed',
          failed: 'failed',
          canceled: 'cancelled',
          processing: 'pending',
        };
        const expectedStatus = statusMap[stripeIntent.status] || stripeIntent.status;

        const amountMatch = Math.abs((order.payment?.amount || 0) - stripeIntent.amount) < 0.01;

        if (expectedStatus !== order.payment?.status || !amountMatch) {
          discrepancies.push({
            orderNumber: order.orderNumber,
            orderPaymentStatus: order.payment?.status || 'unknown',
            stripeStatus: stripeIntent.status,
            amount: order.payment?.amount || 0,
            stripeAmount: stripeIntent.amount,
            stripePaymentIntentId: piId,
            issue: expectedStatus !== order.payment?.status
              ? `Status mismatch: PawTag="${order.payment?.status}" vs Stripe="${stripeIntent.status}"`
              : `Amount mismatch: PawTag=$${order.payment?.amount} vs Stripe=$${stripeIntent.amount}`,
          });
        }
      } catch {
        // Can't reach Stripe for this PI — skip
      }
    }

    res.json({
      success: true,
      data: {
        mode: 'live',
        checkedOrders: orders.length,
        discrepancyCount: discrepancies.length,
        discrepancies,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

/**
 * POST /api/admin/commerce/payments/record
 * Record a manual payment transaction (for reconciliation or admin adjustments).
 */
router.post('/record', requirePermission('order.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, type, amount, status, providerTransactionId, notes } = req.body;

    if (!orderId || !type || amount === undefined) {
      res.status(400).json({ success: false, error: 'orderId, type, and amount are required' });
      return;
    }

    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    const txn = await PaymentTransaction.create({
      orderId: order._id,
      orderNumber: order.orderNumber,
      type,
      status: status || 'succeeded',
      amount,
      currency: order.payment?.currency || 'NZD',
      provider: 'admin',
      providerTransactionId,
      initiatedBy: 'admin',
      notes,
    });

    logger.info({
      orderId,
      orderNumber: order.orderNumber,
      type,
      amount,
      actor: req.user?.email,
    }, 'Manual payment transaction recorded');

    res.status(201).json({ success: true, data: txn });
  } catch (err) {
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

export default router;

/**
 * @module Admin Refund Routes
 * @description Admin API for managing refunds.
 *
 * Provides endpoints for:
 * - Listing refunds with filters
 * - Getting refund details
 * - Manual sync with Stripe
 * - Manual retry of failed refunds
 * - Exporting refunds for accounting (CSV, GL, Xero)
 * - Xero OAuth flow (connect, callback, disconnect, status)
 *
 * All endpoints require admin role.
 */

import { Router, Request, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { Order, PaymentTransaction, User } from '@pawtag/db';
import { stripePaymentProvider } from '../commerce/providers/stripe';
import { manualRefundRetry, getPendingRetries } from '../commerce/services/refund-retry.service';
import { exportRefundsToCsv, type RefundExportRow, type CsvColumnMode } from '../integrations/accounting/csvExporter';
import { exportRefundsToGL } from '../integrations/accounting/glExporter';
import {
  buildXeroAuthUrl,
  exchangeXeroCode,
  isXeroConnected,
  disconnectXero,
  exportRefundsToXero,
} from '../integrations/accounting/xeroExporter';
import { isMyobConnected } from '../integrations/accounting/myobExporter';
import { runRefundReconciliation } from '../jobs/refundReconciliation';
import { toAppError } from '../lib/app-errors';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

interface RefundListItem {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  currency: string;
  status: string;
  refundId: string;
  arn?: string;
  initiatedBy: string;
  cancelledBy: string;
  cancellationReason: string;
  refundSettledAt?: string;
  refundCreatedAt: string;
  paymentIntentId: string;
  attemptCount: number;
}

/**
 * Map an order with refund data to a list item.
 */
function mapOrderToRefundListItem(order: any): RefundListItem {
  return {
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    customerName: order.userId?.fullName || 'N/A',
    customerEmail: order.userId?.email || '',
    amount: order.payment?.amount || 0,
    currency: order.payment?.currency || 'NZD',
    status: order.refundStatus || 'pending',
    refundId: order.refundId || '',
    arn: order.refundArn,
    initiatedBy: order.cancelledByType || 'unknown',
    cancelledBy: order.cancelledBy || '',
    cancellationReason: order.cancellationReason || '',
    refundSettledAt: order.refundSettledAt?.toISOString(),
    refundCreatedAt: order.cancelledAt?.toISOString() || order.updatedAt?.toISOString(),
    paymentIntentId: order.payment?.stripePaymentIntentId || order.payment?.transactionId || '',
    attemptCount: order.refundAttemptCount || 0,
  };
}

/**
 * GET /api/admin/commerce/refunds
 *
 * List refunds with filters and pagination.
 * Sort: failed first, then processing, then succeeded (newest first within each group).
 */
router.get('/refunds', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 25, status, dateFrom, dateTo, initiatedBy, search } = req.query;
    const pageNum = Number(page);
    const limitNum = Math.min(Number(limit) || 25, 100);

    const query: any = {
      refundId: { $exists: true, $ne: null },
    };

    if (status) {
      query.refundStatus = status;
    } else {
      // Default: show all refunded orders (cancelled, refunded)
      query.status = { $in: ['cancelled', 'refunded'] };
    }

    if (dateFrom || dateTo) {
      query.cancelledAt = {};
      if (dateFrom) query.cancelledAt.$gte = new Date(dateFrom as string);
      if (dateTo) query.cancelledAt.$lte = new Date(dateTo as string);
    }

    if (initiatedBy) {
      query.cancelledByType = initiatedBy;
    }

    if (search) {
      const searchRegex = new RegExp(search as string, 'i');
      query.$or = [
        { orderNumber: searchRegex },
        { refundId: searchRegex },
        { cancellationReason: searchRegex },
      ];
    }

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('userId', 'fullName email')
      .sort({
        // Sort: failed first, then processing, then succeeded
        refundStatus: 1,
        cancelledAt: -1,
      })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const items = orders.map(mapOrderToRefundListItem);

    res.json({
      success: true,
      data: {
        items,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * GET /api/admin/commerce/refunds/:orderId
 *
 * Get full refund details for a specific order.
 */
router.get('/refunds/:orderId', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('userId', 'fullName email phone')
      .lean();
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    const transactions = await PaymentTransaction.find({
      orderId: order._id,
      type: 'refund',
    }).sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      data: {
        order: mapOrderToRefundListItem(order),
        customer: order.userId,
        transactions,
        pendingRetries: getPendingRetries().filter((r) => r.orderId === req.params.orderId),
      },
    });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * POST /api/admin/commerce/refunds/:orderId/sync
 *
 * Manually trigger a sync of a refund with Stripe.
 * Fetches the latest refund status from Stripe and updates PawTag records.
 */
router.post('/refunds/:orderId/sync', requirePermission('order.update'), async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    if (!order.refundId) {
      res.status(400).json({ success: false, error: 'No refund ID on order' });
      return;
    }

    const refundResult = await stripePaymentProvider.retrieveRefund(order.refundId);
    if (!refundResult.success) {
      res.status(502).json({ success: false, error: refundResult.error || 'Failed to fetch refund from Stripe' });
      return;
    }

    order.refundStatus = (refundResult.status as any) || order.refundStatus;
    order.refundLastSyncedAt = new Date();
    if (refundResult.arn) order.refundArn = refundResult.arn;
    if (refundResult.expectedArrival) order.refundExpectedArrival = refundResult.expectedArrival;
    if (order.refundStatus === 'succeeded' && !order.refundSettledAt) {
      order.refundSettledAt = new Date();
    }
    await order.save();

    await PaymentTransaction.findOneAndUpdate(
      { providerTransactionId: order.refundId, type: 'refund' },
      {
        providerStatus: refundResult.status,
        arn: refundResult.arn,
        expectedArrival: refundResult.expectedArrival,
        lastSyncedAt: new Date(),
      },
    );

    res.json({
      success: true,
      data: mapOrderToRefundListItem(order),
    });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * POST /api/admin/commerce/refunds/:orderId/retry
 *
 * Manually retry a failed refund.
 */
router.post('/refunds/:orderId/retry', requirePermission('order.update'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await manualRefundRetry(req.params.orderId);
    if (result.success) {
      res.json({ success: true, data: { refundId: result.newRefundId } });
    } else {
      res.status(400).json({ success: false, error: result.error || 'Retry failed' });
    }
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * POST /api/admin/commerce/refunds/reconcile
 *
 * Manually trigger the daily reconciliation job.
 */
router.post('/refunds/reconcile', requirePermission('order.update'), async (_req: AuthRequest, res: Response) => {
  try {
    const result = await runRefundReconciliation();
    res.json({ success: true, data: result });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * GET /api/admin/commerce/refunds/export
 *
 * Export refunds for accounting.
 * Query params:
 *   - format: 'csv' | 'gl' | 'xero' (default from CMS)
 *   - mode: 'full' | 'xero' | 'configurable' (CSV only)
 *   - columns: comma-separated list (CSV configurable mode)
 *   - dateFrom, dateTo: date range
 */
router.get('/refunds/export', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { format = 'csv', mode, columns, dateFrom, dateTo } = req.query;

    const query: any = {
      refundStatus: 'succeeded',
      refundSettledAt: { $exists: true },
    };
    if (dateFrom) query.refundSettledAt.$gte = new Date(dateFrom as string);
    if (dateTo) query.refundSettledAt.$lte = new Date(dateTo as string);

    const orders = await Order.find(query).populate('userId', 'fullName email').lean();
    const rows: RefundExportRow[] = orders.map((o) => ({
      refundId: o.refundId || '',
      orderId: String(o._id),
      orderNumber: o.orderNumber,
      customerName: (o.userId as any)?.fullName || '',
      customerEmail: (o.userId as any)?.email || '',
      amount: o.payment?.amount || 0,
      currency: o.payment?.currency || 'NZD',
      status: o.refundStatus || '',
      arn: o.refundArn,
      initiatedBy: o.cancelledByType || '',
      cancelledBy: o.cancelledBy || '',
      cancellationReason: o.cancellationReason || '',
      refundSettledAt: o.refundSettledAt,
      refundCreatedAt: (o as any).cancelledAt || (o as any).updatedAt || new Date(),
      paymentIntentId: o.payment?.stripePaymentIntentId || o.payment?.transactionId || '',
    }));

    if (format === 'xero') {
      const xeroResult = await exportRefundsToXero(
        rows.map((r) => ({
          refundId: r.refundId,
          orderNumber: r.orderNumber,
          amount: r.amount,
          description: `Refund for order ${r.orderNumber}`,
          date: r.refundSettledAt || r.refundCreatedAt,
        })),
      );
      if (!xeroResult.success && xeroResult.errors[0] === 'Xero not connected') {
        res.status(400).json({ success: false, error: 'Xero is not connected. Please connect first via /admin/commerce/accounting.' });
        return;
      }
      res.json({ success: true, data: xeroResult });
      return;
    }

    if (format === 'gl') {
      const csv = await exportRefundsToGL(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="refunds-gl-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
      return;
    }

    // Default: CSV
    const customColumns = typeof columns === 'string' ? columns.split(',').map((c) => c.trim()) : undefined;
    const csvMode: CsvColumnMode = (mode as CsvColumnMode) || (customColumns ? 'configurable' : 'full');
    const csv = await exportRefundsToCsv(rows, { mode: csvMode, customColumns });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="refunds-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

// ─── Xero OAuth flow ────────────────────────────────────────

/**
 * GET /api/admin/commerce/accounting/status
 *
 * Check status of all accounting integrations.
 */
router.get('/accounting/status', requirePermission('order.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const xeroConnected = await isXeroConnected();
    const myobConnected = await isMyobConnected();
    res.json({
      success: true,
      data: {
        xero: { connected: xeroConnected },
        myob: { connected: myobConnected },
      },
    });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * GET /api/admin/commerce/accounting/connect/xero
 *
 * Redirect to Xero OAuth authorisation page.
 */
router.get('/accounting/connect/xero', requirePermission('order.update'), async (req: AuthRequest, res: Response) => {
  try {
    const state = `${req.user!.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const authUrl = buildXeroAuthUrl(state);
    res.json({ success: true, data: { authUrl, state } });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * GET /api/admin/commerce/accounting/callback/xero
 *
 * OAuth callback. Exchanges code for tokens and stores them.
 */
router.get('/accounting/callback/xero', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      res.status(400).send('Missing code parameter');
      return;
    }

    // Extract userId from state (format: "userId:timestamp:random")
    const stateStr = (state as string) || '';
    const userId = stateStr.split(':')[0];

    await exchangeXeroCode(code as string, userId);

    // Redirect to admin page
    const adminUrl = process.env.PUBLIC_ADMIN_URL || 'http://localhost:3001';
    res.redirect(`${adminUrl}/commerce-settings?xero=connected`);
  } catch (err) {
    logger.error({ err }, 'Xero callback failed');
    const adminUrl = process.env.PUBLIC_ADMIN_URL || 'http://localhost:3001';
    res.redirect(`${adminUrl}/commerce-settings?xero=error&message=${encodeURIComponent((err as Error).message)}`);
  }
});

/**
 * DELETE /api/admin/commerce/accounting/disconnect/xero
 *
 * Disconnect Xero integration.
 */
router.delete('/accounting/disconnect/xero', requirePermission('order.update'), async (_req: AuthRequest, res: Response) => {
  try {
    await disconnectXero();
    res.json({ success: true });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

export default router;

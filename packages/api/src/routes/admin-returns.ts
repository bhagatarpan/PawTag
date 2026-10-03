/**
 * @module Admin Returns Routes
 * @description Admin API for return requests and return-driven Stripe refunds.
 *
 * Status updates are logistics only. Money movement uses dedicated
 * refund endpoints that call return-refund.service (Stripe-first).
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validation';
import { Order, Return, User } from '@pawtag/db';
import { toAppError } from '../lib/app-errors';
import { logCommerceEvent } from '../commerce/audit';
import { returnRefundService } from '../commerce/services/return-refund.service';
import { getSetting } from '../commerce/config';
import logger from '../lib/logger';

// Valid return status transitions (logistics only — not money)
const RETURN_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['approved', 'rejected'],
  approved: ['received', 'rejected'],
  rejected: [],
  received: ['refunded'],
  refunded: [],
  refund_failed: ['received'],
};

const updateReturnStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'received', 'refunded']),
  refundAmount: z.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
});

const processRefundSchema = z.object({
  reason: z.string().min(1, 'reason is required').max(1000),
  amount: z.number().positive().optional(),
});

const refundWithoutReturnSchema = z.object({
  reason: z.string().min(1, 'reason is required').max(1000),
  exceptionReason: z.string().min(1, 'exceptionReason is required').max(1000),
  amount: z.number().positive().optional(),
});

const router = Router();
router.use(authenticate);

/**
 * GET /api/admin/commerce/returns/summary
 * Lightweight counts for sidebar badges and dashboard tiles.
 */
router.get('/summary', requirePermission('order.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const [pending, approved, received, refundFailed] = await Promise.all([
      Return.countDocuments({ status: 'pending' }),
      Return.countDocuments({ status: 'approved' }),
      Return.countDocuments({ status: 'received' }),
      Return.countDocuments({ status: 'refund_failed' }),
    ]);
    res.json({
      success: true,
      data: {
        pending,
        approved,
        received,
        refundFailed,
        needsAttention: pending + refundFailed,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

router.get('/', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query: Record<string, any> = {};
    if (status) query.status = status;
    const total = await Return.countDocuments(query);
    const items = await Return.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .populate('userId', 'fullName email phoneNumber')
      .populate('orderId', 'orderNumber status payment.amount payment.cardBrand payment.cardLast4 payment.currency');
    res.json({ success: true, data: { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.get('/:id', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await Return.findById(req.params.id)
      .populate('userId', 'fullName email phoneNumber')
      .populate('orderId', 'orderNumber status payment shippingAddress createdAt');
    if (!item) { res.status(404).json({ success: false, error: 'Return not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

/**
 * PUT /:id/status — logistics transitions only.
 * Must NOT be used as a money operation. Use POST /:id/refund instead.
 */
router.put('/:id/status', requirePermission('order.update'), validate(updateReturnStatusSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { status, refundAmount, notes } = req.body;

    const existingReturn = await Return.findById(req.params.id);
    if (!existingReturn) {
      res.status(404).json({ success: false, error: 'Return not found' });
      return;
    }

    // Block status-only path to refunded — money must go through refund endpoint
    if (status === 'refunded') {
      res.status(400).json({
        success: false,
        error: 'Use Process Refund (POST refund endpoint) to move money. Status-only refunded is not allowed.',
      });
      return;
    }

    const allowedTransitions = RETURN_STATUS_TRANSITIONS[existingReturn.status] || [];
    if (!allowedTransitions.includes(status)) {
      res.status(400).json({
        success: false,
        error: `Cannot transition from '${existingReturn.status}' to '${status}'. Allowed: ${allowedTransitions.join(', ') || 'none'}`,
      });
      return;
    }

    if (refundAmount !== undefined) {
      const order = await Order.findById(existingReturn.orderId);
      if (order && refundAmount > (order.payment?.amount || 0)) {
        res.status(400).json({
          success: false,
          error: `Refund amount $${refundAmount} exceeds order payment amount $${order.payment?.amount || 0}`,
        });
        return;
      }
    }

    const update: Record<string, any> = {
      status,
      reviewedBy: req.user!.id,
      reviewedAt: new Date(),
    };
    if (refundAmount !== undefined) update.refundAmount = refundAmount;
    if (notes) update.notes = notes;
    if (status === 'received') update.receivedAt = new Date();

    const item = await Return.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!item) {
      res.status(404).json({ success: false, error: 'Return not found' });
      return;
    }
    if (!item.activity) item.activity = [];
    item.activity.push({
      type: `status_${status}`,
      message: `Return marked ${status}`,
      timestamp: new Date(),
      actor: req.user?.email || req.user?.id,
      actorType: 'admin',
    });
    await item.save();

    await logCommerceEvent({
      action: `return_${status}`,
      eventType: `admin.return.${status}`,
      resourceType: 'Return',
      resourceId: req.params.id,
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: {
        returnId: req.params.id,
        orderNumber: item.orderNumber,
        status,
        refundAmount,
      },
    }, req as any);

    // Customer emails for approved / rejected (fire-and-forget)
    if (status === 'approved' || status === 'rejected') {
      try {
        const customer = await User.findById(item.userId).select('fullName email').lean();
        if (customer?.email) {
          const { sendCmsEmailOrFallback } = await import('../services/email.service');
          const warehouseAddress = (await getSetting('commerce.returns.warehouseAddress')) || '';
          const returnContact = (await getSetting('commerce.returns.warehouseContact')) || 'support@pawtag.co.nz';
          const items = (item.items || [])
            .map((i: { productName: string; quantity: number }) => `${i.productName} × ${i.quantity}`)
            .join(', ');
          const viewOrderUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/orders/${item.orderId}`;

          if (status === 'approved') {
            await sendCmsEmailOrFallback({
              slug: 'return-approved',
              to: customer.email,
              vars: {
                customerName: customer.fullName || 'there',
                orderNumber: item.orderNumber,
                items,
                refundAmount: Number(item.refundAmount || 0).toFixed(2),
                warehouseAddress,
                returnContact,
                viewOrderUrl,
              },
              fallbackSubject: `Return approved — ${item.orderNumber}`,
              fallbackHtml: `
                <p>Hi ${customer.fullName || 'there'},</p>
                <p>Your return request for order <strong>${item.orderNumber}</strong> has been <strong>approved</strong>.</p>
                <p>Items: ${items}</p>
                <p>Estimated refund: $${Number(item.refundAmount || 0).toFixed(2)}</p>
                <p>PawTag does not provide return shipping. Please ship the product with a printed invoice. Add tracking on your order after you ship.</p>
                ${warehouseAddress.trim() ? `<p>Return address:<br>${warehouseAddress.replace(/\n/g, '<br>')}</p>` : `<p>Please email ${returnContact} for the warehouse return address.</p>`}
              `,
              businessFlow: 'orders_commerce',
              relatedEntityType: 'return',
              relatedEntityId: String(item._id),
              relatedEntityDisplay: item.orderNumber,
            }).catch((err) =>
              logger.error({ err, returnId: item._id }, 'Failed to send return approved email'),
            );
          } else {
            await sendCmsEmailOrFallback({
              slug: 'return-rejected',
              to: customer.email,
              vars: {
                customerName: customer.fullName || 'there',
                orderNumber: item.orderNumber,
                returnReason: item.reason || 'Return request',
                csrNote: notes || '',
                returnContact,
                viewOrderUrl,
              },
              fallbackSubject: `Return request update — ${item.orderNumber}`,
              fallbackHtml: `
                <p>Hi ${customer.fullName || 'there'},</p>
                <p>We reviewed your return request for order <strong>${item.orderNumber}</strong> and are unable to approve it at this time.</p>
                ${notes ? `<p>PawTag note: ${notes}</p>` : ''}
                <p>If you believe this is incorrect, please contact ${returnContact}.</p>
              `,
              businessFlow: 'orders_commerce',
              relatedEntityType: 'return',
              relatedEntityId: String(item._id),
              relatedEntityDisplay: item.orderNumber,
            }).catch((err) =>
              logger.error({ err, returnId: item._id }, 'Failed to send return rejected email'),
            );
          }
        }
      } catch (err) {
        logger.error({ err, returnId: item._id, status }, 'Failed to send return status customer email');
      }
    }

    logger.info({ returnId: req.params.id, status, reviewedBy: req.user!.id }, 'Return status updated');
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

async function runReturnRefund(
  req: AuthRequest,
  res: Response,
  opts: { refundWithoutReturn: boolean },
) {
  const returnId = req.params.id;
  const schema = opts.refundWithoutReturn ? refundWithoutReturnSchema : processRefundSchema;
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid request' });
    return;
  }

  const body = parsed.data as { reason: string; exceptionReason?: string; amount?: number };

  try {
    const ret = await Return.findById(returnId).populate('userId', 'fullName email phoneNumber');
    if (!ret) {
      res.status(404).json({ success: false, error: 'Return not found' });
      return;
    }

    const user = ret.userId as any;
    const actor = {
      id: req.user!.id,
      name: (req.user as any)?.fullName || req.user!.email,
      email: req.user!.email,
      type: 'admin' as const,
    };

    const result = await returnRefundService.processRefund({
      returnId,
      amount: body.amount,
      reason: body.reason,
      actor,
      refundWithoutReturn: opts.refundWithoutReturn,
      exceptionReason: body.exceptionReason,
    });

    await logCommerceEvent({
      action: opts.refundWithoutReturn ? 'return_refund_without_return' : 'return_refund_processed',
      eventType: opts.refundWithoutReturn
        ? 'admin.return.refund_without_return'
        : 'admin.return.refund',
      resourceType: 'Return',
      resourceId: returnId,
      outcome: result.success ? 'SUCCESS' : 'FAILURE',
      severity: 'HIGH',
      metadata: {
        returnId,
        orderNumber: ret.orderNumber,
        userId: user?._id || ret.userId,
        customerEmail: user?.email,
        customerPhone: user?.phoneNumber,
        amount: result.amount,
        refundId: result.refundId,
        refundStatus: result.refundStatus,
        arn: result.arn,
        reason: body.reason,
        refundWithoutReturn: opts.refundWithoutReturn,
        exceptionReason: body.exceptionReason,
        error: result.error,
        actorEmail: actor.email,
        portal: 'admin-web',
      },
    }, req as any);

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error || 'Failed to process refund' });
      return;
    }

    const item = await Return.findById(returnId).populate('userId', 'fullName email phoneNumber').populate('orderId', 'orderNumber status payment');
    const orderIdForBalance = String(item?.orderId && typeof item.orderId === 'object' && (item.orderId as any)._id
      ? (item.orderId as any)._id
      : item?.orderId || '');
    let balance = { capturedAmount: 0, alreadyRefunded: 0, remainingRefundable: 0 };
    try {
      if (orderIdForBalance) {
        balance = await returnRefundService.getBalance(orderIdForBalance);
      }
    } catch {
      // balance is informational on response; refund already succeeded
    }
    res.json({
      success: true,
      data: {
        return: item,
        refundId: result.refundId,
        amount: result.amount,
        refundStatus: result.refundStatus,
        arn: result.arn,
        expectedArrival: result.expectedArrival,
        remainingRefundable: result.remainingRefundable ?? balance.remainingRefundable,
        alreadyRefunded: result.alreadyRefunded ?? balance.alreadyRefunded,
        capturedAmount: result.capturedAmount ?? balance.capturedAmount,
        message: result.refundStatus === 'succeeded'
          ? 'Refund accepted by Stripe'
          : 'Refund submitted — awaiting Stripe confirmation',
      },
    });
  } catch (err) {
    logger.error({ err, returnId }, 'Return refund endpoint failed');
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
}

/** POST /:id/refund — process Stripe refund after warehouse receipt (or as normal path). */
router.post('/:id/refund', requirePermission('order.refund'), async (req: AuthRequest, res: Response) => {
  await runReturnRefund(req, res, { refundWithoutReturn: false });
});

/** POST /:id/refund-without-return — explicit exception + Stripe refund. */
router.post('/:id/refund-without-return', requirePermission('order.refund'), async (req: AuthRequest, res: Response) => {
  await runReturnRefund(req, res, { refundWithoutReturn: true });
});

export default router;

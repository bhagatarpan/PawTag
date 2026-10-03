/**
 * @module Customer Returns Routes
 * @description Customer API routes for return requests and order cancellation.
 *
 * Provides self-service endpoints for:
 * - Creating return requests
 * - Viewing own return requests
 * - Submitting return tracking after approval
 * - Cancelling orders (before shipment)
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { cancelOrderSchema } from '../middleware/schemas';
import { Order, Return, User } from '@pawtag/db';
import { cancelOrder, type CancellationResult } from '../commerce/services/cancellation.service';
import { toAppError } from '../lib/app-errors';
import { notifyCustomerOfStatusChange } from '../services/orderNotification.service';
import { getSetting } from '../commerce/config';
import { getTrackingUrl } from '@pawtag/shared';
import logger from '../lib/logger';

// Zod schema for return request
const returnItemSchema = z.object({
  orderItemId: z.string().min(1, 'orderItemId is required'),
  quantity: z.number().int().min(1, 'quantity must be at least 1'),
  reason: z.string().max(500).optional(),
});

const createReturnSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  reason: z.string().min(1, 'reason is required').max(1000),
  items: z.array(returnItemSchema).min(1, 'At least one item is required'),
});

const trackingSchema = z.object({
  provider: z.string().min(1, 'Shipping provider is required').max(100),
  trackingNumber: z.string().min(3, 'Tracking number is required').max(100),
  trackingUrl: z.string().url().optional().or(z.literal('')),
});

const router = Router();
router.use(authenticate);

/**
 * POST /api/customer/returns
 * Create a return request for an order.
 */
router.post('/', validate(createReturnSchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { orderId, reason, items } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    // Verify order belongs to user
    if (String(order.userId) !== userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Check order is in a returnable status
    const returnableStatuses = ['paid', 'packing', 'shipped', 'delivered'];
    if (!returnableStatuses.includes(order.status)) {
      res.status(400).json({ success: false, error: `Order in status '${order.status}' cannot be returned` });
      return;
    }

    // Check if there's already a pending return for this order
    const existingReturn = await Return.findOne({
      orderId: order._id,
      userId: userId,
      status: { $in: ['pending', 'approved'] },
    });
    if (existingReturn) {
      res.status(409).json({ success: false, error: 'A return request already exists for this order' });
      return;
    }

    // Validate items exist in the order + calculate server-authoritative refund
    let refundAmount = 0;
    const returnItems = items.map((item: { orderItemId: string; quantity: number; reason?: string }) => {
      const orderItem = order.items.find(
        (oi: any) => String(oi._id) === item.orderItemId || String(oi.productId) === item.orderItemId,
      );
      if (!orderItem) {
        throw new Error(`Item ${item.orderItemId} not found in order`);
      }
      if (item.quantity > orderItem.quantity) {
        throw new Error(`Cannot return ${item.quantity} — only ${orderItem.quantity} were ordered`);
      }
      const alreadyRefundedQty = Number((orderItem as any).refundedQuantity || 0);
      const returnableQty = Number(orderItem.quantity || 0) - alreadyRefundedQty;
      if (returnableQty <= 0) {
        throw new Error(`${orderItem.productName} has already been fully refunded and cannot be returned`);
      }
      if (item.quantity > returnableQty) {
        throw new Error(
          `Cannot return ${item.quantity} of ${orderItem.productName} — only ${returnableQty} remaining to return`,
        );
      }
      const unitPrice = Number(orderItem.unitPrice || 0);
      const customizationTotal = Number(orderItem.customizationTotal || 0);
      refundAmount += (unitPrice + customizationTotal) * item.quantity;
      return {
        orderItemId: (orderItem as any)._id || orderItem.productId,
        productName: orderItem.productName,
        quantity: item.quantity,
        reason: item.reason,
        unitPrice,
        customizationTotal,
        refundedQuantity: 0,
      };
    });

    const requester = await User.findById(userId).select('fullName email phoneNumber').lean();

    const returnRequest = await Return.create({
      orderId: order._id,
      orderNumber: order.orderNumber,
      userId: userId,
      status: 'pending',
      reason,
      items: returnItems,
      refundAmount,
      requestedByType: 'customer',
      requestedByEmail: requester?.email,
      requestedByName: requester?.fullName,
      requestedByPhone: requester?.phoneNumber,
      activity: [
        {
          type: 'return_requested',
          message: `Return requested: ${reason}`,
          timestamp: new Date(),
          actor: requester?.email || userId,
          actorType: 'customer',
          metadata: { refundAmount, itemCount: returnItems.length },
        },
      ],
    });

    // Record activity
    await Order.updateOne(
      { _id: orderId },
      {
        $push: {
          activity: {
            type: 'return_requested',
            message: `Return requested: ${reason}`,
            timestamp: new Date(),
            actor: 'customer',
            metadata: { returnId: String(returnRequest._id), refundAmount },
          },
        },
      },
    );

    // Customer confirmation email — warehouse address only in email (product decision)
    try {
      if (requester?.email) {
        const { sendMail } = await import('../services/email.service');
        const warehouseAddress = (await getSetting('commerce.returns.warehouseAddress')) || '';
        const itemLines = returnItems
          .map((i: { productName: string; quantity: number }) => `• ${i.productName} × ${i.quantity}`)
          .join('<br>');
        const addressBlock = warehouseAddress.trim()
          ? `<p><strong>Return address:</strong><br>${warehouseAddress.replace(/\n/g, '<br>')}</p>`
          : `<p>PawTag does not provide return shipping. Please email <strong>support@pawtag.co.nz</strong> for the current warehouse return address before you ship.</p>`;
        const html = `
          <p>Hi ${requester.fullName || 'there'},</p>
          <p>We've received your return request for order <strong>${order.orderNumber}</strong>.</p>
          <p><strong>Items:</strong><br>${itemLines}</p>
          <p><strong>Estimated refund:</strong> $${refundAmount.toFixed(2)} ${order.payment?.currency || 'NZD'}</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>Our team will review it within 1–2 business days.</p>
          <p>PawTag does not provide return shipping. If approved, please send the product with a printed copy of your invoice, in reasonable condition, with original packaging if available.</p>
          ${addressBlock}
          <p>You'll be able to add return tracking on your order after you ship.</p>
        `;
        await sendMail(requester.email, `Return request received — ${order.orderNumber}`, html).catch(() => {});
      }
    } catch (err) {
      logger.error({ err, orderId }, 'Failed to send return request email');
    }

    logger.info({
      orderId,
      orderNumber: order.orderNumber,
      userId,
      refundAmount,
      itemCount: returnItems.length,
    }, 'Return request created');

    res.status(201).json({
      success: true,
      data: returnRequest,
    });
  } catch (err: any) {
    logger.error({ err, userId: req.user?.id }, 'Failed to create return request');
    res.status(400).json({ success: false, error: err.message || 'Failed to create return request' });
  }
});

/**
 * GET /api/customer/returns
 * List the authenticated customer's return requests.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { orderId, page = 1, limit = 20 } = req.query;
    const query: Record<string, any> = { userId };
    if (orderId) query.orderId = orderId;
    const total = await Return.countDocuments(query);
    const items = await Return.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .populate('orderId', 'orderNumber status payment.amount payment.currency payment.cardBrand payment.cardLast4 items');
    res.json({
      success: true,
      data: orderId
        ? items
        : { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

/**
 * POST /api/customer/returns/:id/tracking
 * Customer submits return shipment tracking after CSR approval.
 * Does NOT mark warehouse received — tracking ≠ receipt.
 */
router.post('/:id/tracking', validate(trackingSchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { provider, trackingNumber, trackingUrl } = req.body;

    const ret = await Return.findById(req.params.id);
    if (!ret) {
      res.status(404).json({ success: false, error: 'Return not found' });
      return;
    }
    if (String(ret.userId) !== userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Tracking only after CSR approval (or already received awaiting refund)
    if (!['approved', 'received'].includes(ret.status)) {
      res.status(400).json({
        success: false,
        error: 'You can submit return tracking after your return is approved',
      });
      return;
    }

    // Basic sanitization — no HTML
    const cleanProvider = String(provider).trim().slice(0, 100);
    const cleanTracking = String(trackingNumber).trim().slice(0, 100);
    if (!cleanProvider || !cleanTracking) {
      res.status(400).json({ success: false, error: 'Provider and tracking number are required' });
      return;
    }
    if (/[<>]/.test(cleanProvider) || /[<>]/.test(cleanTracking)) {
      res.status(400).json({ success: false, error: 'Invalid tracking input' });
      return;
    }

    const url = String(trackingUrl || '').trim().slice(0, 500);
    const safeUrl = url && /^https?:\/\//i.test(url) ? url : getTrackingUrl(cleanProvider, cleanTracking) || undefined;

    const isFirstSubmit = !ret.returnTrackingNumber;
    const user = await User.findById(userId).select('fullName email phoneNumber').lean();

    ret.returnShipProvider = cleanProvider;
    ret.returnTrackingNumber = cleanTracking;
    ret.returnTrackingUrl = safeUrl;
    ret.returnTrackingSubmittedAt = new Date();
    ret.returnTrackingSubmittedBy = userId as any;
    ret.returnTrackingSource = 'customer';
    if (!ret.activity) ret.activity = [];
    ret.activity.push({
      type: 'tracking_submitted',
      message: `Customer submitted return tracking ${cleanProvider} ${cleanTracking}`,
      timestamp: new Date(),
      actor: user?.email || userId,
      actorType: 'customer',
      metadata: { provider: cleanProvider, trackingNumber: cleanTracking, trackingUrl: safeUrl },
    });
    await ret.save();

    await Order.updateOne(
      { _id: ret.orderId },
      {
        $push: {
          activity: {
            type: 'tracking_submitted',
            message: `Return tracking submitted: ${cleanProvider} ${cleanTracking}`,
            timestamp: new Date(),
            actor: 'customer',
            metadata: { returnId: String(ret._id), provider: cleanProvider, trackingNumber: cleanTracking },
          },
        },
      },
    );

    // Admin notification email (configurable return mailbox)
    try {
      const notificationEmail = (await getSetting('commerce.returns.notificationEmail')) || 'return@pawtag.co.nz';
      if (notificationEmail.trim()) {
        const { sendMail } = await import('../services/email.service');
        const order = await Order.findById(ret.orderId).select('orderNumber userId payment.amount payment.currency').lean();
        const orderUser = await User.findById(ret.userId).select('fullName email phoneNumber').lean();
        const html = `
          <p><strong>Return tracking submitted</strong></p>
          <p>Customer: ${orderUser?.fullName || 'Unknown'} (${orderUser?.email || ''})${orderUser?.phoneNumber ? ` · ${orderUser.phoneNumber}` : ''}</p>
          <p>Order: ${ret.orderNumber}</p>
          <p>Return ID: ${ret._id}</p>
          <p>Items: ${(ret.items || []).map((i) => `${i.productName} × ${i.quantity}`).join(', ')}</p>
          <p>Refund amount requested: $${Number(ret.refundAmount || 0).toFixed(2)} ${order?.payment?.currency || 'NZD'}</p>
          <p>Carrier: ${cleanProvider}</p>
          <p>Tracking: ${cleanTracking}</p>
          ${safeUrl ? `<p>Tracking URL: ${safeUrl}</p>` : ''}
          <p>Submitted at: ${ret.returnTrackingSubmittedAt?.toISOString()}</p>
          <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/returns">Open Returns in Admin</a></p>
        `;
        await sendMail(notificationEmail, `Return tracking — ${ret.orderNumber}`, html).catch((e) =>
          logger.error({ err: e, returnId: ret._id }, 'Failed to send return tracking admin email'),
        );
      }
    } catch (err) {
      logger.error({ err, returnId: ret._id }, 'Return tracking admin notification failed');
    }

    // Customer confirmation
    try {
      if (user?.email && isFirstSubmit) {
        const { sendMail } = await import('../services/email.service');
        await sendMail(
          user.email,
          `Return tracking received — ${ret.orderNumber}`,
          `<p>Hi ${user.fullName || 'there'},</p><p>We recorded your return tracking for order <strong>${ret.orderNumber}</strong>:</p><p>${cleanProvider} · ${cleanTracking}</p><p>Our warehouse team will mark the return received after the item arrives. You don't need to take further action.</p>`,
        ).catch(() => {});
      }
    } catch (err) {
      logger.error({ err, returnId: ret._id }, 'Failed to send tracking confirmation email');
    }

    logger.info(
      {
        returnId: ret._id,
        orderNumber: ret.orderNumber,
        userId,
        provider: cleanProvider,
        trackingNumber: cleanTracking,
      },
      'Return tracking submitted by customer',
    );

    res.json({ success: true, data: ret });
  } catch (err) {
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

/**
 * POST /api/customer/orders/:id/cancel
 * Cancel an order (only if not yet shipped).
 */
function cancellationHttpStatus(result: CancellationResult): number {
  switch (result.errorCode) {
    case 'ORDER_NOT_FOUND':
      return 404;
    case 'ORDER_NOT_CANCELLABLE':
      return 400;
    case 'REFUND_FAILED':
      // Customer expects a refund on cancel; surface provider failure as bad gateway.
      return 502;
    default:
      return 500;
  }
}

router.post('/orders/:id/cancel', validate(cancelOrderSchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { reason, notes, portal } = req.body;

    // Verify ownership
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    if (String(order.userId) !== userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const resolvedPortal = portal === 'customer-mobile' ? 'customer-mobile' : 'customer-web';

    const user = await User.findById(userId).select('fullName').lean();
    const customerFullName = user?.fullName || 'Customer';

    // Use central cancellation service (requireRefundSuccess=true for customer).
    // actor.type is lowercase so PaymentTransaction.initiatedBy matches model enum.
    const result = await cancelOrder({
      orderId: req.params.id,
      reason,
      notes,
      actor: {
        name: customerFullName,
        type: 'customer',
        portal: resolvedPortal,
      },
      requireRefundSuccess: true,
    });

    if (!result.success) {
      const statusCode = cancellationHttpStatus(result);
      logger.warn({
        orderId: req.params.id,
        userId,
        errorCode: result.errorCode,
        statusCode,
      }, 'Customer order cancel failed');
      res.status(statusCode).json({ success: false, error: result.error });
      return;
    }

    notifyCustomerOfStatusChange(result.order, 'cancelled', { reason }).catch(() => {});

    if (result.bookkeepingFailed) {
      logger.error({
        orderId: req.params.id,
        userId,
        refundId: result.refundId,
      }, 'Customer cancel completed with PaymentTransaction bookkeeping failure — repair required');
    }

    res.json({
      success: true,
      data: {
        status: 'cancelled',
        refundAmount: result.order.payment?.amount || 0,
        refundId: result.refundId || null,
        bookkeepingFailed: Boolean(result.bookkeepingFailed),
      },
    });
  } catch (err) {
    const appErr = toAppError(err);
    res.status(appErr.httpStatus || 500).json({ success: false, error: appErr.userMessage });
  }
});

export default router;

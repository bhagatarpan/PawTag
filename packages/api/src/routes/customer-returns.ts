/**
 * @module Customer Returns Routes
 * @description Customer API routes for return requests and order cancellation.
 *
 * Provides self-service endpoints for:
 * - Creating return requests
 * - Viewing own return requests
 * - Cancelling orders (before shipment)
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { cancelOrderSchema } from '../middleware/schemas';
import { Order, Return, PaymentTransaction, User } from '@pawtag/db';
import { cancelOrder } from '../commerce/services/cancellation.service';
import { toAppError } from '../lib/app-errors';
import { notifyCustomerOfStatusChange } from '../services/orderNotification.service';
import { formatActivityMessage, formatCancelledBy, formatCancelledByDescription, formatCancellationPortalLabel } from '../lib/actor';
import { isValidTransition } from '../services/orderStatus.service';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

/**
 * POST /api/customer/returns
 * Create a return request for an order.
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { orderId, reason, items } = req.body;

    if (!orderId || !reason || !items?.length) {
      res.status(400).json({ success: false, error: 'orderId, reason, and items are required' });
      return;
    }

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

    // Validate items exist in the order
    const returnItems = items.map((item: { orderItemId: string; quantity: number; reason?: string }) => {
      const orderItem = order.items.find((oi) => String(oi.productId) === item.orderItemId);
      if (!orderItem) {
        throw new Error(`Item ${item.orderItemId} not found in order`);
      }
      if (item.quantity > orderItem.quantity) {
        throw new Error(`Cannot return ${item.quantity} — only ${orderItem.quantity} were ordered`);
      }
      return {
        orderItemId: item.orderItemId,
        productName: orderItem.productName,
        quantity: item.quantity,
        reason: item.reason,
      };
    });

    // Calculate refund amount
    let refundAmount = 0;
    for (const item of returnItems) {
      const orderItem = order.items.find((oi) => String(oi.productId) === item.orderItemId);
      if (orderItem) {
        refundAmount += orderItem.unitPrice * item.quantity;
      }
    }

    const returnRequest = await Return.create({
      orderId: order._id,
      orderNumber: order.orderNumber,
      userId: userId,
      status: 'pending',
      reason,
      items: returnItems,
      refundAmount,
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

    logger.info({
      orderId,
      orderNumber: order.orderNumber,
      userId,
      refundAmount,
      itemCount: returnItems.length,
    }, 'Return request created');

    res.status(201).json({
      success: true,
      data: {
        _id: returnRequest._id,
        status: returnRequest.status,
        refundAmount,
        items: returnItems,
      },
    });
  } catch (err) {
    const appErr = toAppError(err);
    res.status(appErr.httpStatus || 500).json({ success: false, error: appErr.userMessage });
  }
});

/**
 * GET /api/customer/returns
 * List return requests for the current user.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 20 } = req.query;

    const total = await Return.countDocuments({ userId });
    const returns = await Return.find({ userId })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: {
        items: returns,
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
 * POST /api/customer/orders/:id/cancel
 * Cancel an order (only if not yet shipped).
 */
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

    // Use central cancellation service (requireRefundSuccess=true for customer)
    const result = await cancelOrder({
      orderId: req.params.id,
      reason,
      notes,
      actor: {
        name: customerFullName,
        type: 'Customer',
        portal: resolvedPortal,
      },
      requireRefundSuccess: true,
    });

    if (!result.success) {
      const statusCode = result.error?.includes('cannot be cancelled') ? 400 : 500;
      res.status(statusCode).json({ success: false, error: result.error });
      return;
    }

    notifyCustomerOfStatusChange(result.order, 'cancelled', { reason }).catch(() => {});

    res.json({ success: true, data: { status: 'cancelled', refundAmount: result.order.payment?.amount || 0 } });
  } catch (err) {
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

export default router;

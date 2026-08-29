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
import { Order, Return, PaymentTransaction } from '@pawtag/db';
import { stripePaymentProvider } from '../commerce/providers/stripe';
import { inventoryService } from '../commerce/services/inventory.service';
import { toAppError } from '../lib/app-errors';
import { notifyCustomerOfStatusChange } from '../services/orderNotification.service';
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
router.post('/orders/:id/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { reason } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    // Verify order belongs to user
    if (String(order.userId) !== userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Only allow cancellation before shipment
    const cancellableStatuses = ['paid', 'packing'];
    if (!cancellableStatuses.includes(order.status)) {
      res.status(400).json({
        success: false,
        error: `Order in status '${order.status}' cannot be cancelled. Contact support for assistance.`,
      });
      return;
    }

    // Process refund if payment was completed
    if (order.payment?.status === 'completed' && order.payment?.stripePaymentIntentId) {
      const paymentIntentId = order.payment.stripePaymentIntentId;
      if (!paymentIntentId.startsWith('pi_demo_')) {
        try {
          await stripePaymentProvider.createRefund({
            paymentIntentId,
            amount: order.payment.amount,
            reason: 'requested_by_customer',
          });

          // Record refund transaction
          await PaymentTransaction.create({
            orderId: order._id,
            orderNumber: order.orderNumber,
            type: 'refund',
            status: 'succeeded',
            amount: order.payment.amount,
            currency: order.payment.currency || 'NZD',
            provider: 'stripe',
            providerTransactionId: paymentIntentId,
            initiatedBy: 'customer',
            notes: reason || 'Customer cancelled order',
          });
        } catch (err: any) {
          logger.error({ err, orderId: String(order._id) }, 'Failed to process refund for cancelled order');
          res.status(502).json({ success: false, error: 'Failed to process refund. Please contact support.' });
          return;
        }
      }
    }

    // Update order status
    order.status = 'cancelled';
    order.cancellationReason = reason || 'Cancelled by customer';
    if (order.payment) {
      order.payment.status = 'refunded';
    }
    await order.save();

    // Release inventory
    try {
      await inventoryService.releaseForOrder(order._id.toString(), order.items.map((item) => ({
        productId: String(item.productId),
        quantity: item.quantity,
      })));
    } catch {
      // Best-effort stock release
    }

    // Record activity
    await Order.updateOne(
      { _id: order._id },
      {
        $push: {
          activity: {
            type: 'cancelled',
            message: `Order cancelled by customer${reason ? `: ${reason}` : ''}`,
            timestamp: new Date(),
            actor: 'customer',
            metadata: { reason },
          },
        },
      },
    );

    // Notify customer
    notifyCustomerOfStatusChange(order, 'cancelled').catch(() => {});

    logger.info({
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      userId,
      reason,
    }, 'Order cancelled by customer');

    res.json({ success: true, data: { status: 'cancelled', refundAmount: order.payment?.amount || 0 } });
  } catch (err) {
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

export default router;

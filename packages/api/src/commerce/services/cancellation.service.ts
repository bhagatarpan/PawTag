/**
 * @module Cancellation Service
 * @description Central service for order cancellation business rules.
 *
 * Consolidates cancellation logic from:
 * - customer-returns.ts (customer cancellation)
 * - admin.ts (admin cancellation)
 * - stripe-webhooks.ts (payment failure)
 *
 * Business rules:
 * - Only orders in cancellable states can be cancelled
 * - Paid orders get refunded via Stripe
 * - Inventory is released
 * - Activity is logged
 * - Customer is notified
 *
 * The caller decides:
 * - Authorization (ownership vs RBAC)
 * - Whether to fail or continue if refund fails
 * - Audit event details
 */

import { Order, PaymentTransaction } from '@pawtag/db';
import { stripePaymentProvider } from '../providers/stripe';
import { inventoryService } from './inventory.service';
import { logPaymentEvent } from '../audit';
import logger from '../../lib/logger';

/** Valid order statuses that can be cancelled */
const CANCELLABLE_STATUSES = ['pending', 'pending_payment', 'paid', 'packing'] as const;

/** Result of a cancellation attempt */
export interface CancellationResult {
  success: boolean;
  order: any;
  refundCreated: boolean;
  refundId?: string;
  error?: string;
}

/** Actor information for cancellation */
export interface CancellationActor {
  /** Display name of the actor */
  name: string;
  /** Actor type: 'customer', 'admin', 'system' */
  type: string;
  /** Portal: 'customer-web', 'customer-mobile', 'admin-web', 'system' */
  portal: string;
}

/**
 * Check if an order status transition is valid.
 */
export function isValidCancellationStatus(status: string): boolean {
  return (CANCELLABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Cancel an order with optional refund.
 *
 * @param params - Cancellation parameters
 * @returns Cancellation result
 */
export async function cancelOrder(params: {
  orderId: string;
  reason: string;
  notes?: string;
  actor: CancellationActor;
  /** If true, refund failure returns error. If false, continues without refund. */
  requireRefundSuccess?: boolean;
}): Promise<CancellationResult> {
  const { orderId, reason, notes, actor, requireRefundSuccess = false } = params;

  // 1. Find order
  const order = await Order.findById(orderId);
  if (!order) {
    return { success: false, order: null, refundCreated: false, error: 'Order not found' };
  }

  // 2. Validate status
  if (!isValidCancellationStatus(order.status)) {
    return {
      success: false,
      order,
      refundCreated: false,
      error: `Order in status '${order.status}' cannot be cancelled`,
    };
  }

  const previousStatus = order.status;
  const cancelledAt = new Date();

  // 3. Process refund for paid orders
  let refundCreated = false;
  let refundId: string | undefined;

  if (order.payment?.status === 'completed' && order.payment?.stripePaymentIntentId) {
    const paymentIntentId = order.payment.stripePaymentIntentId;

    // Skip demo/test payment intents
    if (!paymentIntentId.startsWith('pi_demo_')) {
      try {
        const refundResult = await stripePaymentProvider.createRefund({
          paymentIntentId,
          amount: order.payment.amount,
          reason: 'requested_by_customer',
          metadata: {
            orderId: String(order._id),
            orderNumber: order.orderNumber,
            cancelledBy: actor.name,
            cancelledByType: actor.type,
            cancelledByPortal: actor.portal,
            cancellationReason: reason,
            cancellationNotes: notes || '',
            initiatedBy: actor.type,
            environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
          },
        });

        if (refundResult.refundId) {
          order.refundId = refundResult.refundId;
          order.refundStatus = (refundResult.status as any) || 'pending';
          order.refundLastSyncedAt = new Date();
          refundCreated = true;
          refundId = refundResult.refundId;
        }

        // Record payment transaction
        await PaymentTransaction.create({
          orderId: order._id,
          orderNumber: order.orderNumber,
          type: 'refund',
          status: refundResult.status === 'succeeded' ? 'succeeded' : 'pending',
          amount: order.payment.amount,
          currency: order.payment.currency || 'NZD',
          provider: 'stripe',
          providerTransactionId: refundResult.refundId || paymentIntentId,
          providerStatus: refundResult.status,
          arn: refundResult.arn,
          expectedArrival: refundResult.expectedArrival,
          initiatedBy: actor.type,
          attemptCount: 0,
          notes: notes ? `${reason} — ${notes}` : reason,
        });

        await logPaymentEvent('refunded', {
          paymentIntentId,
          orderId: String(order._id),
          orderNumber: order.orderNumber,
          amount: order.payment.amount,
        });
      } catch (err: any) {
        logger.error({ err, orderId: String(order._id), actor: actor.type }, 'Failed to process refund during cancellation');

        if (requireRefundSuccess) {
          return {
            success: false,
            order,
            refundCreated: false,
            error: 'Failed to process refund. Please contact support.',
          };
        }
        // Otherwise continue with cancellation without refund
      }
    }
  }

  // 4. Update order status
  order.status = 'cancelled';
  order.cancellationReason = reason;
  order.cancellationNotes = notes;
  order.cancelledBy = `${actor.name} (${actor.type})`;
  order.cancelledByType = actor.type;
  order.cancelledByPortal = actor.portal as any;
  order.cancelledByDescription = `${actor.name} via ${actor.portal}`;
  order.cancelledAt = cancelledAt;

  if (refundCreated && order.payment) {
    order.payment.status = 'refunded';
  }

  await order.save();

  // 5. Release inventory
  try {
    await inventoryService.releaseForOrder(order._id.toString(), order.items.map((item) => ({
      productId: String(item.productId),
      quantity: item.quantity,
    })));
  } catch (err) {
    logger.error({ err, orderId: String(order._id) }, 'Failed to release inventory during cancellation');
    // Best-effort — order is still cancelled
  }

  // 6. Log activity
  const activityMessage = `Cancelled by ${actor.name}: ${reason}`;
  await Order.updateOne(
    { _id: order._id },
    {
      $push: {
        activity: {
          type: 'cancelled',
          message: activityMessage,
          timestamp: cancelledAt,
          actor: actor.type === 'customer' ? 'customer' : actor.type === 'admin' ? 'admin' : 'system',
          metadata: {
            reason,
            notes,
            cancelledBy: actor.name,
            cancelledByType: actor.type,
            cancelledByPortal: actor.portal,
            cancelledAt: cancelledAt.toISOString(),
            refundCreated,
            refundId: order.refundId,
          },
        },
      },
    },
  );

  logger.info({
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    previousStatus,
    reason,
    cancelledBy: actor.name,
    cancelledByType: actor.type,
    refundCreated,
  }, 'Order cancelled');

  return {
    success: true,
    order,
    refundCreated,
    refundId,
  };
}

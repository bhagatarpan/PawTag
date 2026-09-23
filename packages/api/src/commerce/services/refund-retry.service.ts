/**
 * @module Refund Retry Service
 * @description Handles automatic retry of failed refunds with MongoDB persistence.
 *
 * Flow:
 * 1. When a refund fails, schedule a retry (persisted to MongoDB)
 * 2. First retry: 2 hours after failure
 * 3. Second retry: 24 hours after failure (via daily reconciliation job)
 * 4. After max retries, alert admin for manual intervention
 *
 * Manual retry is also available via the admin "Retry Refund" button.
 *
 * Both customer and admin cancellations are eligible for auto-retry.
 */

import { Order, PendingRefundRetry } from '@pawtag/db';
import { stripePaymentProvider } from '../providers/stripe';
import { getNumberSetting } from '../config';
import { logRefundEvent } from '../audit';
import logger from '../../lib/logger';

// In-memory timers for active retries (survives DB reads, lost on restart)
// The DB is the source of truth; timers are just triggers
const activeTimers = new Map<string, NodeJS.Timeout>();

/**
 * Schedule a retry of a failed refund. Persists to MongoDB.
 *
 * @param orderId - Order ID
 * @param refundId - Previous (failed) Stripe refund ID
 * @param attemptNumber - 1 = first auto-retry, 2 = second
 * @param delayHours - Hours to wait before retrying
 */
export async function scheduleRefundRetry(
  orderId: string,
  refundId: string,
  attemptNumber: number,
  delayHours: number,
): Promise<void> {
  // Cancel any existing retry for this order
  await cancelRefundRetry(orderId);

  const delayMs = delayHours * 60 * 60 * 1000;
  const scheduledAt = new Date(Date.now() + delayMs);

  // Persist to MongoDB
  await PendingRefundRetry.findOneAndUpdate(
    { orderId },
    {
      orderId,
      refundId,
      attemptNumber,
      scheduledAt,
      status: 'pending',
    },
    { upsert: true, new: true },
  );

  // Also schedule in-memory timer for immediate execution
  const timer = setTimeout(async () => {
    try {
      await executeRefundRetry(orderId, refundId, attemptNumber);
    } catch (err) {
      logger.error({ err, orderId, refundId }, 'Scheduled refund retry execution failed');
    }
    activeTimers.delete(orderId);
  }, delayMs);

  activeTimers.set(orderId, timer);

  logger.info({
    orderId,
    refundId,
    attemptNumber,
    delayHours,
    scheduledAt,
  }, 'Refund retry scheduled');
}

/**
 * Cancel a pending retry for an order.
 */
export async function cancelRefundRetry(orderId: string): Promise<void> {
  // Cancel in-memory timer
  const existingTimer = activeTimers.get(orderId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    activeTimers.delete(orderId);
  }

  // Update DB record
  await PendingRefundRetry.updateOne(
    { orderId, status: 'pending' },
    { $set: { status: 'completed' } },
  );

  logger.info({ orderId }, 'Pending refund retry cancelled');
}

/**
 * Execute a retry. Called by the timer or by the daily reconciliation job.
 */
export async function executeRefundRetry(
  orderId: string,
  previousRefundId: string,
  attemptNumber: number,
): Promise<{ success: boolean; newRefundId?: string; error?: string }> {
  const order = await Order.findById(orderId);
  if (!order) {
    logger.warn({ orderId }, 'Retry: order not found');
    return { success: false, error: 'Order not found' };
  }

  if (order.status !== 'cancelled' && order.status !== 'refunded') {
    logger.info({ orderId, status: order.status }, 'Retry: order not in cancellable state, skipping');
    return { success: false, error: 'Order not in cancellable state' };
  }

  if (!order.payment?.stripePaymentIntentId) {
    logger.warn({ orderId }, 'Retry: no Stripe payment intent on order');
    return { success: false, error: 'No Stripe payment intent' };
  }

  const amount = order.payment.amount;
  const reason = order.cancellationReason || 'Customer requested cancellation';

  logger.info({
    orderId,
    orderNumber: order.orderNumber,
    attemptNumber,
    amount,
  }, 'Executing refund retry');

  const result = await stripePaymentProvider.createRefund({
    paymentIntentId: order.payment.stripePaymentIntentId,
    amount,
    reason: 'requested_by_customer',
    metadata: {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      retryAttempt: String(attemptNumber),
      previousRefundId,
    },
  });

  if (result.success && result.refundId) {
    // Update order with successful refund
    order.refundId = result.refundId;
    order.refundStatus = 'pending';
    order.refundLastSyncedAt = new Date();
    await order.save();

    // Mark DB record as completed
    await PendingRefundRetry.updateOne(
      { orderId, status: 'pending' },
      { $set: { status: 'completed', lastAttemptAt: new Date() } },
    );

    await logRefundEvent('succeeded', {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      refundId: result.refundId,
      amount,
      currency: order.payment?.currency || 'NZD',
    });

    logger.info({
      orderId,
      orderNumber: order.orderNumber,
      refundId: result.refundId,
      attemptNumber,
    }, 'Refund retry succeeded');

    return { success: true, newRefundId: result.refundId };
  } else {
    // Mark DB record as failed
    await PendingRefundRetry.updateOne(
      { orderId, status: 'pending' },
      {
        $set: {
          status: 'failed',
          lastAttemptAt: new Date(),
          lastError: result.error || 'Unknown error',
        },
      },
    );

    await logRefundEvent('failed', {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      amount,
      currency: order.payment?.currency || 'NZD',
      error: result.error,
    });

    logger.error({
      orderId,
      orderNumber: order.orderNumber,
      attemptNumber,
      error: result.error,
    }, 'Refund retry failed');

    return { success: false, error: result.error };
  }
}

/**
 * Called by onRefundFailed to schedule first retry.
 */
export async function onRefundFailed(
  orderId: string,
  refundId: string,
): Promise<void> {
  const maxAutoRetries = Number(await getNumberSetting('commerce.refunds.maxAutoRetries')) || 1;
  const firstHours = Number(await getNumberSetting('commerce.refunds.retryFirstHours')) || 2;

  const order = await Order.findById(orderId);
  if (!order) return;

  const currentAttempts = order.refundAttemptCount || 0;

  if (currentAttempts >= maxAutoRetries) {
    logger.info({ orderId, attempts: currentAttempts }, 'Max refund retries reached, skipping');
    return;
  }

  order.refundAttemptCount = currentAttempts + 1;
  await order.save();

  await scheduleRefundRetry(orderId, refundId, currentAttempts + 1, firstHours);
}

/**
 * Called by the daily reconciliation job to retry failed refunds that
 * haven't been retried yet (second attempt at 24h).
 */
export async function processFailedRefundRetries(): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
}> {
  const maxAutoRetries = Number(await getNumberSetting('commerce.refunds.maxAutoRetries')) || 1;
  const secondHours = Number(await getNumberSetting('commerce.refunds.retrySecondHours')) || 24;

  // Find failed refunds that have not been retried (or are due for second retry)
  const failedRefunds = await Order.find({
    refundStatus: 'failed',
    refundAttemptCount: { $lt: maxAutoRetries },
    cancelledAt: { $lte: new Date(Date.now() - secondHours * 60 * 60 * 1000) },
  }).limit(50);

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

  for (const orderItem of failedRefunds) {
    attempted++;
    const previousRefundId = orderItem.refundId || '';
    const result = await executeRefundRetry(
      String(orderItem._id),
      previousRefundId,
      (orderItem.refundAttemptCount || 0) + 1,
    );
    if (result.success) succeeded++;
    else failed++;
  }

  return { attempted, succeeded, failed };
}

/**
 * Manual retry triggered by admin "Retry Refund" button.
 */
export async function manualRefundRetry(
  orderId: string,
): Promise<{ success: boolean; newRefundId?: string; error?: string }> {
  const order = await Order.findById(orderId);
  if (!order) return { success: false, error: 'Order not found' };

  if (order.refundStatus !== 'failed') {
    return { success: false, error: 'Refund is not in failed state' };
  }

  const previousRefundId = order.refundId || '';
  const nextAttempt = (order.refundAttemptCount || 0) + 1;

  const result = await executeRefundRetry(orderId, previousRefundId, nextAttempt);
  return result;
}

/**
 * Get all pending retries from MongoDB (for admin visibility).
 */
export async function getPendingRetries(): Promise<Array<{
  orderId: string;
  refundId: string;
  scheduledAt: Date;
  attemptNumber: number;
}>> {
  const retries = await PendingRefundRetry.find({ status: 'pending' }).lean();
  return retries.map((r) => ({
    orderId: r.orderId,
    refundId: r.refundId,
    scheduledAt: r.scheduledAt,
    attemptNumber: r.attemptNumber,
  }));
}

/**
 * Reload pending retries from MongoDB and reschedule timers.
 * Called on process startup to recover from crashes.
 */
export async function reloadPendingRetries(): Promise<void> {
  const pending = await PendingRefundRetry.find({ status: 'pending' }).lean();
  
  for (const retry of pending) {
    const delayMs = retry.scheduledAt.getTime() - Date.now();
    
    if (delayMs <= 0) {
      // Already due — execute immediately
      try {
        await executeRefundRetry(retry.orderId, retry.refundId, retry.attemptNumber);
      } catch (err) {
        logger.error({ err, orderId: retry.orderId }, 'Failed to execute recovered refund retry');
      }
    } else {
      // Schedule timer
      const timer = setTimeout(async () => {
        try {
          await executeRefundRetry(retry.orderId, retry.refundId, retry.attemptNumber);
        } catch (err) {
          logger.error({ err, orderId: retry.orderId }, 'Scheduled refund retry execution failed');
        }
        activeTimers.delete(retry.orderId);
      }, delayMs);
      
      activeTimers.set(retry.orderId, timer);
    }
  }

  logger.info({ count: pending.length }, 'Reloaded pending refund retries from database');
}

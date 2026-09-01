/**
 * @module Refund Retry Service
 * @description Handles automatic retry of failed refunds.
 *
 * Flow:
 * 1. When a refund fails, schedule a retry using in-memory timer
 * 2. First retry: 2 hours after failure
 * 3. Second retry: 24 hours after failure (via daily reconciliation job)
 * 4. After max retries, alert admin for manual intervention
 *
 * Manual retry is also available via the admin "Retry Refund" button.
 *
 * Both customer and admin cancellations are eligible for auto-retry.
 */

import { Order } from '@pawtag/db';
import { stripePaymentProvider } from '../providers/stripe';
import { getNumberSetting } from '../config';
import { logRefundEvent } from '../audit';
import logger from '../../lib/logger';

interface PendingRetry {
  orderId: string;
  refundId: string;
  scheduledAt: Date;
  attemptNumber: number;
  timer: NodeJS.Timeout;
}

const pendingRetries = new Map<string, PendingRetry>();

/**
 * Schedule a retry of a failed refund.
 *
 * @param orderId - Order ID
 * @param refundId - Previous (failed) Stripe refund ID
 * @param attemptNumber - 1 = first auto-retry, 2 = second
 * @param delayHours - Hours to wait before retrying
 */
export function scheduleRefundRetry(
  orderId: string,
  refundId: string,
  attemptNumber: number,
  delayHours: number,
): void {
  // Cancel any existing retry for this order
  cancelRefundRetry(orderId);

  const delayMs = delayHours * 60 * 60 * 1000;
  const scheduledAt = new Date(Date.now() + delayMs);

  const timer = setTimeout(async () => {
    try {
      await executeRefundRetry(orderId, refundId, attemptNumber);
    } catch (err) {
      logger.error({ err, orderId, refundId }, 'Scheduled refund retry execution failed');
    }
    pendingRetries.delete(orderId);
  }, delayMs);

  pendingRetries.set(orderId, {
    orderId,
    refundId,
    scheduledAt,
    attemptNumber,
    timer,
  });

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
export function cancelRefundRetry(orderId: string): void {
  const existing = pendingRetries.get(orderId);
  if (existing) {
    clearTimeout(existing.timer);
    pendingRetries.delete(orderId);
    logger.info({ orderId }, 'Pending refund retry cancelled');
  }
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
      initiatedBy: order.cancelledByType === 'System' ? 'system' :
                   order.cancelledByType === 'Customer' ? 'customer' : 'admin',
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    },
  });

  if (result.success && result.refundId) {
    order.refundId = result.refundId;
    order.refundStatus = 'pending';
    order.refundAttemptCount = attemptNumber;
    order.refundLastSyncedAt = new Date();
    await order.save();

    await logRefundEvent('succeeded', {
      orderId,
      orderNumber: order.orderNumber,
      amount,
      currency: order.payment.currency || 'NZD',
      reason: `Retry attempt ${attemptNumber}`,
      metadata: { newRefundId: result.refundId, attemptNumber },
    } as any).catch(() => {});

    logger.info({
      orderId,
      orderNumber: order.orderNumber,
      newRefundId: result.refundId,
      attemptNumber,
    }, 'Refund retry succeeded');

    return { success: true, newRefundId: result.refundId };
  }

  logger.warn({
    orderId,
    orderNumber: order.orderNumber,
    attemptNumber,
    error: result.error,
  }, 'Refund retry failed');

  return { success: false, error: result.error };
}

/**
 * Called by the webhook handler when a refund fails.
 * Schedules the first auto-retry (2h by default).
 */
export async function onRefundFailed(
  orderId: string,
  refundId: string,
): Promise<void> {
  const order = await Order.findById(orderId);
  if (!order) return;

  const currentAttempts = order.refundAttemptCount || 0;
  const maxAutoRetries = Number(await getNumberSetting('commerce.refunds.maxAutoRetries')) || 1;
  const firstHours = Number(await getNumberSetting('commerce.refunds.retryFirstHours')) || 2;

  if (currentAttempts >= maxAutoRetries) {
    logger.info({
      orderId,
      refundId,
      currentAttempts,
      maxAutoRetries,
    }, 'Max auto-retries reached, waiting for manual intervention');
    return;
  }

  order.refundAttemptCount = currentAttempts + 1;
  await order.save();

  scheduleRefundRetry(orderId, refundId, currentAttempts + 1, firstHours);
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
 * Get all pending retries (for admin visibility).
 */
export function getPendingRetries(): Array<{
  orderId: string;
  refundId: string;
  scheduledAt: Date;
  attemptNumber: number;
}> {
  return Array.from(pendingRetries.values()).map((r) => ({
    orderId: r.orderId,
    refundId: r.refundId,
    scheduledAt: r.scheduledAt,
    attemptNumber: r.attemptNumber,
  }));
}

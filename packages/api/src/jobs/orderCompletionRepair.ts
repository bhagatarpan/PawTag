/**
 * @module Order Completion Repair Job
 * @description Safety net for paid orders whose post-payment completion
 * pipeline was interrupted (deploy restart, crash, unguarded write
 * failure — the WO-000505 failure mode). Such orders sit at
 * `completionStatus: 'pending'` with money taken but no invoice, emails,
 * notifications, fulfilment, or entitlements.
 *
 * This job finds paid orders stuck at 'pending' (or 'repair_required')
 * older than 10 minutes and re-runs the idempotent completion pipeline
 * via checkoutService.resumeOrderCompletion(). Webhook/customer retries
 * also resume via confirmCheckout — this job is the third safety net
 * that covers customers who never retry.
 *
 * Financial job: runs under the scheduler's distributed lock. Every
 * completion step is idempotent, so overlapping/failed runs are safe.
 */

import { Order } from '@pawtag/db';
import { checkoutService } from '../commerce/services/checkout.service';
import logger from '../lib/logger';

/** Orders younger than this are likely mid-flight in a live request. */
const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

/** Batch cap per run. */
const BATCH_LIMIT = 20;

/**
 * Repair paid orders stuck without completed post-payment processing.
 */
async function repairStuckOrders(): Promise<void> {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);

  const stuckOrders = await Order.find({
    status: 'paid',
    completionStatus: { $in: ['pending', 'repair_required'] },
    createdAt: { $lte: cutoff },
  })
    .sort({ createdAt: 1 })
    .limit(BATCH_LIMIT)
    .select('_id orderNumber userId payment.stripePaymentIntentId completionStatus');

  if (!stuckOrders.length) return;

  logger.info({ count: stuckOrders.length }, 'Repairing stuck order completions');

  for (const order of stuckOrders) {
    try {
      const result = await checkoutService.resumeOrderCompletion(String(order._id));
      if (result) {
        logger.info(
          { orderId: String(order._id), orderNumber: order.orderNumber },
          'Repaired stuck order completion',
        );
      } else {
        logger.warn(
          { orderId: String(order._id), orderNumber: order.orderNumber, completionStatus: order.completionStatus },
          'Stuck order not in a resumable state — skipped',
        );
      }
    } catch (err: any) {
      // One bad order must not stop the batch — it stays stuck and the
      // next run retries it.
      logger.error({ err, orderId: String(order._id), orderNumber: order.orderNumber }, 'Order completion repair failed');
    }
  }
}

export async function runOrderCompletionRepairJob(): Promise<import('../services/job-scheduler.service').JobResult> {
  try {
    await repairStuckOrders();
    return { success: true };
  } catch (error: any) {
    logger.error({ err: error }, '[OrderCompletionRepairJob] Job error');
    return { success: false, error: error.message || 'Unknown error' };
  }
}

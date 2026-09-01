/**
 * @module Refund Reconciliation Job
 * @description Background job that reconciles PawTag refunds against Stripe.
 *
 * Runs daily at a configurable hour (default 2am NZ time).
 * Fetches recent refunds from Stripe and updates PawTag records with:
 * - Latest refund status (pending, succeeded, failed)
 * - Acquirer Reference Number (ARN)
 * - Expected arrival date
 * - Last synced timestamp
 *
 * Also processes failed refund retries as a second attempt (24h after first).
 *
 * Can also be triggered manually via the admin dashboard.
 *
 * @example
 * ```typescript
 * import { startRefundReconciliationJob } from '../jobs/refundReconciliation';
 * startRefundReconciliationJob();
 * ```
 */

import { Order, PaymentTransaction } from '@pawtag/db';
import { stripePaymentProvider } from '../commerce/providers/stripe';
import { getNumberSetting, getBooleanSetting } from '../commerce/config';
import { processFailedRefundRetries } from '../commerce/services/refund-retry.service';
import logger from '../lib/logger';

let reconcileTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Calculate the delay in ms until the next scheduled run.
 *
 * Scheduled for `reconciliationHour` (default 2) in NZ timezone.
 *
 * @param hour - Hour of day in NZ time (0-23)
 * @returns Delay in ms
 */
function calculateDelayMs(hour: number): number {
  const now = new Date();
  // NZ timezone offset (NZST = UTC+12, NZDT = UTC+13)
  // Using a simple approximation: try UTC+12
  const nzOffsetHours = 12;

  const nowUtc = now.getTime();
  const nowNzHour = (now.getUTCHours() + nzOffsetHours) % 24;

  let hoursUntilNext = (hour - nowNzHour + 24) % 24;
  if (hoursUntilNext === 0) {
    // Already past the hour today, schedule for tomorrow
    hoursUntilNext = 24;
  }

  // Adjust to account for the minutes past the hour
  const minutesPastHour = now.getMinutes();
  hoursUntilNext = hoursUntilNext - (minutesPastHour / 60);

  return Math.max(hoursUntilNext * 60 * 60 * 1000, 60_000); // At least 1 minute
}

/**
 * Run a single reconciliation pass.
 * - Fetches refunds from Stripe (last 7 days)
 * - Updates PawTag order and PaymentTransaction records
 * - Retries failed refunds (24h after first failure)
 */
export async function runRefundReconciliation(): Promise<{
  synced: number;
  retried: number;
  succeeded: number;
  failed: number;
  errors: number;
}> {
  const enabled = await getBooleanSetting('commerce.refunds.reconciliationEnabled').catch(() => true);
  if (!enabled) {
    logger.info('Refund reconciliation disabled by setting');
    return { synced: 0, retried: 0, succeeded: 0, failed: 0, errors: 0 };
  }

  // Skip if Stripe is not configured (demo mode)
  if (!stripePaymentProvider.isConfigured()) {
    logger.info('Stripe not configured, skipping refund reconciliation');
    return { synced: 0, retried: 0, succeeded: 0, failed: 0, errors: 0 };
  }

  logger.info('Starting daily refund reconciliation');

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

  // Fetch refunds from Stripe
  const refunds = await stripePaymentProvider.listRefunds({ since, limit: 100 });

  let synced = 0;
  let errors = 0;

  // Sync each refund to PawTag
  for (const refund of refunds) {
    try {
      if (!refund.refundId) continue;

      const piId = (refund as any).payment_intent;
      if (!piId) continue;

      const order = await Order.findOne({
        $or: [
          { 'payment.stripePaymentIntentId': piId },
          { 'payment.transactionId': piId },
        ],
      });

      if (!order) {
        logger.warn({ refundId: refund.refundId, piId }, 'Reconciliation: order not found for refund');
        continue;
      }

      // Update order with latest status
      const previousStatus = order.refundStatus;
      order.refundId = refund.refundId;
      order.refundStatus = (refund.status as any) || 'pending';
      order.refundLastSyncedAt = new Date();
      if (refund.arn) order.refundArn = refund.arn;
      if (refund.expectedArrival) order.refundExpectedArrival = refund.expectedArrival;
      if (order.refundStatus === 'succeeded' && !order.refundSettledAt) {
        order.refundSettledAt = new Date();
      }
      await order.save();

      // Update PaymentTransaction
      await PaymentTransaction.findOneAndUpdate(
        { providerTransactionId: refund.refundId, type: 'refund' },
        {
          providerStatus: refund.status,
          arn: refund.arn,
          expectedArrival: refund.expectedArrival,
          refundedAt: order.refundStatus === 'succeeded' ? new Date() : undefined,
          lastSyncedAt: new Date(),
        },
      );

      synced++;
      if (previousStatus !== order.refundStatus) {
        logger.info({
          refundId: refund.refundId,
          orderNumber: order.orderNumber,
          previousStatus,
          newStatus: order.refundStatus,
        }, 'Refund status changed during reconciliation');
      }
    } catch (err) {
      errors++;
      logger.error({ err, refundId: refund.refundId }, 'Error syncing refund');
    }
  }

  // Process retry queue
  const retryResult = await processFailedRefundRetries();

  logger.info({
    synced,
    errors,
    retried: retryResult.attempted,
    succeeded: retryResult.succeeded,
    failed: retryResult.failed,
  }, 'Refund reconciliation completed');

  return {
    synced,
    retried: retryResult.attempted,
    succeeded: retryResult.succeeded,
    failed: retryResult.failed,
    errors,
  };
}

/**
 * Schedule the next reconciliation run.
 * Uses recursive setTimeout so we can reschedule with updated config.
 */
async function scheduleNextRun(): Promise<void> {
  const hour = await getNumberSetting('commerce.refunds.reconciliationHour').catch(() => 2);
  const delayMs = calculateDelayMs(hour);

  logger.info({ hour, delayMs }, 'Next refund reconciliation scheduled');

  reconcileTimer = setTimeout(async () => {
    try {
      await runRefundReconciliation();
    } catch (err) {
      logger.error({ err }, 'Refund reconciliation job error');
    }
    await scheduleNextRun();
  }, delayMs);
}

/**
 * Start the refund reconciliation job.
 * Call once during server startup.
 */
export function startRefundReconciliationJob(): void {
  if (reconcileTimer) {
    logger.warn('Refund reconciliation job already started');
    return;
  }
  scheduleNextRun();
  logger.info('Refund reconciliation job started');
}

/**
 * Stop the refund reconciliation job.
 * Call during graceful shutdown.
 */
export function stopRefundReconciliationJob(): void {
  if (reconcileTimer) {
    clearTimeout(reconcileTimer);
    reconcileTimer = null;
    logger.info('Refund reconciliation job stopped');
  }
}

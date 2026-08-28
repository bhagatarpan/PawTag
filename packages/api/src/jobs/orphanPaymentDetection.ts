/**
 * @module Orphan Payment Detection Job
 * @description Background job that detects and recovers orphaned payments.
 *
 * Scenario: Customer pays via Stripe, but the order creation fails
 * (browser closed, network error, server crash). The customer is charged
 * but no PawTag order exists.
 *
 * This job runs every 60 seconds and:
 * 1. Finds PendingOrders with status 'pending' that are past their
 *    payment deadline (5 minutes old)
 * 2. Checks Stripe to see if payment actually succeeded
 * 3. If payment succeeded, creates the order via confirmCheckout()
 * 4. If payment failed, marks the PendingOrder as 'failed'
 * 5. If payment is still pending, leaves it alone
 *
 * This is the safety net that guarantees no paid order is silently lost.
 *
 * @example
 * ```typescript
 * import { startOrphanPaymentJob } from '../jobs/orphanPaymentDetection';
 * startOrphanPaymentJob();
 * ```
 */

import { PendingOrder } from '@pawtag/db';
import { stripePaymentProvider } from '../commerce/providers/stripe';
import { checkoutService } from '../commerce/services/checkout.service';
import { logCommerceEvent } from '../commerce/audit';
import logger from '../lib/logger';

/** How often to check for orphaned payments (ms) */
const CHECK_INTERVAL_MS = 60_000; // 60 seconds

/** How old a PendingOrder must be before we consider it orphaned (ms) */
const ORPHAN_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/** Maximum age for orphan detection (ms) — ignore orders older than 24 hours */
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check for orphaned payments and attempt recovery.
 */
async function checkForOrphanedPayments(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - ORPHAN_THRESHOLD_MS);
    const maxAge = new Date(Date.now() - MAX_AGE_MS);

    // Find PendingOrders that are pending and old enough to be orphaned
    const pendingOrders = await PendingOrder.find({
      status: 'pending',
      createdAt: { $gte: maxAge, $lte: cutoff },
      stripePaymentIntentId: { $exists: true, $ne: null },
    }).limit(50); // Process 50 at a time

    if (!pendingOrders.length) return;

    logger.info({ count: pendingOrders.length }, 'Checking for orphaned payments');

    for (const pending of pendingOrders) {
      try {
        // Check payment status with Stripe
        const payment = await stripePaymentProvider.retrievePaymentIntent(pending.stripePaymentIntentId);

        if (payment.status === 'succeeded') {
          // Payment succeeded — create the order
          logger.warn({
            pendingOrderId: pending._id,
            paymentIntentId: pending.stripePaymentIntentId,
            userId: pending.userId,
          }, 'Orphaned payment detected — creating order');

          await checkoutService.confirmCheckout(String(pending.userId), pending.stripePaymentIntentId);

          await logCommerceEvent({
            action: 'orphan_payment_recovered',
            resourceType: 'PendingOrder',
            resourceId: String(pending._id),
            severity: 'HIGH',
            metadata: {
              paymentIntentId: pending.stripePaymentIntentId,
              total: pending.total,
              recoveryMethod: 'orphan_detection_job',
            },
          });

          logger.info({ pendingOrderId: pending._id, total: pending.total }, 'Orphaned payment recovered');
        } else if (payment.status === 'failed' || payment.status === 'canceled') {
          // Payment failed — mark as failed
          pending.status = 'failed';
          await pending.save();
          logger.info({ pendingOrderId: pending._id, status: payment.status }, 'Pending order marked as failed');
        }
        // else: still processing, leave alone
      } catch (err) {
        logger.error({ err, pendingOrderId: pending._id }, 'Error checking orphaned payment');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error in orphan payment detection job');
  }
}

/**
 * Start the orphan payment detection job.
 * Runs every 60 seconds.
 */
export function startOrphanPaymentJob(): void {
  setInterval(async () => {
    try {
      await checkForOrphanedPayments();
    } catch (err) {
      logger.error({ err }, 'Orphan payment job error');
    }
  }, CHECK_INTERVAL_MS);

  logger.info('[OrphanPaymentJob] Started — checks every 60s for orphaned payments');
}

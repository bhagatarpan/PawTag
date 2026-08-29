/**
 * @module Payment Reconciliation Job
 * @description Background job that reconciles PawTag orders against Stripe.
 *
 * Periodically checks orders with Stripe payment intents and compares
 * the payment status between PawTag and Stripe. Detects discrepancies
 * and logs them for admin review.
 *
 * Runs every 5 minutes.
 *
 * @example
 * ```typescript
 * import { startPaymentReconciliationJob } from '../jobs/paymentReconciliation';
 * startPaymentReconciliationJob();
 * ```
 */

import { Order } from '@pawtag/db';
import { stripePaymentProvider } from '../commerce/providers/stripe';
import { getBooleanSetting } from '../commerce/config';
import logger from '../lib/logger';

/** How often to reconcile (ms) */
const RECONCILE_INTERVAL_MS = 5 * 60_000; // 5 minutes

let reconcileTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Reconcile PawTag orders against Stripe payment state.
 */
async function reconcilePayments(): Promise<void> {
  try {
    const enabled = await getBooleanSetting('commerce.feature.paymentReconciliation' as any).catch(() => true);
    if (!enabled) return;

    // Skip if Stripe is not configured (demo mode)
    if (!stripePaymentProvider.isConfigured()) return;

    // Find recent orders with Stripe payment intent IDs
    const orders = await Order.find({
      'payment.stripePaymentIntentId': { $exists: true, $ne: null },
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
    }).limit(100);

    let discrepancies = 0;

    for (const order of orders) {
      const piId = order.payment?.stripePaymentIntentId;
      if (!piId || piId.startsWith('pi_demo_')) continue;

      try {
        const stripeIntent = await stripePaymentProvider.retrievePaymentIntent(piId);

        // Map Stripe status to PawTag status
        const statusMap: Record<string, string> = {
          succeeded: 'completed',
          requires_capture: 'completed',
          failed: 'failed',
          canceled: 'cancelled',
          processing: 'pending',
        };
        const expectedStatus = statusMap[stripeIntent.status] || stripeIntent.status;

        // Check for status mismatch
        if (expectedStatus !== order.payment?.status) {
          discrepancies++;
          logger.warn({
            orderId: String(order._id),
            orderNumber: order.orderNumber,
            pawtagStatus: order.payment?.status,
            stripeStatus: stripeIntent.status,
            paymentIntentId: piId,
          }, 'Payment reconciliation: status mismatch detected');
        }

        // Check for amount mismatch
        const amountDiff = Math.abs((order.payment?.amount || 0) - stripeIntent.amount);
        if (amountDiff > 0.01) {
          discrepancies++;
          logger.warn({
            orderId: String(order._id),
            orderNumber: order.orderNumber,
            pawtagAmount: order.payment?.amount,
            stripeAmount: stripeIntent.amount,
            paymentIntentId: piId,
          }, 'Payment reconciliation: amount mismatch detected');
        }
      } catch {
        // Can't reach Stripe for this PI — skip silently
      }
    }

    if (discrepancies > 0) {
      logger.warn({
        ordersChecked: orders.length,
        discrepancies,
      }, 'Payment reconciliation found discrepancies — review required');
    }
  } catch (err) {
    logger.error({ err }, 'Payment reconciliation job error');
  }
}

/**
 * Start the payment reconciliation job.
 * Checks every 5 minutes for payment discrepancies.
 */
export function startPaymentReconciliationJob(): void {
  if (reconcileTimer) return;

  // Initial delay of 60 seconds
  setTimeout(() => {
    reconcilePayments();
    reconcileTimer = setInterval(reconcilePayments, RECONCILE_INTERVAL_MS);
    logger.info('Payment reconciliation job started (interval: 5 minutes)');
  }, 60_000);
}

/**
 * Stop the payment reconciliation job.
 */
export function stopPaymentReconciliationJob(): void {
  if (reconcileTimer) {
    clearInterval(reconcileTimer);
    reconcileTimer = null;
    logger.info('Payment reconciliation job stopped');
  }
}

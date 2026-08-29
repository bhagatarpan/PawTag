/**
 * @module Order Auto-Cancel Job
 * @description Background job that auto-cancels unpaid orders.
 *
 * When a PendingOrder expires, its stock reservation is released.
 * When an Order remains in 'pending_payment' status too long,
 * it is automatically cancelled and stock is released.
 *
 * Runs every 60 seconds.
 *
 * @example
 * ```typescript
 * import { startOrderAutoCancelJob } from '../jobs/orderAutoCancel';
 * startOrderAutoCancelJob();
 * ```
 */

import { Order } from '@pawtag/db';
import { inventoryService } from '../commerce/services/inventory.service';
import { getBooleanSetting, getNumberSetting } from '../commerce/config';
import { notifyCustomerOfStatusChange } from '../services/orderNotification.service';
import { logOrderEvent } from '../commerce/audit';
import logger from '../lib/logger';

/** How often to check for stale orders (ms) */
const CHECK_INTERVAL_MS = 60_000; // 60 seconds

/**
 * Check for orders that have been in 'pending_payment' too long and auto-cancel them.
 */
async function checkAndCancelStaleOrders(): Promise<void> {
  try {
    const enabled = await getBooleanSetting('commerce.feature.orphanPaymentDetection');
    if (!enabled) return;

    const autoCancelMinutes = await getNumberSetting('commerce.orders.autoCancelMinutes');
    const cutoff = new Date(Date.now() - autoCancelMinutes * 60 * 1000);

    // Find orders in pending_payment that are older than the threshold
    const staleOrders = await Order.find({
      status: 'pending_payment',
      createdAt: { $lt: cutoff },
    }).limit(50);

    if (!staleOrders.length) return;

    logger.info({ count: staleOrders.length, autoCancelMinutes }, 'Auto-cancelling stale orders');

    for (const order of staleOrders) {
      try {
        order.status = 'cancelled';
        order.cancellationReason = `Auto-cancelled: no payment received within ${autoCancelMinutes} minutes`;
        await order.save();

        // Release reserved stock
        await inventoryService.releaseForOrder(String(order._id), order.items.map((item: any) => ({
          productId: String(item.productId),
          quantity: item.quantity,
        })));

        // Notify customer
        await notifyCustomerOfStatusChange(order, 'cancelled', {
          reason: order.cancellationReason,
        }).catch(() => {});

        // Audit log
        await logOrderEvent('cancelled', {
          orderId: String(order._id),
          orderNumber: order.orderNumber,
          amount: order.payment.amount,
          reason: order.cancellationReason,
        }).catch(() => {});

        logger.info({ orderNumber: order.orderNumber }, 'Order auto-cancelled');
      } catch (err) {
        logger.error({ err, orderNumber: order.orderNumber }, 'Failed to auto-cancel order');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Order auto-cancel job error');
  }
}

/**
 * Start the order auto-cancel job.
 * Runs every 60 seconds.
 */
export function startOrderAutoCancelJob(): void {
  setInterval(async () => {
    try {
      await checkAndCancelStaleOrders();
    } catch (err) {
      logger.error({ err }, 'Order auto-cancel job error');
    }
  }, CHECK_INTERVAL_MS);

  logger.info('[OrderAutoCancelJob] Started — checks every 60s for stale pending_payment orders');
}

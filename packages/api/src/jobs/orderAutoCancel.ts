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
import { formatSystemActivityMessage } from '../lib/actor';
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
        const cancelledAt = new Date();
        const reason = `Auto-cancelled: no payment received within ${autoCancelMinutes} minutes`;
        const systemMessage = formatSystemActivityMessage(reason, cancelledAt);

        order.status = 'cancelled';
        order.cancellationReason = reason;
        order.cancelledBy = 'CANCELLED BY SYSTEM (AUTO)';
        order.cancelledByType = 'System';
        order.cancelledByPortal = 'system';
        order.cancelledByDescription = `Order is auto-cancelled by System after no payment received within ${autoCancelMinutes} minutes`;
        order.cancelledAt = cancelledAt;
        await order.save();

        // Release reserved stock
        try {
          await inventoryService.releaseForOrder(String(order._id), order.items.map((item: any) => ({
            productId: String(item.productId),
            quantity: item.quantity,
          })));
        } catch (stockErr) {
          logger.error({ err: stockErr, orderId: String(order._id) }, 'Failed to release stock on auto-cancel');
        }

        // Record activity on order timeline
        await Order.updateOne(
          { _id: order._id },
          {
            $push: {
              activity: {
                type: 'cancelled',
                message: systemMessage,
                timestamp: cancelledAt,
                actor: 'system',
                metadata: {
                  reason,
                  cancelledBy: 'CANCELLED BY SYSTEM (AUTO)',
                  cancelledByType: 'System',
                  cancelledByPortal: 'system',
                  cancelledAt: cancelledAt.toISOString(),
                },
              },
            },
          },
        );

        // Notify customer
        await notifyCustomerOfStatusChange(order, 'cancelled', {
          reason,
        }).catch(() => {});

        // Audit log
        await logOrderEvent('cancelled', {
          orderId: String(order._id),
          orderNumber: order.orderNumber,
          amount: order.payment.amount,
          reason,
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

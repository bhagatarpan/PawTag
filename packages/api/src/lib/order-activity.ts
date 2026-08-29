/**
 * @module Order Activity
 * @description Shared utility for recording activity entries on order timelines.
 *
 * Every order state change (placed, paid, shipped, refunded, etc.) is recorded
 * as an activity entry for audit trail and customer visibility.
 *
 * Usage:
 * ```typescript
 * import { recordOrderActivity } from '../lib/order-activity';
 * await recordOrderActivity(orderId, 'order_placed', 'Order placed', 'customer');
 * ```
 */

import { Order } from '@pawtag/db';
import logger from './logger';

/**
 * Record an activity entry on an order's activity timeline.
 *
 * @param orderId - Order ID
 * @param type - Activity type (e.g., 'order_placed', 'shipped', 'refunded')
 * @param message - Human-readable description
 * @param actor - Who performed the action ('system', 'admin', 'customer')
 * @param metadata - Additional context
 */
export async function recordOrderActivity(
  orderId: any,
  type: string,
  message: string,
  actor: 'system' | 'admin' | 'customer' = 'system',
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await Order.findByIdAndUpdate(orderId, {
      $push: {
        activity: {
          type,
          message,
          timestamp: new Date(),
          actor,
          metadata,
        },
      },
    });
  } catch (err) {
    logger.error({ err, orderId, type }, 'Failed to record order activity');
  }
}

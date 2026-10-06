/**
 * @module PendingOrder Expiry Job
 * @description Releases stock and PawRewards for abandoned checkouts before
 * MongoDB TTL can silently delete PendingOrder documents.
 *
 * Mongo TTL alone is not enough: TTL removes the document asynchronously
 * without running compensation. This job marks expired pending orders and
 * releases reservations first.
 */

import { PendingOrder } from '@pawtag/db';
import { inventoryService } from '../commerce/services/inventory.service';
import logger from '../lib/logger';
import { createClaimedJob, generateWorkerId } from '../lib/job-claim';

const CHECK_INTERVAL_MS = 60_000;
const workerId = generateWorkerId();

const claimedExpirePendingOrders = createClaimedJob(
  'pending-order-expiry',
  workerId,
  async () => {
    try {
      const now = new Date();
      const expired = await PendingOrder.find({
        status: 'pending',
        expiresAt: { $lte: now },
      }).limit(50);

      if (!expired.length) return;

      logger.info({ count: expired.length }, 'Expiring abandoned pending checkouts');

      for (const pending of expired) {
        try {
          // Claim atomically so concurrent workers do not double-release
          const claimed = await PendingOrder.findOneAndUpdate(
            { _id: pending._id, status: 'pending' },
            { $set: { status: 'expired' } },
            { new: true },
          );
          if (!claimed) continue;

          // Release inventory reservations
          try {
            await inventoryService.releaseForOrder(
              String(claimed._id),
              claimed.items.map((item) => ({
                productId: String(item.productId),
                quantity: item.quantity,
              })),
            );
          } catch (stockErr) {
            logger.error({ err: stockErr, pendingOrderId: String(claimed._id) }, 'Failed to release stock for expired pending order');
          }

          // Release PawRewards hold
          if (claimed.pawRewardsReserved && claimed.pawRewardsRedemption && claimed.pawRewardsRedemption > 0) {
            try {
              const { releaseRewardsReservation } = await import('../services/loyalty/pawrewards.service');
              await releaseRewardsReservation(
                String(claimed.userId),
                claimed.pawRewardsRedemption,
                String(claimed._id),
                String(claimed._id),
              );
            } catch (rewardErr) {
              logger.error({ err: rewardErr, pendingOrderId: String(claimed._id) }, 'Failed to release PawRewards for expired pending order');
            }
          }

          logger.info(
            {
              pendingOrderId: String(claimed._id),
              userId: String(claimed.userId),
              itemCount: claimed.items.length,
              rewards: claimed.pawRewardsRedemption || 0,
            },
            'Pending checkout expired — reservations released',
          );
        } catch (err) {
          logger.error({ err, pendingOrderId: String(pending._id) }, 'Failed to expire pending order');
        }
      }
    } catch (err) {
      logger.error({ err }, 'PendingOrder expiry job error');
    }
  },
);

/**
 * Run the pending-order expiry job. Called by the job scheduler.
 */
export async function runPendingOrderExpiryJob(): Promise<{ success: boolean; error?: string }> {
    try {
      await claimedExpirePendingOrders();
      return { success: true };
    } catch (error: any) {
      logger.error({ err: error }, '[PendingOrderExpiryJob] Job error');
      return { success: false, error: error.message || 'Unknown error' };
    }
}

export function startPendingOrderExpiryJob(): void {
  setInterval(() => {
    claimedExpirePendingOrders().catch((err) => logger.error({ err }, 'PendingOrder expiry tick error'));
  }, CHECK_INTERVAL_MS);
  logger.info('[PendingOrderExpiryJob] Started — checks every 60s for expired pending checkouts');
}

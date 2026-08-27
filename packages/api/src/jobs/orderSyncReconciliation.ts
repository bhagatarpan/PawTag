/**
 * Order Sync Reconciliation Job
 *
 * Runs every 60 seconds (configurable via DB settings) to detect and correct
 * data drift between PawTag and Medusa. This is the safety net for:
 * - Failed webhooks that were marked dead in the retry queue
 * - Admin actions in PawTag that failed to sync to Medusa
 * - Admin actions in Medusa that PawTag didn't receive
 *
 * Only processes orders that haven't been updated in the last 5 minutes
 * to avoid interfering with in-flight webhooks.
 */

import { Order, type OrderStatus } from '@pawtag/db';
import logger from '../lib/logger';
import { auditService } from '../services/audit';
import { getCachedSetting } from '../lib/rate-limiter';

const TERMINAL_STATUSES = ['cancelled', 'refunded'];
const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_SKIP_RECENT_MINUTES = 5;

let reconciliationTimer: ReturnType<typeof setInterval> | null = null;

async function reconcileOrders(): Promise<void> {
  try {
    const enabled = await getCachedSetting('sync.reconciliation.enabled', 'true');
    if (enabled !== 'true') return;

    const intervalSec = parseInt(await getCachedSetting('sync.reconciliation.intervalSeconds', '60'), 10);
    const skipMinutes = parseInt(await getCachedSetting('sync.reconciliation.skipRecentMinutes', '5'), 10);

    const MEDUSA_URL = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';
    const MEDUSA_ADMIN_TOKEN = process.env.MEDUSA_ADMIN_TOKEN || '';
    if (!MEDUSA_ADMIN_TOKEN) return;

    // Find PawTag orders that are not in terminal states and haven't been updated recently
    const cutoff = new Date(Date.now() - skipMinutes * 60 * 1000);
    const orders = await Order.find({
      status: { $nin: TERMINAL_STATUSES },
      medusaOrderId: { $exists: true, $ne: null },
      updatedAt: { $lt: cutoff },
    }).limit(50);

    if (orders.length === 0) return;

    logger.info({ count: orders.length }, 'Reconciliation: checking orders for drift');

    let driftCorrected = 0;
    let driftDetected = 0;

    for (const order of orders) {
      try {
        // Fetch corresponding Medusa order
        const response = await fetch(`${MEDUSA_URL}/admin/orders/${order.medusaOrderId}`, {
          headers: {
            'Authorization': `Bearer ${MEDUSA_ADMIN_TOKEN}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
          // Medusa order not found — could be deleted or not synced yet
          if (response.status === 404) {
            logger.debug({ orderNumber: order.orderNumber, medusaOrderId: order.medusaOrderId }, 'Reconciliation: Medusa order not found');
          }
          continue;
        }

        const { order: medusaOrder } = await response.json() as any;
        if (!medusaOrder) continue;

        // Map Medusa status to PawTag status
        const medusaStatus = mapMedusaStatus(medusaOrder.status);
        const hasDrift = medusaStatus && medusaStatus !== order.status;

        if (hasDrift) {
          driftDetected++;
          logger.warn(
            {
              orderNumber: order.orderNumber,
              pawtagStatus: order.status,
              medusaStatus: medusaOrder.status,
              mappedStatus: medusaStatus,
            },
            'Reconciliation: drift detected',
          );

          // Update PawTag order
          const previousStatus = order.status;
          order.status = medusaStatus as OrderStatus;
          await order.save();

          // Audit the reconciliation correction
          await auditService.log({
            actorType: 'SYSTEM',
            actorId: 'reconciliation-job',
            actorUsername: 'reconciliation-job',
            sourceIp: 'system',
            userAgent: 'reconciliation-job',
            applicationName: 'pawtag-api',
            applicationVersion: '1.0.0',
            apiVersion: 'v1',
            environment: process.env.NODE_ENV || 'development',
          }, {
            action: 'reconciliation_status_corrected',
            eventType: 'SYSTEM',
            eventCategory: 'SYSTEM',
            operationType: 'UPDATE',
            resourceType: 'Order',
            resourceId: order._id.toString(),
            outcome: 'SUCCESS',
            severity: 'MEDIUM',
            changedFields: [{ field: 'status', before: previousStatus, after: medusaStatus!, sensitive: false }],
            metadata: { orderNumber: order.orderNumber, medusaOrderId: order.medusaOrderId, source: 'reconciliation' },
          });

          // Notify customer of the status change
          try {
            const { notifyCustomerOfStatusChange } = await import('../services/orderNotification.service');
            await notifyCustomerOfStatusChange(order, medusaStatus!, {
              reason: 'Status synced from Medusa',
            });
          } catch (err) {
            logger.error({ err, orderNumber: order.orderNumber }, 'Reconciliation: failed to notify customer');
          }

          driftCorrected++;
        }

        // Check tracking number drift
        const medusaTracking = extractTrackingFromMedusa(medusaOrder);
        if (medusaTracking && medusaTracking.trackingNumber && !order.trackingNumber) {
          order.trackingNumber = medusaTracking.trackingNumber;
          if (medusaTracking.carrier) order.carrier = medusaTracking.carrier;
          await order.save();
          logger.info({ orderNumber: order.orderNumber }, 'Reconciliation: tracking number corrected');
        }
      } catch (err) {
        logger.error({ err, orderNumber: order.orderNumber }, 'Reconciliation: error checking order');
      }
    }

    if (driftDetected > 0) {
      logger.info({ driftDetected, driftCorrected }, 'Reconciliation: drift corrected');
    }
  } catch (err) {
    logger.error({ err }, 'Reconciliation job error');
  }
}

/**
 * Map Medusa order status to PawTag order status.
 * Returns null if no mapping exists (status unknown or not relevant).
 */
function mapMedusaStatus(medusaStatus: string): string | null {
  const statusMap: Record<string, string> = {
    pending: 'pending',
    draft: 'pending',
    awaiting: 'pending_payment',
    regional: 'paid',
    paid: 'paid',
    partially_fulfilled: 'packing',
    fulfilled: 'packing',
    shipped: 'shipped',
    delivered: 'delivered',
    canceled: 'cancelled',
    cancelled: 'cancelled',
    refunded: 'refunded',
    archived: 'cancelled',
  };
  return statusMap[medusaStatus?.toLowerCase()] || null;
}

/**
 * Extract tracking info from a Medusa order's fulfillments.
 */
function extractTrackingFromMedusa(medusaOrder: any): { trackingNumber?: string; carrier?: string } | null {
  const fulfillments = medusaOrder.fulfillments || [];
  for (const f of fulfillments) {
    const labels = f.labels || [];
    if (labels.length > 0 && labels[0].tracking_number) {
      return {
        trackingNumber: labels[0].tracking_number,
        carrier: f.provider_id || f.shipping_option?.provider_id,
      };
    }
  }
  return null;
}

export function startReconciliationJob(): void {
  if (reconciliationTimer) return;
  if (process.env.NODE_ENV === 'test') return;

  // Use a short initial delay to avoid startup contention
  setTimeout(() => {
    reconcileOrders().catch(() => {});
    reconciliationTimer = setInterval(reconcileOrders, DEFAULT_INTERVAL_MS);
    logger.info('Order reconciliation job started (every 60s)');
  }, 10_000);
}

export function stopReconciliationJob(): void {
  if (reconciliationTimer) {
    clearInterval(reconciliationTimer);
    reconciliationTimer = null;
    logger.info('Order reconciliation job stopped');
  }
}

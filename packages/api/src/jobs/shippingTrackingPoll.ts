/**
 * @module Shipping Tracking Poll Job
 * @description Background job that polls carriers for shipment tracking updates.
 *
 * Periodically checks all active shipments (label_created, picked_up, in_transit,
 * out_for_delivery, delayed) and fetches the latest tracking events from the
 * carrier API. Updates shipment status and triggers notifications when delivered.
 *
 * Runs every 5 minutes.
 *
 * @example
 * ```typescript
 * import { startTrackingPollJob } from '../jobs/shippingTrackingPoll';
 * startTrackingPollJob();
 * ```
 */

import { shipmentService } from '../commerce/services/shipment.service';
import { getBooleanSetting } from '../commerce/config';
import logger from '../lib/logger';

/** How often to poll for tracking updates (ms) */
const POLL_INTERVAL_MS = 5 * 60_000; // 5 minutes

let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Poll all active shipments for tracking updates.
 */
async function pollTrackingUpdates(): Promise<void> {
  try {
    const enabled = await getBooleanSetting('commerce.feature.trackingPollEnabled' as any).catch(() => true);
    if (!enabled) return;

    const result = await shipmentService.pollTrackingUpdates();

    if (result.updated > 0 || result.errors > 0) {
      logger.info({
        updated: result.updated,
        errors: result.errors,
      }, 'Shipping tracking poll completed');
    }
  } catch (err) {
    logger.error({ err }, 'Shipping tracking poll failed');
  }
}

/**
 * Start the tracking poll job.
 * Polls every 5 minutes for shipment tracking updates.
 */
export function startTrackingPollJob(): void {
  if (pollTimer) return;

  // Initial delay of 30 seconds to let the server start up
  setTimeout(() => {
    pollTrackingUpdates();
    pollTimer = setInterval(pollTrackingUpdates, POLL_INTERVAL_MS);
    logger.info('Shipping tracking poll job started (interval: 5 minutes)');
  }, 30_000);
}

/**
 * Stop the tracking poll job.
 */
export function stopTrackingPollJob(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    logger.info('Shipping tracking poll job stopped');
  }
}

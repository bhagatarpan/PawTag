/**
 * @module Webhook Retry Job
 * @description Background job that retries failed webhook events.
 *
 * Processes webhook events that failed with exponential backoff.
 * Events that exceed maxAttempts are marked as 'dead' for manual review.
 *
 * Runs every 60 seconds.
 *
 * @example
 * ```typescript
 * import { startWebhookRetryJob } from '../jobs/webhookRetry';
 * startWebhookRetryJob();
 * ```
 */

import { WebhookEvent } from '@pawtag/db';
import logger from '../lib/logger';
import { createClaimedJob, generateWorkerId } from '../lib/job-claim';

/** How often to check for retryable events (ms) */
const RETRY_INTERVAL_MS = 60_000; // 60 seconds

let retryTimer: ReturnType<typeof setInterval> | null = null;
const workerId = generateWorkerId();

/**
 * Retry failed webhook events that are due for retry.
 * Wrapped with claiming to prevent duplicate execution across workers.
 */
const claimedRetryFailedEvents = createClaimedJob(
  'webhook-retry',
  workerId,
  async () => {
  try {
    // Find events that are due for retry
    const retryableEvents = await WebhookEvent.find({
      status: { $in: ['pending', 'failed'] },
      nextRetryAt: { $lte: new Date() },
    }).limit(50);

    if (!retryableEvents.length) return;

    logger.info({ count: retryableEvents.length }, 'Retrying failed webhook events');

    for (const event of retryableEvents) {
      try {
        event.status = 'processing';
        event.attempts += 1;
        await event.save();

        // Re-process the event (Stripe-specific for now)
        if (event.source === 'stripe') {
          await processStripeEvent(event.event, event.payload);
        }

        // Mark as completed
        event.status = 'completed';
        event.processedAt = new Date();
        await event.save();

        logger.info({
          eventId: event.eventId,
          event: event.event,
          attempt: event.attempts,
        }, 'Webhook event retried successfully');
      } catch (err: any) {
        event.lastError = err.message || 'Unknown error';

        if (event.attempts >= event.maxAttempts) {
          event.status = 'dead';
          logger.error({
            eventId: event.eventId,
            event: event.event,
            attempts: event.attempts,
            error: err.message,
          }, 'Webhook event marked as dead — max retries exceeded');
        } else {
          event.status = 'failed';
          // Exponential backoff: 30s, 1m, 2m, 5m, 15m
          const backoffMs = [30_000, 60_000, 120_000, 300_000, 900_000][event.attempts - 1] || 900_000;
          event.nextRetryAt = new Date(Date.now() + backoffMs);
        }

        await event.save();

        logger.warn({
          eventId: event.eventId,
          event: event.event,
          attempt: event.attempts,
          maxAttempts: event.maxAttempts,
          error: err.message,
        }, 'Webhook event retry failed');
      }
    }
  } catch (err) {
    logger.error({ err }, 'Webhook retry job error');
  }
});

/**
 * Process a Stripe webhook event (re-process from stored payload).
 */
async function processStripeEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
  // Dynamic import to avoid circular dependencies
  const { handleStripeWebhookEvent } = await import('../routes/stripe-webhooks');
  await handleStripeWebhookEvent(eventType, payload);
}

/**
 * Start the webhook retry job.
 * Checks every 60 seconds for retryable events.
 */
export function startWebhookRetryJob(): void {
  if (retryTimer) return;

  // Initial delay of 10 seconds
  setTimeout(() => {
    claimedRetryFailedEvents();
    retryTimer = setInterval(claimedRetryFailedEvents, RETRY_INTERVAL_MS);
    logger.info('Webhook retry job started (interval: 60 seconds)');
  }, 10_000);
}

/**
 * Stop the webhook retry job.
 */
export function stopWebhookRetryJob(): void {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
    logger.info('Webhook retry job stopped');
  }
}

/**
 * Run the webhook retry job. Called by the job scheduler.
 */
export async function runWebhookRetryJob(): Promise<import('../services/job-scheduler.service').JobResult> {
  try {
    await claimedRetryFailedEvents();
    return { success: true };
  } catch (error: any) {
    logger.error({ err: error }, '[WebhookRetryJob] Job error');
    return { success: false, error: error.message || 'Unknown error' };
  }
}

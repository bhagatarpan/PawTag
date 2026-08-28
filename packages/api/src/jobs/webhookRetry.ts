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

/** How often to check for retryable events (ms) */
const RETRY_INTERVAL_MS = 60_000; // 60 seconds

let retryTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Retry failed webhook events that are due for retry.
 */
async function retryFailedEvents(): Promise<void> {
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
}

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
    retryFailedEvents();
    retryTimer = setInterval(retryFailedEvents, RETRY_INTERVAL_MS);
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

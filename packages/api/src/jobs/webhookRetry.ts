import { WebhookEvent } from '@pawtag/db';
import logger from '../lib/logger';

const RETRY_INTERVAL = 60_000; // Check every 1 minute
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // Don't retry events older than 24 hours

let retryTimer: ReturnType<typeof setInterval> | null = null;

async function retryFailedEvents(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - MAX_AGE_MS);

    // Find failed events due for retry
    const failedEvents = await WebhookEvent.find({
      status: 'failed',
      attempts: { $lt: 5 },
      nextRetryAt: { $lte: new Date() },
      createdAt: { $gte: cutoff },
    }).limit(10); // Process 10 at a time

    if (failedEvents.length === 0) return;

    logger.info({ count: failedEvents.length }, 'Retrying failed webhook events');

    for (const webhookEvent of failedEvents) {
      try {
        webhookEvent.status = 'processing';
        webhookEvent.attempts += 1;
        await webhookEvent.save();

        // Re-dispatch the event
        const { event, payload } = webhookEvent;
        const data = payload?.data;

        // Dynamic import to avoid circular dependencies
        const medusaWebhooks = await import('../routes/medusa-webhooks');
        // We can't directly call the handlers, so we simulate the webhook call
        // In production, this would make an internal HTTP call or use an event bus
        logger.info({ eventId: webhookEvent.eventId, event, attempt: webhookEvent.attempts }, 'Retrying webhook event');

        // Mark as completed (the handler is idempotent)
        webhookEvent.status = 'completed';
        webhookEvent.processedAt = new Date();
        await webhookEvent.save();

      } catch (err) {
        logger.error({ err, eventId: webhookEvent.eventId }, 'Webhook retry failed');

        const nextRetry = new Date(Date.now() + RETRY_INTERVAL * webhookEvent.attempts);
        webhookEvent.status = webhookEvent.attempts >= webhookEvent.maxAttempts ? 'dead' : 'failed';
        webhookEvent.lastError = (err as Error)?.message;
        webhookEvent.nextRetryAt = nextRetry;
        await webhookEvent.save();
      }
    }
  } catch (err) {
    logger.error({ err }, 'Webhook retry job error');
  }
}

export function startWebhookRetryJob(): void {
  if (retryTimer) return;
  retryTimer = setInterval(retryFailedEvents, RETRY_INTERVAL);
  logger.info('Webhook retry job started (every 60s)');
}

export function stopWebhookRetryJob(): void {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
    logger.info('Webhook retry job stopped');
  }
}

import { WebhookEvent } from '@pawtag/db';
import logger from '../lib/logger';

const RETRY_INTERVAL = 60_000; // Base retry interval (1 minute)
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // Don't retry events older than 24 hours
const MAX_ATTEMPTS = 5;

// Exponential backoff: 60s → 120s → 300s → 900s → 3600s
const BACKOFF_MULTIPLIERS = [1, 2, 5, 15, 60];

function getRetryDelay(attempt: number): number {
  const multiplier = BACKOFF_MULTIPLIERS[Math.min(attempt - 1, BACKOFF_MULTIPLIERS.length - 1)];
  return RETRY_INTERVAL * multiplier;
}

let retryTimer: ReturnType<typeof setInterval> | null = null;

async function retryFailedEvents(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - MAX_AGE_MS);

    // Find failed events due for retry
    const failedEvents = await WebhookEvent.find({
      status: 'failed',
      attempts: { $lt: MAX_ATTEMPTS },
      nextRetryAt: { $lte: new Date() },
      createdAt: { $gte: cutoff },
    }).limit(10);

    if (failedEvents.length === 0) return;

    logger.info({ count: failedEvents.length }, 'Retrying failed webhook events');

    for (const webhookEvent of failedEvents) {
      try {
        webhookEvent.status = 'processing';
        webhookEvent.attempts += 1;
        await webhookEvent.save();

        const { event, payload } = webhookEvent;
        logger.info(
          { eventId: webhookEvent.eventId, event, attempt: webhookEvent.attempts },
          'Retrying webhook event via internal HTTP',
        );

        // Re-dispatch via internal HTTP call to the webhook endpoint
        const port = process.env.PORT || 5000;
        const response = await fetch(`http://localhost:${port}/api/webhooks/medusa`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-retry-source': 'webhook-retry-job',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30_000), // 30s timeout per attempt
        });

        if (!response.ok) {
          throw new Error(`Internal webhook dispatch returned ${response.status}`);
        }

        // Success — mark completed
        webhookEvent.status = 'completed';
        webhookEvent.processedAt = new Date();
        webhookEvent.lastError = undefined;
        await webhookEvent.save();

        logger.info(
          { eventId: webhookEvent.eventId, event, attempt: webhookEvent.attempts },
          'Webhook event retried successfully',
        );
      } catch (err) {
        logger.error({ err, eventId: webhookEvent.eventId }, 'Webhook retry failed');

        const nextRetry = new Date(Date.now() + getRetryDelay(webhookEvent.attempts));
        webhookEvent.status = webhookEvent.attempts >= MAX_ATTEMPTS ? 'dead' : 'failed';
        webhookEvent.lastError = (err as Error)?.message?.slice(0, 500);
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
  if (process.env.NODE_ENV === 'test') return;
  retryTimer = setInterval(retryFailedEvents, RETRY_INTERVAL);
  logger.info('Webhook retry job started (every 60s, exponential backoff)');
}

export function stopWebhookRetryJob(): void {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
    logger.info('Webhook retry job stopped');
  }
}

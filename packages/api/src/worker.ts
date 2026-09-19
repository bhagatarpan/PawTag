/**
 * @module Worker Entry Point
 * @description Dedicated worker process for PawTag background jobs.
 *
 * This worker runs all scheduled background jobs separately from the API process.
 * In production, the API process should NOT start jobs — only this worker should.
 *
 * Usage:
 *   PAWTAG_WORKER_ROLE=worker node packages/api/dist/worker.js
 *
 * Environment variables:
 *   - PAWTAG_WORKER_ROLE: Set to 'worker' to enable job startup
 *   - All standard API env vars (DB_URL, JWT_SECRET, etc.)
 *
 * Architecture:
 *   Web / Finder / Admin / Mobile
 *               |
 *               v
 *          API process(es)  ← no jobs
 *               |
 *               v
 *             MongoDB
 *               ^
 *               |
 *      ONE dedicated worker  ← this file
 *               |
 *    Stripe / Email / SMS / Shipping
 */

import dotenv from 'dotenv';
dotenv.config();

// Set worker role before any other imports
process.env.PAWTAG_WORKER_ROLE = 'worker';

import { connectDatabase } from '@pawtag/db';
import { config } from './config';
import logger from './lib/logger';
import { generateWorkerId } from './lib/job-claim';

// Import all job starters
import { startReminderService, stopReminderService } from './services/reminder.service';
import { startSubscriptionService, stopSubscriptionService } from './services/subscription.service';
import { startEscalationService, stopEscalationService } from './services/escalation.service';
import { startLowStockService, stopLowStockService } from './jobs/lowStockCheck';
import { startPetMilestonesJob, stopPetMilestonesJob } from './jobs/pet-milestones';

const workerId = generateWorkerId();
let isShuttingDown = false;

// Track all stop functions for graceful shutdown
const stopFunctions: Array<() => void> = [];

async function startWorker(): Promise<void> {
  try {
    logger.info({ workerId }, '[Worker] Starting PawTag worker process...');

    // Connect to database
    await connectDatabase(config.dbUrl);
    logger.info('[Worker] Database connected');

    // Start all background jobs
    logger.info('[Worker] Starting background jobs...');

    startReminderService();
    stopFunctions.push(stopReminderService);
    logger.info('[Worker] Reminder service started');

    startSubscriptionService();
    stopFunctions.push(stopSubscriptionService);
    logger.info('[Worker] Subscription service started');

    startEscalationService();
    stopFunctions.push(stopEscalationService);
    logger.info('[Worker] Escalation service started');

    startLowStockService();
    stopFunctions.push(stopLowStockService);
    logger.info('[Worker] Low stock service started');

    startPetMilestonesJob();
    stopFunctions.push(stopPetMilestonesJob);
    logger.info('[Worker] Pet milestones job started');

    // Dynamic imports for jobs that use them
    const { startPawRewardsJob, stopPawRewardsJob } = await import('./jobs/pawrewards');
    startPawRewardsJob();
    stopFunctions.push(stopPawRewardsJob);
    logger.info('[Worker] PawRewards job started');

    const { startOrphanPaymentJob, stopOrphanPaymentJob } = await import('./jobs/orphanPaymentDetection');
    startOrphanPaymentJob();
    stopFunctions.push(stopOrphanPaymentJob);
    logger.info('[Worker] Orphan payment detection job started');

    const { startOrderAutoCancelJob, stopOrderAutoCancelJob } = await import('./jobs/orderAutoCancel');
    startOrderAutoCancelJob();
    stopFunctions.push(stopOrderAutoCancelJob);
    logger.info('[Worker] Order auto-cancel job started');

    const { startTrackingPollJob, stopTrackingPollJob } = await import('./jobs/shippingTrackingPoll');
    startTrackingPollJob();
    stopFunctions.push(stopTrackingPollJob);
    logger.info('[Worker] Shipping tracking poll job started');

    const { startWebhookRetryJob, stopWebhookRetryJob } = await import('./jobs/webhookRetry');
    startWebhookRetryJob();
    stopFunctions.push(stopWebhookRetryJob);
    logger.info('[Worker] Webhook retry job started');

    const { startPaymentReconciliationJob, stopPaymentReconciliationJob } = await import('./jobs/paymentReconciliation');
    startPaymentReconciliationJob();
    stopFunctions.push(stopPaymentReconciliationJob);
    logger.info('[Worker] Payment reconciliation job started');

    const { startRefundReconciliationJob, stopRefundReconciliationJob } = await import('./jobs/refundReconciliation');
    startRefundReconciliationJob();
    stopFunctions.push(stopRefundReconciliationJob);
    logger.info('[Worker] Refund reconciliation job started');

    logger.info('[Worker] All background jobs started successfully');
    logger.info({ workerId }, '[Worker] Worker process is running');
  } catch (error) {
    logger.fatal({ err: error }, '[Worker] Failed to start worker process');
    process.exit(1);
  }
}

/**
 * Graceful shutdown: stop all jobs, wait for in-flight work, then exit.
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal, workerId }, '[Worker] Shutdown signal received, draining jobs...');

  // Stop all job timers (prevents new iterations from starting)
  for (const stopFn of stopFunctions) {
    try {
      stopFn();
    } catch (err) {
      logger.error({ err }, '[Worker] Error stopping job');
    }
  }

  logger.info('[Worker] All job timers stopped, waiting for in-flight work...');

  // Give in-flight iterations up to 30 seconds to complete
  const shutdownTimeout = setTimeout(() => {
    logger.warn('[Worker] Shutdown timeout reached, forcing exit');
    process.exit(1);
  }, 30_000);

  // Wait a moment for any async work to settle
  await new Promise(resolve => setTimeout(resolve, 2_000));

  clearTimeout(shutdownTimeout);
  logger.info('[Worker] Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startWorker();

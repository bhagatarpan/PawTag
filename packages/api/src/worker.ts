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

// Import all job starters
import { startReminderService } from './services/reminder.service';
import { startSubscriptionService } from './services/subscription.service';
import { startEscalationService } from './services/escalation.service';
import { startLowStockService } from './jobs/lowStockCheck';
import { startPetMilestonesJob } from './jobs/pet-milestones';

async function startWorker(): Promise<void> {
  try {
    logger.info('[Worker] Starting PawTag worker process...');

    // Connect to database
    await connectDatabase(config.dbUrl);
    logger.info('[Worker] Database connected');

    // Start all background jobs
    logger.info('[Worker] Starting background jobs...');

    startReminderService();
    logger.info('[Worker] Reminder service started');

    startSubscriptionService();
    logger.info('[Worker] Subscription service started');

    startEscalationService();
    logger.info('[Worker] Escalation service started');

    startLowStockService();
    logger.info('[Worker] Low stock service started');

    startPetMilestonesJob();
    logger.info('[Worker] Pet milestones job started');

    // Dynamic imports for jobs that use them
    const { startPawRewardsJob } = await import('./jobs/pawrewards');
    startPawRewardsJob();
    logger.info('[Worker] PawRewards job started');

    const { startOrphanPaymentJob } = await import('./jobs/orphanPaymentDetection');
    startOrphanPaymentJob();
    logger.info('[Worker] Orphan payment detection job started');

    const { startOrderAutoCancelJob } = await import('./jobs/orderAutoCancel');
    startOrderAutoCancelJob();
    logger.info('[Worker] Order auto-cancel job started');

    const { startTrackingPollJob } = await import('./jobs/shippingTrackingPoll');
    startTrackingPollJob();
    logger.info('[Worker] Shipping tracking poll job started');

    const { startWebhookRetryJob } = await import('./jobs/webhookRetry');
    startWebhookRetryJob();
    logger.info('[Worker] Webhook retry job started');

    const { startPaymentReconciliationJob } = await import('./jobs/paymentReconciliation');
    startPaymentReconciliationJob();
    logger.info('[Worker] Payment reconciliation job started');

    const { startRefundReconciliationJob } = await import('./jobs/refundReconciliation');
    startRefundReconciliationJob();
    logger.info('[Worker] Refund reconciliation job started');

    logger.info('[Worker] All background jobs started successfully');
    logger.info('[Worker] Worker process is running');
  } catch (error) {
    logger.fatal({ err: error }, '[Worker] Failed to start worker process');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('[Worker] SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('[Worker] SIGINT received, shutting down...');
  process.exit(0);
});

startWorker();

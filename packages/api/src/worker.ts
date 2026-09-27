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

// Import job scheduler
import {
  start as startScheduler,
  stop as stopScheduler,
  registerJobFunction,
} from './services/job-scheduler.service';

// Import job functions
import { runReminderJob } from './services/reminder.service';
import { runSubscriptionJob } from './services/subscription.service';
import { runEscalationJob } from './services/escalation.service';
import { runLowStockJob } from './jobs/lowStockCheck';
import { runPetMilestonesJob } from './jobs/pet-milestones';
import { runPawRewardsJob } from './jobs/pawrewards';
import { runOrphanPaymentJob } from './jobs/orphanPaymentDetection';
import { runOrderAutoCancelJob } from './jobs/orderAutoCancel';
import { runShippingTrackingJob } from './jobs/shippingTrackingPoll';
import { runWebhookRetryJob } from './jobs/webhookRetry';
import { runPaymentReconciliationJob } from './jobs/paymentReconciliation';
import { runRefundReconciliationJob } from './jobs/refundReconciliation';
import { runPrivacyRetentionJob } from './jobs/privacyRetention';
import { runAuditRetentionJob } from './jobs/auditRetention';
import { checkExpiredMemberships, sendRenewalReminders } from './services/membership.service';
import { checkActivePeriodExpirations } from './services/active-period-check.service';
import type { JobResult } from './services/job-scheduler.service';

// Wrapper functions to adapt membership functions to JobResult type
async function runMembershipExpiryCheck(): Promise<JobResult> {
  const result = await checkExpiredMemberships();
  return { success: true, itemsProcessed: result };
}

async function runMembershipRenewalReminders(): Promise<JobResult> {
  await sendRenewalReminders();
  return { success: true };
}

async function runActivePeriodCheck(): Promise<JobResult> {
  const result = await checkActivePeriodExpirations();
  return result;
}

let isShuttingDown = false;

async function startWorker(): Promise<void> {
  try {
    logger.info('[Worker] Starting PawTag worker process...');

    // Connect to database
    await connectDatabase(config.dbUrl);
    logger.info('[Worker] Database connected');

    // Register all job functions
    logger.info('[Worker] Registering job functions...');
    registerJobFunction('runReminderJob', runReminderJob);
    registerJobFunction('runSubscriptionJob', runSubscriptionJob);
    registerJobFunction('runEscalationJob', runEscalationJob);
    registerJobFunction('runLowStockJob', runLowStockJob);
    registerJobFunction('runPetMilestonesJob', runPetMilestonesJob);
    registerJobFunction('runPawRewardsJob', runPawRewardsJob);
    registerJobFunction('runOrphanPaymentJob', runOrphanPaymentJob);
    registerJobFunction('runOrderAutoCancelJob', runOrderAutoCancelJob);
    registerJobFunction('runShippingTrackingJob', runShippingTrackingJob);
    registerJobFunction('runWebhookRetryJob', runWebhookRetryJob);
    registerJobFunction('runPaymentReconciliationJob', runPaymentReconciliationJob);
    registerJobFunction('runRefundReconciliationJob', runRefundReconciliationJob);
    registerJobFunction('runPrivacyRetentionJob', runPrivacyRetentionJob);
    registerJobFunction('runAuditRetentionJob', runAuditRetentionJob);
    registerJobFunction('checkExpiredMemberships', runMembershipExpiryCheck);
    registerJobFunction('sendRenewalReminders', runMembershipRenewalReminders);
    registerJobFunction('checkActivePeriodExpirations', runActivePeriodCheck);
    logger.info('[Worker] All job functions registered');

    // Start the scheduler (reads jobs from DB, starts timers)
    await startScheduler();
    logger.info('[Worker] Job scheduler started');

    logger.info('[Worker] Worker process is running');
  } catch (error) {
    logger.fatal({ err: error }, '[Worker] Failed to start worker process');
    process.exit(1);
  }
}

/**
 * Graceful shutdown: stop scheduler, wait for in-flight work, then exit.
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, '[Worker] Shutdown signal received, stopping scheduler...');

  await stopScheduler();

  logger.info('[Worker] Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startWorker();

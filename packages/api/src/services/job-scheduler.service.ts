/**
 * @module JobScheduler
 * @description Centralized background job scheduler that reads configuration from MongoDB
 * and manages job execution with locking, history, and notifications.
 */

import { BackgroundJob, type IBackgroundJobDocument } from '@pawtag/db';
import { createClaimedJob } from '../lib/job-claim';
import logger from '../lib/logger';

/** Result returned by job functions */
export interface JobResult {
  success: boolean;
  error?: string;
  itemsProcessed?: number;
}

/** Job function type */
type JobFunction = () => Promise<JobResult>;

/** Registry of job functions keyed by name */
const jobFunctions = new Map<string, JobFunction>();

/** Active timers keyed by job name */
const timers = new Map<string, ReturnType<typeof setInterval>>();

/** Worker ID for this process */
let workerId = process.env.PAWTAG_WORKER_ROLE === 'worker'
  ? `worker-${process.env.HOSTNAME || process.env.COMPUTERNAME || 'unknown'}-${process.pid}`
  : `api-${process.env.HOSTNAME || process.env.COMPUTERNAME || 'unknown'}-${process.pid}`;

/** Shutdown flag */
let isShuttingDown = false;

/**
 * Register a job function. Must be called before scheduler.start().
 */
export function registerJobFunction(name: string, fn: JobFunction): void {
  jobFunctions.set(name, fn);
}

/**
 * Get the worker ID for this process.
 */
export function getWorkerId(): string {
  return workerId;
}

/**
 * Start the scheduler. Reads all enabled jobs from DB and starts timers.
 */
export async function start(): Promise<void> {
  const jobs = await BackgroundJob.find({ enabled: true }).lean();
  logger.info({ count: jobs.length }, 'Job scheduler starting');

  for (const job of jobs) {
    startJobTimer(job);
  }

  logger.info({ count: timers.size }, 'Job scheduler started');
}

/**
 * Stop all timers gracefully.
 */
export async function stop(): Promise<void> {
  isShuttingDown = true;
  logger.info('Job scheduler stopping');

  for (const [name, timer] of timers) {
    clearInterval(timer);
    logger.debug({ job: name }, 'Timer cleared');
  }
  timers.clear();

  // Wait for in-flight work to settle
  await new Promise((r) => setTimeout(r, 2000));
  logger.info('Job scheduler stopped');
}

/**
 * Start a timer for a single job.
 */
function startJobTimer(job: IBackgroundJobDocument): void {
  if (timers.has(job.name)) {
    logger.warn({ job: job.name }, 'Job timer already exists, skipping');
    return;
  }

  const fn = jobFunctions.get(job.functionName);
  if (!fn) {
    logger.error({ job: job.name, function: job.functionName }, 'Job function not registered');
    return;
  }

  const timer = setInterval(async () => {
    if (isShuttingDown) return;
    await executeJob(job.name);
  }, job.intervalMs);

  timers.set(job.name, timer);
  logger.debug({ job: job.name, intervalMs: job.intervalMs }, 'Job timer started');
}

/**
 * Execute a single job by name.
 */
export async function executeJob(jobName: string): Promise<JobResult | null> {
  // Re-read config from DB (in case it changed via admin)
  const job = await BackgroundJob.findOne({ name: jobName }).lean();
  if (!job || !job.enabled) return null;

  const fn = jobFunctions.get(job.functionName);
  if (!fn) {
    logger.error({ job: jobName, function: job.functionName }, 'Job function not found');
    return null;
  }

  // Acquire lock and execute
  let result: JobResult = { success: false, error: 'Lock not acquired' };
  const lockAcquired = await createClaimedJob(
    job.lockName,
    workerId,
    async () => {
      // Update status to running
      await BackgroundJob.updateOne(
        { name: jobName },
        { $set: { status: 'running', currentWorkerId: workerId, lastRunAt: new Date() } },
      );

      const startTime = Date.now();
      try {
        result = await fn();
      } catch (err: any) {
        result = { success: false, error: err.message || 'Unknown error' };
      }
      const durationMs = Date.now() - startTime;

      // Build history entry
      const historyEntry = {
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs,
        result: result.success ? 'success' : 'error',
        error: result.error,
        itemsProcessed: result.itemsProcessed,
        workerId,
      };

      // Update job state and append history (keep last N entries)
      const jobDoc = await BackgroundJob.findOne({ name: jobName }).lean();
      const maxHistory = jobDoc?.maxHistorySize || 500;

      await BackgroundJob.updateOne(
        { name: jobName },
        {
          $set: {
            status: result.success ? 'idle' : 'error',
            lastRunResult: result.success ? 'success' : 'error',
            lastRunDurationMs: durationMs,
            lastError: result.error || null,
            currentWorkerId: null,
          },
          $push: {
            runHistory: {
              $each: [historyEntry],
              $slice: -maxHistory,
            },
          },
        },
      );

      logger.info({
        job: jobName,
        result: result.success ? 'success' : 'error',
        durationMs,
        itemsProcessed: result.itemsProcessed,
        error: result.error,
      }, 'Job executed');
    },
    job.lockLeaseMs || 120000,
  );

  if (!lockAcquired) {
    logger.debug({ job: jobName }, 'Job skipped — lock held by another worker');
    return null;
  }

  return result;
}

/**
 * Toggle a job's enabled state.
 */
export async function toggleJob(jobName: string, enabled: boolean): Promise<void> {
  await BackgroundJob.updateOne(
    { name: jobName },
    { $set: { enabled, status: enabled ? 'idle' : 'disabled' } },
  );

  if (enabled) {
    // Start timer if not already running
    const job = await BackgroundJob.findOne({ name: jobName }).lean();
    if (job && !timers.has(jobName)) {
      startJobTimer(job);
    }
  } else {
    // Stop timer
    const timer = timers.get(jobName);
    if (timer) {
      clearInterval(timer);
      timers.delete(jobName);
    }
  }
}

/**
 * Update a job's interval. Restarts the timer with the new interval.
 */
export async function updateJobInterval(jobName: string, intervalMs: number): Promise<void> {
  await BackgroundJob.updateOne(
    { name: jobName },
    { $set: { intervalMs } },
  );

  // Restart timer with new interval
  const timer = timers.get(jobName);
  if (timer) {
    clearInterval(timer);
    timers.delete(jobName);
  }

  const job = await BackgroundJob.findOne({ name: jobName }).lean();
  if (job && job.enabled) {
    startJobTimer(job);
  }
}

/**
 * Get all registered job names.
 */
export function getRegisteredJobs(): string[] {
  return Array.from(jobFunctions.keys());
}

/**
 * Get active timer count.
 */
export function getActiveTimerCount(): number {
  return timers.size;
}

/**
 * @module Job Claiming
 * @description Simple Mongo-based job claiming for single-worker deployment.
 *
 * Uses a `job_locks` collection to ensure only one worker process
 * can execute a given job at a time. This prevents duplicate execution
 * when multiple API replicas accidentally start jobs, or when a worker
 * restarts while a previous iteration is still running.
 *
 * Architecture:
 * - Each job has a unique name (e.g., 'webhook-retry', 'orphan-payment')
 * - Before executing, the worker attempts to claim the job via atomic update
 * - If claim succeeds, the job runs and releases the lock after completion
 * - If claim fails (another worker holds it), the iteration is skipped
 * - Locks auto-expire after `leaseMs` to handle worker crashes
 */

import mongoose from 'mongoose';
import logger from './logger';

const LOCK_COLLECTION = 'job_locks';

interface JobLock {
  _id: string;
  lockedBy: string;
  lockedAt: Date;
  leaseExpiresAt: Date;
}

const LockSchema = new mongoose.Schema<JobLock>({
  _id: { type: String, required: true },
  lockedBy: { type: String, required: true },
  lockedAt: { type: Date, required: true },
  leaseExpiresAt: { type: Date, required: true },
}, { collection: LOCK_COLLECTION, timestamps: false });

let LockModel: mongoose.Model<JobLock>;

function getLockModel(): mongoose.Model<JobLock> {
  if (!LockModel) {
    LockModel = mongoose.model<JobLock>('JobLock', LockSchema);
  }
  return LockModel;
}

/**
 * Attempt to claim a job lock.
 * Returns true if the lock was acquired, false if another worker holds it.
 */
export async function claimJob(
  jobName: string,
  workerId: string,
  leaseMs: number = 120_000
): Promise<boolean> {
  const Lock = getLockModel();
  const now = new Date();
  const leaseExpires = new Date(now.getTime() + leaseMs);

  try {
    // Atomic update: only claim if no active lock exists
    const result = await Lock.updateOne(
      {
        _id: jobName,
        // Allow claim if: no lock exists OR lock has expired
        $or: [
          { lockedBy: workerId }, // Re-entrant: same worker can re-claim
          { leaseExpiresAt: { $lte: now } }, // Expired lease
        ],
      },
      {
        $set: {
          lockedBy: workerId,
          lockedAt: now,
          leaseExpiresAt: leaseExpires,
        },
      },
      { upsert: true }
    );

    // Check if we actually acquired the lock
    // upsert: if doc didn't exist, we created it (success)
    // if doc existed, we only updated if lease expired or same worker
    const lock = await Lock.findById(jobName).lean();
    if (lock && lock.lockedBy === workerId) {
      return true;
    }

    return false;
  } catch (err: any) {
    // Duplicate key (11000) is expected during concurrent upsert — not a real error
    if (err.code === 11000) {
      return false;
    }
    logger.error({ err, jobName }, 'Failed to claim job lock');
    return false;
  }
}

/**
 * Release a job lock after execution completes.
 */
export async function releaseJob(jobName: string, workerId: string): Promise<void> {
  const Lock = getLockModel();
  try {
    await Lock.deleteOne({ _id: jobName, lockedBy: workerId });
  } catch (err) {
    logger.error({ err, jobName }, 'Failed to release job lock');
  }
}

/**
 * Create a claimed job runner.
 * Wraps a job function with claiming logic.
 *
 * @param jobName Unique identifier for this job
 * @param workerId Unique identifier for this worker process
 * @param fn The actual job function to execute
 * @param leaseMs How long the lock is held (must be longer than max execution time)
 */
export function createClaimedJob(
  jobName: string,
  workerId: string,
  fn: () => Promise<void>,
  leaseMs: number = 120_000
): () => Promise<void> {
  return async () => {
    const acquired = await claimJob(jobName, workerId, leaseMs);
    if (!acquired) {
      return; // Another worker is handling this job
    }

    try {
      await fn();
    } catch (err) {
      logger.error({ err, jobName }, 'Claimed job failed');
    } finally {
      await releaseJob(jobName, workerId);
    }
  };
}

/**
 * Generate a unique worker ID for this process instance.
 */
let lastGeneratedId = '';
let counter = 0;

export function generateWorkerId(): string {
  const pid = process.pid;
  const hostname = process.env.HOSTNAME || process.env.COMPUTERNAME || 'worker';
  const timestamp = Date.now().toString(36);
  counter++;
  const id = `${hostname}-${pid}-${timestamp}-${counter}`;
  // Ensure uniqueness even if called in rapid succession
  if (id === lastGeneratedId) {
    counter++;
    return `${hostname}-${pid}-${timestamp}-${counter}`;
  }
  lastGeneratedId = id;
  return id;
}

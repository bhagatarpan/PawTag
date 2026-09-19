/**
 * @module Job Claiming Tests
 * @description Unit tests for the Mongo-based job claiming mechanism.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { claimJob, releaseJob, createClaimedJob, generateWorkerId } from '../../packages/api/src/lib/job-claim';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  // Clear locks collection between tests
  const collections = mongoose.connection.collections;
  if (collections['job_locks']) {
    await collections['job_locks'].deleteMany({});
  }
});

describe('Job Claiming', () => {
  describe('claimJob', () => {
    it('should claim a job when no lock exists', async () => {
      const workerId = generateWorkerId();
      const result = await claimJob('test-job', workerId);
      expect(result).toBe(true);
    });

    it('should reject claim when another worker holds the lock', async () => {
      const worker1 = 'worker-1';
      const worker2 = 'worker-2';

      // Worker 1 claims first
      const result1 = await claimJob('test-job', worker1);
      expect(result1).toBe(true);

      // Worker 2 tries to claim the same job
      const result2 = await claimJob('test-job', worker2);
      expect(result2).toBe(false);
    });

    it('should allow same worker to re-claim', async () => {
      const workerId = 'worker-1';

      // First claim
      const result1 = await claimJob('test-job', workerId);
      expect(result1).toBe(true);

      // Same worker re-claims (e.g., after restart)
      const result2 = await claimJob('test-job', workerId);
      expect(result2).toBe(true);
    });

    it('should allow claim after lease expires', async () => {
      const worker1 = 'worker-1';
      const worker2 = 'worker-2';

      // Worker 1 claims with very short lease
      const result1 = await claimJob('test-job', worker1, 1); // 1ms lease
      expect(result1).toBe(true);

      // Wait for lease to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      // Worker 2 can now claim
      const result2 = await claimJob('test-job', worker2);
      expect(result2).toBe(true);
    });

    it('should handle multiple different job names independently', async () => {
      const worker1 = 'worker-1';
      const worker2 = 'worker-2';

      // Worker 1 claims job-a
      const result1 = await claimJob('job-a', worker1);
      expect(result1).toBe(true);

      // Worker 2 claims job-b (different job)
      const result2 = await claimJob('job-b', worker2);
      expect(result2).toBe(true);

      // Both jobs are claimed by their respective workers
      const lockA = await mongoose.connection.collections['job_locks'].findOne({ _id: 'job-a' });
      const lockB = await mongoose.connection.collections['job_locks'].findOne({ _id: 'job-b' });

      expect(lockA?.lockedBy).toBe(worker1);
      expect(lockB?.lockedBy).toBe(worker2);
    });
  });

  describe('releaseJob', () => {
    it('should release a claimed job', async () => {
      const workerId = 'worker-1';

      // Claim
      await claimJob('test-job', workerId);

      // Release
      await releaseJob('test-job', workerId);

      // Another worker can now claim
      const result = await claimJob('test-job', 'worker-2');
      expect(result).toBe(true);
    });

    it('should not release job claimed by different worker', async () => {
      const worker1 = 'worker-1';
      const worker2 = 'worker-2';

      // Worker 1 claims
      await claimJob('test-job', worker1);

      // Worker 2 tries to release (should not affect worker 1's lock)
      await releaseJob('test-job', worker2);

      // Worker 2 should not be able to claim
      const result = await claimJob('test-job', worker2);
      expect(result).toBe(false);
    });
  });

  describe('createClaimedJob', () => {
    it('should execute job function when claim succeeds', async () => {
      const workerId = generateWorkerId();
      let executed = false;

      const job = createClaimedJob('test-job', workerId, async () => {
        executed = true;
      });

      await job();
      expect(executed).toBe(true);
    });

    it('should not execute job function when claim fails', async () => {
      const worker1 = 'worker-1';
      const worker2 = 'worker-2';
      let executedByWorker2 = false;

      // Worker 1 claims first
      await claimJob('test-job', worker1);

      // Worker 2 tries to run the same job
      const job = createClaimedJob('test-job', worker2, async () => {
        executedByWorker2 = true;
      });

      await job();
      expect(executedByWorker2).toBe(false);
    });

    it('should release lock after job execution completes', async () => {
      const workerId = generateWorkerId();

      const job = createClaimedJob('test-job', workerId, async () => {
        // Job does some work
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      await job();

      // Lock should be released, another worker can claim
      const result = await claimJob('test-job', 'other-worker');
      expect(result).toBe(true);
    });

    it('should release lock even if job throws an error', async () => {
      const workerId = generateWorkerId();

      const job = createClaimedJob('test-job', workerId, async () => {
        throw new Error('Job failed');
      });

      // Should not throw (error is caught internally)
      await job();

      // Lock should be released
      const result = await claimJob('test-job', 'other-worker');
      expect(result).toBe(true);
    });
  });

  describe('generateWorkerId', () => {
    it('should generate a unique worker ID', () => {
      const id1 = generateWorkerId();
      const id2 = generateWorkerId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      // IDs should be different (different timestamps)
      expect(id1).not.toBe(id2);
    });
  });
});

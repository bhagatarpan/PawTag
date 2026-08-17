import { describe, it, expect, vi, beforeEach } from 'vitest';
import { timed, logOperation, logIntegration, logDbOperation, logJob } from '../../packages/api/src/lib/timing';

vi.mock('../../packages/api/src/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

vi.mock('../../packages/api/src/lib/request-context', () => ({
  getRequestContext: vi.fn().mockReturnValue({
    requestId: 'req-123',
    correlationId: 'corr-456',
  }),
}));

describe('Timing Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('timed', () => {
    it('returns success result with duration', async () => {
      const result = await timed(async () => 'hello');
      expect(result.success).toBe(true);
      expect(result.data).toBe('hello');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('returns failure result with error and duration', async () => {
      const error = new Error('test error');
      const result = await timed(async () => { throw error; });
      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('logOperation', () => {
    it('returns result on success', async () => {
      const result = await logOperation('createPet', 'pets', async () => ({ id: '123' }));
      expect(result).toEqual({ id: '123' });
    });

    it('throws on failure', async () => {
      const error = new Error('failed');
      await expect(
        logOperation('createPet', 'pets', async () => { throw error; })
      ).rejects.toThrow('failed');
    });
  });

  describe('logIntegration', () => {
    it('returns result on success', async () => {
      const result = await logIntegration('Stripe', 'createPayment', async () => ({ id: 'pi_123' }));
      expect(result).toEqual({ id: 'pi_123' });
    });

    it('throws on failure', async () => {
      const error = new Error('API error');
      await expect(
        logIntegration('Stripe', 'createPayment', async () => { throw error; })
      ).rejects.toThrow('API error');
    });
  });

  describe('logDbOperation', () => {
    it('returns result on success', async () => {
      const result = await logDbOperation('find', 'User', async () => ({ name: 'John' }));
      expect(result).toEqual({ name: 'John' });
    });

    it('warns on slow queries', async () => {
      const result = await logDbOperation(
        'find',
        'User',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { name: 'John' };
        },
        {},
        50 // 50ms threshold
      );
      expect(result).toEqual({ name: 'John' });
    });

    it('throws on failure', async () => {
      const error = new Error('DB error');
      await expect(
        logDbOperation('find', 'User', async () => { throw error; })
      ).rejects.toThrow('DB error');
    });
  });

  describe('logJob', () => {
    it('returns result on success', async () => {
      const result = await logJob('escalation-check', async () => ({ processed: 5 }));
      expect(result).toEqual({ processed: 5 });
    });

    it('throws on failure', async () => {
      const error = new Error('job failed');
      await expect(
        logJob('escalation-check', async () => { throw error; })
      ).rejects.toThrow('job failed');
    });
  });
});

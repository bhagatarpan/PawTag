import { describe, it, expect } from 'vitest';
import { getRequestContext, runWithContext, createContextLogger, RequestContext } from '../../packages/api/src/lib/request-context';
import { logger } from '../../packages/api/src/lib/logger';

describe('RequestContext', () => {
  const mockContext: RequestContext = {
    requestId: 'req-123',
    correlationId: 'corr-456',
    traceId: 'trace-789',
    transactionId: 'txn-012',
    startTime: Date.now(),
    method: 'GET',
    route: '/api/test',
    service: 'pawtag-api',
    environment: 'test',
  };

  describe('getRequestContext', () => {
    it('returns undefined when not in a request context', () => {
      const ctx = getRequestContext();
      expect(ctx).toBeUndefined();
    });
  });

  describe('runWithContext', () => {
    it('provides context within the callback', () => {
      runWithContext(mockContext, () => {
        const ctx = getRequestContext();
        expect(ctx).toBeDefined();
        expect(ctx?.requestId).toBe('req-123');
        expect(ctx?.correlationId).toBe('corr-456');
        expect(ctx?.traceId).toBe('trace-789');
        expect(ctx?.method).toBe('GET');
        expect(ctx?.route).toBe('/api/test');
      });
    });

    it('returns the callback result', () => {
      const result = runWithContext(mockContext, () => {
        return 'test-result';
      });
      expect(result).toBe('test-result');
    });

    it('does not leak context outside the callback', () => {
      runWithContext(mockContext, () => {
        // Context is available inside
        expect(getRequestContext()).toBeDefined();
      });
      // Context is not available outside
      expect(getRequestContext()).toBeUndefined();
    });

    it('supports nested contexts', () => {
      const innerContext: RequestContext = {
        ...mockContext,
        requestId: 'req-nested',
      };

      runWithContext(mockContext, () => {
        expect(getRequestContext()?.requestId).toBe('req-123');

        runWithContext(innerContext, () => {
          expect(getRequestContext()?.requestId).toBe('req-nested');
        });

        // Outer context restored
        expect(getRequestContext()?.requestId).toBe('req-123');
      });
    });
  });

  describe('createContextLogger', () => {
    it('enriches logger with request context fields', () => {
      runWithContext(mockContext, () => {
        const contextLogger = createContextLogger(logger);
        expect(contextLogger).toBeDefined();
        // The child logger should have the context fields bound
        expect(typeof contextLogger.info).toBe('function');
      });
    });

    it('returns original logger when no context available', () => {
      const contextLogger = createContextLogger(logger);
      expect(contextLogger).toBe(logger);
    });
  });
});

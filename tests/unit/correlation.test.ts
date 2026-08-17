import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../packages/api/src/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../packages/api/src/lib/request-context', () => ({
  getRequestContext: vi.fn().mockReturnValue({
    requestId: 'req-123',
    correlationId: 'corr-456',
    traceId: 'trace-789',
  }),
}));

vi.mock('../../packages/api/src/lib/tracing', () => ({
  getCurrentTraceContext: vi.fn().mockReturnValue({
    traceId: 'otel-trace-123',
    spanId: 'otel-span-456',
  }),
}));

vi.mock('../../packages/api/src/services/audit', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

import {
  createCorrelationContext,
  logWithCorrelation,
  getFeatureRegistry,
  hasExpectedAuditEvents,
  getExpectedAuditEvents,
  buildCorrelationEvidence,
} from '../../packages/api/src/lib/correlation';
import logger from '../../packages/api/src/lib/logger';

describe('Correlation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCorrelationContext', () => {
    it('creates context with request and trace info', () => {
      const ctx = createCorrelationContext({
        featureName: 'Test Feature',
        workflowName: 'Test Workflow',
      });

      expect(ctx.requestId).toBe('req-123');
      expect(ctx.correlationId).toBe('corr-456');
      expect(ctx.featureName).toBe('Test Feature');
      expect(ctx.workflowName).toBe('Test Workflow');
    });
  });

  describe('logWithCorrelation', () => {
    it('logs with correlation context', () => {
      logWithCorrelation('info', 'Test message', {
        featureName: 'Test Feature',
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          featureName: 'Test Feature',
          correlationType: 'feature-operation',
        }),
        'Test message'
      );
    });
  });

  describe('getFeatureRegistry', () => {
    it('returns feature registry', () => {
      const registry = getFeatureRegistry();

      expect(registry).toBeDefined();
      expect(registry['auth']).toBeDefined();
      expect(registry['pets']).toBeDefined();
      expect(registry['finder']).toBeDefined();
    });
  });

  describe('hasExpectedAuditEvents', () => {
    it('returns true for known feature/workflow', () => {
      expect(hasExpectedAuditEvents('auth', 'login')).toBe(true);
    });

    it('returns false for unknown feature', () => {
      expect(hasExpectedAuditEvents('unknown', 'unknown')).toBe(false);
    });
  });

  describe('getExpectedAuditEvents', () => {
    it('returns expected audit events for known feature/workflow', () => {
      const events = getExpectedAuditEvents('auth', 'login');

      expect(events).toContain('auth.login.success');
      expect(events).toContain('auth.login.failure');
    });

    it('returns empty array for unknown feature', () => {
      const events = getExpectedAuditEvents('unknown', 'unknown');

      expect(events).toEqual([]);
    });
  });

  describe('buildCorrelationEvidence', () => {
    it('builds evidence summary', () => {
      const evidence = buildCorrelationEvidence(
        {
          featureName: 'Test Feature',
          workflowName: 'Test Workflow',
          businessOperation: 'test-operation',
        },
        'SUCCESS'
      );

      expect(evidence.feature).toBe('Test Feature');
      expect(evidence.workflow).toBe('Test Workflow');
      expect(evidence.businessOperation).toBe('test-operation');
      expect(evidence.outcome).toBe('SUCCESS');
      expect(evidence.requestId).toBe('req-123');
      expect(evidence.timestamp).toBeDefined();
    });
  });
});

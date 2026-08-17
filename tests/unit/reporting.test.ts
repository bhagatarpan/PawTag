import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  }),
}));

vi.mock('../../packages/api/src/lib/correlation', () => ({
  getFeatureRegistry: vi.fn().mockReturnValue({
    auth: { name: 'Authentication', workflows: {} },
    pets: { name: 'Pet Management', workflows: {} },
  }),
  getExpectedAuditEvents: vi.fn().mockReturnValue(['auth.login.success']),
}));

import {
  determineSeverity,
  generateIncidentReport,
  generateRequestTimeline,
  generateFeatureHealthReport,
  generateDependencyHealthReport,
  generateOperationalSummary,
  formatEvidence,
  exportReport,
} from '../../packages/api/src/lib/reporting';

describe('Reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('determineSeverity', () => {
    it('returns CRITICAL for all-users with high error rate and long duration', () => {
      const severity = determineSeverity(0.6, 'all-users', 400000);
      expect(severity).toBe('CRITICAL');
    });

    it('returns HIGH for multiple-users', () => {
      const severity = determineSeverity(0.1, 'multiple-users', 10000);
      expect(severity).toBe('HIGH');
    });

    it('returns MEDIUM for single-user with moderate error rate', () => {
      const severity = determineSeverity(0.15, 'single-user', 5000);
      expect(severity).toBe('MEDIUM');
    });

    it('returns LOW for low impact', () => {
      const severity = determineSeverity(0.01, 'single-user', 1000);
      expect(severity).toBe('LOW');
    });
  });

  describe('generateIncidentReport', () => {
    it('generates incident report from error', () => {
      const error = new Error('Test error');
      const report = generateIncidentReport('Test Incident', 'Test description', error, {
        service: 'test-service',
        requestId: 'req-123',
      });

      expect(report.title).toBe('Test Incident');
      expect(report.description).toBe('Test description');
      expect(report.whatHappened).toBe('Test error');
      expect(report.service).toBe('test-service');
      expect(report.requestId).toBe('req-123');
      expect(report.evidence.length).toBeGreaterThan(0);
      expect(report.timestamp).toBeDefined();
    });
  });

  describe('generateRequestTimeline', () => {
    it('generates request timeline', () => {
      const entries = [
        { timestamp: '2026-01-01T00:00:00Z', type: 'request' as const, message: 'Request started' },
        { timestamp: '2026-01-01T00:00:01Z', type: 'log' as const, message: 'Processing' },
        { timestamp: '2026-01-01T00:00:02Z', type: 'request' as const, message: 'Request completed' },
      ];

      const report = generateRequestTimeline('req-123', 'GET', '/api/test', entries, 200, 2000);

      expect(report.requestId).toBe('req-123');
      expect(report.method).toBe('GET');
      expect(report.path).toBe('/api/test');
      expect(report.statusCode).toBe(200);
      expect(report.duration).toBe(2000);
      expect(report.outcome).toBe('SUCCESS');
      expect(report.entries.length).toBe(3);
    });

    it('marks failed requests correctly', () => {
      const entries = [
        { timestamp: '2026-01-01T00:00:00Z', type: 'request' as const, message: 'Request started' },
        { timestamp: '2026-01-01T00:00:01Z', type: 'error' as const, message: 'Error occurred' },
      ];

      const report = generateRequestTimeline('req-123', 'POST', '/api/test', entries, 500, 1000);

      expect(report.outcome).toBe('FAILURE');
    });
  });

  describe('generateFeatureHealthReport', () => {
    it('generates feature health report', () => {
      const report = generateFeatureHealthReport('auth', 'Authentication', {
        errorCount: 10,
        totalRequests: 100,
        avgLatency: 150,
        workflowFailures: 2,
      });

      expect(report.featureId).toBe('auth');
      expect(report.featureName).toBe('Authentication');
      expect(report.errorRate).toBe(0.1);
      expect(report.avgLatency).toBe(150);
      expect(report.workflowFailures).toBe(2);
      expect(report.documentationStatus).toBe('COMPLETE');
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('generateDependencyHealthReport', () => {
    it('generates dependency health report', () => {
      const report = generateDependencyHealthReport('stripe', {
        successCount: 90,
        errorCount: 10,
        timeoutCount: 2,
        retryCount: 5,
        avgLatency: 200,
      });

      expect(report.provider).toBe('stripe');
      expect(report.successRate).toBe(0.9);
      expect(report.status).toBe('HEALTHY');
      expect(report.avgLatency).toBe(200);
    });

    it('marks degraded dependencies correctly', () => {
      const report = generateDependencyHealthReport('stripe', {
        successCount: 80,
        errorCount: 20,
        timeoutCount: 5,
        retryCount: 15,
        avgLatency: 500,
      });

      expect(report.status).toBe('DEGRADED');
    });
  });

  describe('generateOperationalSummary', () => {
    it('generates operational summary', () => {
      const summary = generateOperationalSummary();

      expect(summary.totalRequests).toBeDefined();
      expect(summary.errorRate).toBeDefined();
      expect(summary.avgResponseTime).toBeDefined();
      expect(summary.timestamp).toBeDefined();
    });
  });

  describe('formatEvidence', () => {
    it('formats evidence for human readability', () => {
      const evidence = [
        { type: 'FACT' as const, description: 'Error occurred', source: 'error-handler' },
        { type: 'OBSERVATION' as const, description: 'High latency', source: 'metrics' },
      ];

      const formatted = formatEvidence(evidence);

      expect(formatted).toContain('[FACT] Error occurred');
      expect(formatted).toContain('[OBSERVATION] High latency');
    });
  });

  describe('exportReport', () => {
    it('exports report as JSON', () => {
      const report = { test: 'value', number: 42 };
      const exported = exportReport(report);

      expect(JSON.parse(exported)).toEqual(report);
    });
  });
});

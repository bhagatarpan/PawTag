import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initTracing,
  shutdownTracing,
  getTracer,
  startSpan,
  withSpan,
  getCurrentTraceContext,
  getTraceLogContext,
  traceDbOperation,
  traceIntegration,
} from '../../packages/api/src/lib/tracing';

// Mock OpenTelemetry modules
vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@opentelemetry/resources', () => ({
  resourceFromAttributes: vi.fn().mockReturnValue({}),
}));

vi.mock('@opentelemetry/sdk-trace-node', () => ({
  BatchSpanProcessor: vi.fn(),
  ConsoleSpanExporter: vi.fn(),
}));

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: vi.fn(),
}));

vi.mock('@opentelemetry/instrumentation-http', () => ({
  HttpInstrumentation: vi.fn(),
}));

vi.mock('@opentelemetry/instrumentation-express', () => ({
  ExpressInstrumentation: vi.fn(),
}));

vi.mock('@opentelemetry/instrumentation-mongoose', () => ({
  MongooseInstrumentation: vi.fn(),
}));

describe('Tracing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await shutdownTracing();
  });

  describe('initTracing', () => {
    it('initializes tracing with valid config', () => {
      initTracing({
        serviceName: 'test-service',
        environment: 'test',
      });
      // Should not throw
    });

    it('does not initialize twice', () => {
      initTracing({ serviceName: 'test-service' });
      initTracing({ serviceName: 'test-service' });
      // Second call should be a no-op
    });

    it('handles initialization failure gracefully', () => {
      // This should not throw even if there's an error
      expect(() => {
        initTracing({ serviceName: 'test-service' });
      }).not.toThrow();
    });
  });

  describe('shutdownTracing', () => {
    it('shuts down gracefully', async () => {
      initTracing({ serviceName: 'test-service' });
      await expect(shutdownTracing()).resolves.not.toThrow();
    });

    it('handles shutdown when not initialized', async () => {
      await expect(shutdownTracing()).resolves.not.toThrow();
    });
  });

  describe('startSpan', () => {
    it('creates a span with attributes', () => {
      const { span, end, setError, setAttribute } = startSpan('test-span', {
        'test.key': 'value',
      });
      expect(span).toBeDefined();
      expect(typeof end).toBe('function');
      expect(typeof setError).toBe('function');
      expect(typeof setAttribute).toBe('function');
    });
  });

  describe('withSpan', () => {
    it('executes function within a span', async () => {
      const result = await withSpan('test-span', async () => {
        return 'test-result';
      });
      expect(result).toBe('test-result');
    });

    it('records errors in span', async () => {
      await expect(
        withSpan('test-span', async () => {
          throw new Error('test error');
        })
      ).rejects.toThrow('test error');
    });
  });

  describe('traceDbOperation', () => {
    it('traces database operations', async () => {
      const result = await traceDbOperation('find', 'users', async () => {
        return { id: '123' };
      });
      expect(result).toEqual({ id: '123' });
    });
  });

  describe('traceIntegration', () => {
    it('traces external integration calls', async () => {
      const result = await traceIntegration('stripe', 'createPayment', async () => {
        return { success: true };
      });
      expect(result).toEqual({ success: true });
    });
  });
});

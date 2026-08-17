/**
 * OpenTelemetry distributed tracing for PawTag.
 *
 * Vendor-neutral tracing that connects requests across application,
 * database, and external-service boundaries.
 *
 * Tracing failure never causes a business request to fail.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { trace, context, SpanStatusCode, SpanKind, Attributes } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { MongooseInstrumentation } from '@opentelemetry/instrumentation-mongoose';
import logger from './logger';

// ─── Types ─────────────────────────────────────────────────────────

export interface TracingConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  otlpEndpoint?: string;
  consoleExporter?: boolean;
  sampleRate?: number;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
}

// ─── State ─────────────────────────────────────────────────────────

let sdk: NodeSDK | null = null;
let initialized = false;

// ─── Initialization ────────────────────────────────────────────────

/**
 * Initialize OpenTelemetry tracing.
 * Safe to call multiple times; subsequent calls are no-ops.
 * Never throws — tracing failure must not affect business requests.
 */
export function initTracing(config: TracingConfig): void {
  if (initialized) return;

  try {
    const resource = resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion || '0.0.0',
      'deployment.environment': config.environment || 'development',
    });

    const spanProcessors: BatchSpanProcessor[] = [];

    // Console exporter for development
    if (config.consoleExporter || config.environment === 'development') {
      spanProcessors.push(new BatchSpanProcessor(new ConsoleSpanExporter()));
    }

    // OTLP exporter for production (if endpoint configured)
    if (config.otlpEndpoint) {
      const otlpExporter = new OTLPTraceExporter({
        url: `${config.otlpEndpoint}/v1/traces`,
      });
      spanProcessors.push(new BatchSpanProcessor(otlpExporter));
    }

    sdk = new NodeSDK({
      resource,
      spanProcessors,
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (request) => {
            // Skip health checks and docs
            const url = request.url || '';
            return url.startsWith('/health') || url.startsWith('/api/docs') || url === '/favicon.ico';
          },
        }),
        new ExpressInstrumentation(),
        new MongooseInstrumentation(),
      ],
    });

    sdk.start();
    initialized = true;

    logger.info({
      service: config.serviceName,
      environment: config.environment,
      otlpEndpoint: config.otlpEndpoint || 'none',
    }, 'OpenTelemetry tracing initialized');
  } catch (error) {
    // Tracing failure must not affect business requests
    logger.warn({ err: error }, 'Failed to initialize OpenTelemetry tracing — continuing without tracing');
  }
}

/**
 * Shut down tracing gracefully.
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      logger.info('OpenTelemetry tracing shut down');
    } catch (error) {
      logger.warn({ err: error }, 'Error shutting down OpenTelemetry tracing');
    }
  }
}

// ─── Span Helpers ──────────────────────────────────────────────────

/**
 * Get the active tracer for PawTag.
 */
export function getTracer(name = 'pawtag') {
  return trace.getTracer(name);
}

/**
 * Create a new span for an operation.
 * Returns the span and a function to end it.
 */
export function startSpan(
  name: string,
  attributes?: Attributes,
  kind: SpanKind = SpanKind.INTERNAL
) {
  const tracer = getTracer();
  const span = tracer.startSpan(name, { kind, attributes });

  return {
    span,
    end: () => span.end(),
    setError: (error: Error) => {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
    },
    setAttributes: (attrs: Attributes) => span.setAttributes(attrs),
    setAttribute: (key: string, value: string | number | boolean) => span.setAttribute(key, value),
  };
}

/**
 * Run a function within a new span.
 * Automatically records errors and ends the span.
 */
export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Attributes,
  kind: SpanKind = SpanKind.INTERNAL
): Promise<T> {
  const { span, end, setError } = startSpan(name, attributes, kind);

  try {
    const result = await fn();
    return result;
  } catch (error) {
    if (error instanceof Error) {
      setError(error);
    }
    throw error;
  } finally {
    end();
  }
}

/**
 * Get current trace context for correlation with request IDs.
 */
export function getCurrentTraceContext(): TraceContext | null {
  const activeSpan = trace.getActiveSpan();
  if (!activeSpan) return null;

  const spanContext = activeSpan.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags,
  };
}

/**
 * Add trace context to log metadata.
 */
export function getTraceLogContext(): Record<string, string> {
  const ctx = getCurrentTraceContext();
  if (!ctx) return {};

  return {
    traceId: ctx.traceId,
    spanId: ctx.spanId,
  };
}

// ─── Database Tracing ──────────────────────────────────────────────

/**
 * Trace a database operation.
 * Safe — never exposes sensitive query parameters.
 */
export async function traceDbOperation<T>(
  operation: string,
  collection: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(
    `db.${operation}`,
    fn,
    {
      'db.system': 'mongodb',
      'db.operation': operation,
      'db.collection': collection,
    },
    SpanKind.CLIENT
  );
}

// ─── Integration Tracing ───────────────────────────────────────────

/**
 * Trace an external integration call.
 */
export async function traceIntegration<T>(
  provider: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(
    `integration.${provider}.${operation}`,
    fn,
    {
      'peer.service': provider,
      'rpc.method': operation,
    },
    SpanKind.CLIENT
  );
}

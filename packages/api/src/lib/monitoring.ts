/**
 * Central error monitoring for PawTag.
 *
 * Vendor-neutral abstraction over error monitoring providers.
 * Currently uses Sentry as the backend, but the interface is provider-agnostic.
 *
 * Captures unhandled exceptions, API errors, and integration failures
 * with full request context and sensitive data redaction.
 */

import * as Sentry from '@sentry/node';
import logger from './logger';
import { getRequestContext } from './request-context';
import { getCurrentTraceContext } from './tracing';

// ─── Types ─────────────────────────────────────────────────────────

export interface ErrorContext {
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  userId?: string;
  email?: string;
  operation?: string;
  feature?: string;
  workflow?: string;
  severity?: 'fatal' | 'error' | 'warning' | 'info';
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export interface MonitoringConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  tracesSampleRate?: number;
  enabled?: boolean;
}

// ─── State ─────────────────────────────────────────────────────────

let initialized = false;
let enabled = false;

// ─── Sensitive fields to redact ────────────────────────────────────

const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'hashedPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'jwtSecret',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'otp',
  'otpCode',
  'creditCard',
  'cardNumber',
  'cvv',
  'ssn',
  'privateKey',
  'finderPhone',
  'finderEmail',
  'emergencyContact',
  'emergencyPhone',
];

// ─── Redaction ─────────────────────────────────────────────────────

function redactSensitiveData(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data;

  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

// ─── Initialization ────────────────────────────────────────────────

/**
 * Initialize error monitoring.
 * Safe to call multiple times; subsequent calls are no-ops.
 * Never throws — monitoring failure must not affect business requests.
 */
export function initMonitoring(config: MonitoringConfig): void {
  if (initialized) return;

  if (!config.dsn || config.enabled === false) {
    logger.info('Error monitoring disabled (no DSN or explicitly disabled)');
    initialized = true;
    return;
  }

  try {
    Sentry.init({
      dsn: config.dsn,
      environment: config.environment || 'development',
      release: config.release,
      sampleRate: config.sampleRate ?? 1.0,
      tracesSampleRate: config.tracesSampleRate ?? 0.1,
      beforeSend: (event) => {
        // Redact sensitive data before sending
        if (event.request?.data) {
          event.request.data = redactSensitiveData(event.request.data) as any;
        }
        if (event.extra) {
          event.extra = redactSensitiveData(event.extra) as Record<string, unknown>;
        }
        return event;
      },
      integrations: [
        // Use default integrations
      ],
    });

    enabled = true;
    initialized = true;

    logger.info({
      environment: config.environment,
      release: config.release || 'unknown',
    }, 'Error monitoring initialized (Sentry)');
  } catch (error) {
    logger.warn({ err: error }, 'Failed to initialize error monitoring — continuing without monitoring');
    initialized = true;
  }
}

// ─── Capture Functions ─────────────────────────────────────────────

/**
 * Capture an exception with context.
 */
export function captureException(error: Error, context: ErrorContext = {}): string | null {
  if (!enabled) return null;

  try {
    // Get request context if available
    const reqCtx = getRequestContext();
    const traceCtx = getCurrentTraceContext();

    const eventId = Sentry.captureException(error, {
      tags: {
        service: 'pawtag-api',
        ...context.tags,
      },
      extra: {
        ...context.extra,
      },
      user: context.userId ? {
        id: context.userId,
        email: context.email,
      } : undefined,
      contexts: {
        request: {
          requestId: context.requestId || reqCtx?.requestId,
          correlationId: context.correlationId || reqCtx?.correlationId,
        },
        trace: {
          trace_id: context.traceId || traceCtx?.traceId || reqCtx?.traceId,
          span_id: traceCtx?.spanId,
        } as any,
        operation: {
          name: context.operation,
          feature: context.feature,
          workflow: context.workflow,
        },
      },
      level: context.severity || 'error',
    });

    return eventId;
  } catch {
    // Monitoring failure must not affect business requests
    return null;
  }
}

/**
 * Capture a message with context.
 */
export function captureMessage(message: string, context: ErrorContext = {}): string | null {
  if (!enabled) return null;

  try {
    const reqCtx = getRequestContext();
    const traceCtx = getCurrentTraceContext();

    const eventId = Sentry.captureMessage(message, {
      level: context.severity || 'info',
      tags: {
        service: 'pawtag-api',
        ...context.tags,
      },
      extra: {
        ...context.extra,
      },
      user: context.userId ? {
        id: context.userId,
        email: context.email,
      } : undefined,
      contexts: {
        request: {
          requestId: context.requestId || reqCtx?.requestId,
          correlationId: context.correlationId || reqCtx?.correlationId,
        },
        trace: {
          trace_id: context.traceId || traceCtx?.traceId || reqCtx?.traceId,
          span_id: traceCtx?.spanId,
        } as any,
      },
    });

    return eventId;
  } catch {
    return null;
  }
}

/**
 * Set user context for subsequent events.
 */
export function setUser(user: { id?: string; email?: string; username?: string }): void {
  if (!enabled) return;

  try {
    Sentry.setUser(user);
  } catch {
    // Silently ignore
  }
}

/**
 * Add breadcrumb for debugging trail.
 */
export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
  if (!enabled) return;

  try {
    Sentry.addBreadcrumb({
      category,
      message,
      data: data ? redactSensitiveData(data) as Record<string, unknown> : undefined,
      level: 'info',
    });
  } catch {
    // Silently ignore
  }
}

/**
 * Set tag for grouping events.
 */
export function setTag(key: string, value: string): void {
  if (!enabled) return;

  try {
    Sentry.setTag(key, value);
  } catch {
    // Silently ignore
  }
}

/**
 * Flush pending events (call before shutdown).
 */
export async function flushMonitoring(timeout = 2000): Promise<boolean> {
  if (!enabled) return true;

  try {
    return await Sentry.flush(timeout);
  } catch {
    return false;
  }
}

/**
 * Check if monitoring is enabled.
 */
export function isMonitoringEnabled(): boolean {
  return enabled;
}

export default {
  initMonitoring,
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
  setTag,
  flushMonitoring,
  isMonitoringEnabled,
};

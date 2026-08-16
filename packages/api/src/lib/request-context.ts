import { AsyncLocalStorage } from 'node:async_hooks';
import pino from 'pino';

/**
 * Async-safe request context for PawTag.
 *
 * Propagates request-scoped identifiers (requestId, correlationId, etc.)
 * to all downstream code without threading parameters through every call.
 *
 * Usage:
 *   import { requestContext, RequestContext } from '../lib/request-context';
 *   const ctx = requestContext.getStore();
 *   if (ctx) console.log(ctx.requestId);
 */

export interface RequestContext {
  requestId: string;
  correlationId: string;
  traceId: string;
  transactionId: string;
  startTime: number;
  method: string;
  route: string;
  service: string;
  environment: string;
  userId?: string;
  email?: string;
  ip?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request context (returns undefined if not in a request).
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Run a function within a request context.
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Create a child logger enriched with request context fields.
 * Returns the original logger if no request context is available.
 */
export function createContextLogger(logger: pino.Logger): pino.Logger {
  const ctx = asyncLocalStorage.getStore();
  if (!ctx) return logger;

  return logger.child({
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    traceId: ctx.traceId,
    method: ctx.method,
    route: ctx.route,
    ...(ctx.userId ? { userId: ctx.userId } : {}),
  });
}

export default { getRequestContext, runWithContext, createContextLogger };

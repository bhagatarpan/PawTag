/**
 * Tracing middleware for PawTag.
 *
 * Enriches request context with OpenTelemetry trace IDs
 * for correlation between logs, traces, and audit events.
 */

import { Request, Response, NextFunction } from 'express';
import { getCurrentTraceContext } from '../lib/tracing';

/**
 * Middleware that adds OpenTelemetry trace context to response headers.
 * Safe — never throws, tracing failure doesn't affect business requests.
 */
export function tracingMiddleware(_req: Request, res: Response, next: NextFunction): void {
  try {
    // Add trace context to response headers after response is sent
    res.on('finish', () => {
      try {
        const traceCtx = getCurrentTraceContext();
        if (traceCtx) {
          res.setHeader('X-OTel-Trace-Id', traceCtx.traceId);
          res.setHeader('X-OTel-Span-Id', traceCtx.spanId);
        }
      } catch {
        // Silently ignore — tracing failure must not affect response
      }
    });
  } catch {
    // Silently ignore — tracing failure must not affect business requests
  }

  next();
}

export default tracingMiddleware;

/**
 * Metrics middleware for PawTag.
 *
 * Automatically tracks HTTP request counts, durations, and status codes.
 */

import { Request, Response, NextFunction } from 'express';
import { incrementCounter, recordHistogram, METRICS } from '../lib/metrics';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = performance.now();

  // Capture response finish
  res.on('finish', () => {
    const duration = Math.round(performance.now() - start);
    const route = (req.route?.path || req.path || 'unknown').replace(/\/[a-f0-9]{24}/gi, '/:id');
    const method = req.method;
    const statusClass = `${Math.floor(res.statusCode / 100)}xx`;

    // Increment request counter
    incrementCounter(METRICS.HTTP_REQUESTS_TOTAL, {
      method,
      route,
      status: statusClass,
    });

    // Record request duration
    recordHistogram(METRICS.HTTP_REQUEST_DURATION_MS, duration);

    // Track errors (4xx and 5xx)
    if (res.statusCode >= 400) {
      incrementCounter(METRICS.HTTP_REQUEST_ERRORS_TOTAL, {
        method,
        route,
        status: statusClass,
      });
    }

    // Track HTTP status distribution
    incrementCounter(METRICS.HTTP_STATUS_DISTRIBUTION, {
      status: String(res.statusCode),
    });
  });

  next();
}

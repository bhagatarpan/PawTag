import type { Request, Response, NextFunction } from 'express';
import { getSiteAvailabilityStatus, checkMutationAllowed } from '../lib/site-availability';

/**
 * Middleware that enforces site availability state on public/customer/finder endpoints.
 * Admin endpoints are explicitly excluded from enforcement.
 */
export async function siteAvailabilityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Skip for admin API endpoints — admins must always be able to access
    if (req.path.startsWith('/admin') || req.path.startsWith('/auth')) {
      return next();
    }

    // Skip for health check, system status, and static files
    if (req.path === '/health' || req.path === '/public/system/status') {
      return next();
    }

    const status = await getSiteAvailabilityStatus();

    // ONLINE — no restrictions
    if (status === 'ONLINE') {
      return next();
    }

    // For GET/read-only requests during MAINTENANCE: allow browsing
    if (status === 'MAINTENANCE' && req.method === 'GET') {
      // Allow GET requests (read-only browsing) during maintenance
      // Block mutations (POST, PUT, PATCH, DELETE)
      return next();
    }

    // Check if mutation is allowed
    const result = checkMutationAllowed(status, false);
    if (result?.blocked) {
      res.status(result.statusCode).json(result.body);
      return;
    }

    next();
  } catch (err) {
    // On error, allow the request through (fail-open for availability checks)
    next();
  }
}

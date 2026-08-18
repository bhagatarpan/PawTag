import type { Request, Response, NextFunction } from 'express';
import { SiteAvailabilityStatus } from '@pawtag/shared';
import { getSiteAvailability } from '../lib/site-availability.service';

const EXEMPT_PATHS = [
  '/health',
  '/api/public/system/status',
  '/api/admin',
  '/api/auth',
  '/api/tags',
];

function isExemptPath(path: string): boolean {
  return EXEMPT_PATHS.some((exempt) => path.startsWith(exempt));
}

export async function siteAvailabilityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (isExemptPath(req.path)) {
      return next();
    }

    const availability = await getSiteAvailability();

    if (availability.status === SiteAvailabilityStatus.ONLINE) {
      return next();
    }

    if (availability.status === SiteAvailabilityStatus.OFFLINE) {
      res.status(503).json({
        success: false,
        error: availability.messages.offlineMessage,
        code: 'SITE_OFFLINE',
      });
      return;
    }

    // MAINTENANCE: allow read-only, block mutations
    if (availability.status === SiteAvailabilityStatus.MAINTENANCE) {
      const method = req.method.toUpperCase();
      if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
        return next();
      }

      res.status(503).json({
        success: false,
        error: availability.messages.maintenanceMessage,
        code: 'SITE_MAINTENANCE',
      });
      return;
    }

    next();
  } catch {
    // Fail-open: if availability check fails, allow the request through
    next();
  }
}

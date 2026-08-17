import { Router, Request, Response } from 'express';
import { getSiteAvailabilityStatus } from '../lib/site-availability';

const router = Router();

/**
 * Public endpoint for clients to discover the current site availability state.
 * This endpoint must remain accessible even when the site is Offline.
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await getSiteAvailabilityStatus();
    res.json({
      success: true,
      data: { status },
    });
  } catch {
    // On error, default to ONLINE (fail-open for status checks)
    res.json({
      success: true,
      data: { status: 'ONLINE' },
    });
  }
});

export default router;

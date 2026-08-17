import { Router, Request, Response } from 'express';
import { getSiteAvailabilityStatus } from '../lib/site-availability.service';
import logger from '../lib/logger';

const router = Router();

// GET /api/public/system/status — always accessible, no auth required
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await getSiteAvailabilityStatus();
    res.json({ success: true, data: { status } });
  } catch (err) {
    logger.error({ err }, 'Failed to get system status');
    // Fail-open: default to ONLINE if status check fails
    res.json({ success: true, data: { status: 'ONLINE' } });
  }
});

export default router;

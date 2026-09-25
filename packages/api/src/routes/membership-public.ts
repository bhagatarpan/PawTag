import { Router, Request, Response } from 'express';
import { MembershipTier } from '@pawtag/db';
import logger from '../lib/logger';

const router = Router();

/**
 * GET /api/public/membership/tiers
 * Public endpoint for landing page — list active tiers
 */
router.get('/tiers', async (_req: Request, res: Response) => {
  try {
    const tiers = await MembershipTier.find({ isActive: true })
      .select('tier name displayName description price currency benefits icon color gradient displayOrder')
      .sort({ displayOrder: 1 })
      .lean();
    res.json({ success: true, data: tiers });
  } catch (error: any) {
    logger.error({ err: error }, '[Membership Public] Failed to fetch tiers');
    res.status(500).json({ success: false, error: 'Failed to fetch membership tiers' });
  }
});

/**
 * GET /api/public/membership/tiers/:tierId
 * Public endpoint — get tier details
 */
router.get('/tiers/:tierId', async (req: Request, res: Response) => {
  try {
    const tier = await MembershipTier.findById(req.params.tierId)
      .select('tier name displayName description price currency benefits icon color gradient')
      .lean();
    
    if (!tier) {
      res.status(404).json({ success: false, error: 'Tier not found' });
      return;
    }

    res.json({ success: true, data: tier });
  } catch (error: any) {
    logger.error({ err: error }, '[Membership Public] Failed to fetch tier');
    res.status(500).json({ success: false, error: 'Failed to fetch tier details' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { MembershipTier } from '@pawtag/db';
import { membershipEntitlementService } from '../services/membership-entitlement.service';
import logger from '../lib/logger';

const router = Router();

/**
 * GET /api/public/membership/tiers
 * Public endpoint for landing page — list active tiers with entitlements
 */
router.get('/tiers', async (_req: Request, res: Response) => {
  try {
    const tiers = await MembershipTier.find({ isActive: true })
      .select('tier name displayName description price currency icon color gradient displayOrder tagLimit comingSoon')
      .sort({ displayOrder: 1 })
      .lean();

    // Enrich each tier with entitlements from the registry
    const enrichedTiers = await Promise.all(tiers.map(async (tier) => {
      const entitlements = await membershipEntitlementService.getTierEntitlements(tier.tier);
      return { ...tier, entitlements };
    }));

    res.json({ success: true, data: enrichedTiers });
  } catch (error: any) {
    logger.error({ err: error }, '[Membership Public] Failed to fetch tiers');
    res.status(500).json({ success: false, error: 'Failed to fetch membership tiers' });
  }
});

/**
 * GET /api/public/membership/tiers/:tierId
 * Public endpoint — get tier details with entitlements
 */
router.get('/tiers/:tierId', async (req: Request, res: Response) => {
  try {
    const tier = await MembershipTier.findById(req.params.tierId)
      .select('tier name displayName description price currency icon color gradient tagLimit comingSoon')
      .lean();
    
    if (!tier) {
      res.status(404).json({ success: false, error: 'Tier not found' });
      return;
    }

    // Enrich with entitlements from the registry
    const entitlements = await membershipEntitlementService.getTierEntitlements(tier.tier);

    res.json({ success: true, data: { ...tier, entitlements } });
  } catch (error: any) {
    logger.error({ err: error }, '[Membership Public] Failed to fetch tier');
    res.status(500).json({ success: false, error: 'Failed to fetch tier details' });
  }
});

export default router;

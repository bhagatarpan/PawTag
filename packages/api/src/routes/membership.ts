import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { UserMembership, MembershipTier, User, Tag } from '@pawtag/db';
import {
  getMembershipTiers,
  getUserMembershipStatus,
  subscribeToTier,
  activateMembership,
  cancelMembership,
  changeTier,
  checkTagAccess,
} from '../services/membership.service';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

/**
 * GET /api/membership/tiers
 * List available membership tiers
 */
router.get('/tiers', async (_req: AuthRequest, res: Response) => {
  try {
    const tiers = await getMembershipTiers();
    res.json({ success: true, data: tiers });
  } catch (error: any) {
    logger.error({ err: error }, '[Membership] Failed to fetch tiers');
    res.status(500).json({ success: false, error: 'Failed to fetch membership tiers' });
  }
});

/**
 * GET /api/membership/status
 * Get current user's membership status
 */
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const status = await getUserMembershipStatus(req.user!.id);
    res.json({ success: true, data: status });
  } catch (error: any) {
    logger.error({ err: error }, '[Membership] Failed to fetch status');
    res.status(500).json({ success: false, error: 'Failed to fetch membership status' });
  }
});

/**
 * POST /api/membership/subscribe
 * Subscribe to a membership tier
 */
router.post('/subscribe', async (req: AuthRequest, res: Response) => {
  try {
    const { tierId, paymentMethodId } = req.body;
    if (!tierId) {
      res.status(400).json({ success: false, error: 'tierId is required' });
      return;
    }

    const result = await subscribeToTier(req.user!.id, tierId, paymentMethodId);
    res.json({
      success: true,
      data: {
        membership: result.membership,
        clientSecret: result.clientSecret,
        message: 'Membership subscription created. Complete payment to activate.',
      },
    });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Membership] Subscribe error');
    res.status(400).json({ success: false, error: error.message || 'Failed to subscribe' });
  }
});

/**
 * POST /api/membership/activate
 * Activate membership after payment (called by webhook or frontend)
 */
router.post('/activate', async (req: AuthRequest, res: Response) => {
  try {
    const { membershipId } = req.body;
    if (!membershipId) {
      res.status(400).json({ success: false, error: 'membershipId is required' });
      return;
    }

    // Verify ownership
    const membership = await UserMembership.findOne({
      _id: membershipId,
      userId: req.user!.id,
    });
    if (!membership) {
      res.status(404).json({ success: false, error: 'Membership not found' });
      return;
    }

    const activated = await activateMembership(membershipId);
    res.json({ success: true, data: activated });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Membership] Activate error');
    res.status(500).json({ success: false, error: error.message || 'Failed to activate membership' });
  }
});

/**
 * POST /api/membership/cancel
 * Cancel membership
 */
router.post('/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const cancelled = await cancelMembership(req.user!.id, reason);
    res.json({ success: true, data: cancelled });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Membership] Cancel error');
    res.status(400).json({ success: false, error: error.message || 'Failed to cancel membership' });
  }
});

/**
 * POST /api/membership/change-tier
 * Change membership tier
 */
router.post('/change-tier', async (req: AuthRequest, res: Response) => {
  try {
    const { tierId } = req.body;
    if (!tierId) {
      res.status(400).json({ success: false, error: 'tierId is required' });
      return;
    }

    const updated = await changeTier(req.user!.id, tierId);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Membership] Change tier error');
    res.status(400).json({ success: false, error: error.message || 'Failed to change tier' });
  }
});

/**
 * GET /api/membership/tags
 * Get user's tags with access status
 */
router.get('/tags', async (req: AuthRequest, res: Response) => {
  try {
    const tags = await Tag.find({ ownerId: req.user!.id, deletedAt: null });
    const tagsWithAccess = await Promise.all(
      tags.map(async (tag) => {
        const access = await checkTagAccess(tag._id.toString());
        return {
          ...tag.toObject(),
          access,
        };
      })
    );
    res.json({ success: true, data: tagsWithAccess });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Membership] Failed to fetch tags');
    res.status(500).json({ success: false, error: 'Failed to fetch tags' });
  }
});

export default router;

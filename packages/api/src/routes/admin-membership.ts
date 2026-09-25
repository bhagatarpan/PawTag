import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { UserMembership, MembershipTier, User, Tag } from '@pawtag/db';
import { extendMembership } from '../services/membership.service';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

/**
 * GET /api/admin/membership/tiers
 * List all membership tiers (including inactive)
 */
router.get('/tiers', requirePermission('setting.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const tiers = await MembershipTier.find().sort({ displayOrder: 1 }).lean();
    res.json({ success: true, data: tiers });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Membership] Failed to fetch tiers');
    res.status(500).json({ success: false, error: 'Failed to fetch tiers' });
  }
});

/**
 * PUT /api/admin/membership/tiers/:tierId
 * Update membership tier configuration
 */
router.put('/tiers/:tierId', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { tierId } = req.params;
    const updates = req.body;

    // Prevent changing the tier identifier
    delete updates.tier;
    delete updates._id;

    const tier = await MembershipTier.findByIdAndUpdate(tierId, updates, { new: true });
    if (!tier) {
      res.status(404).json({ success: false, error: 'Tier not found' });
      return;
    }

    res.json({ success: true, data: tier });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Membership] Failed to update tier');
    res.status(500).json({ success: false, error: 'Failed to update tier' });
  }
});

/**
 * GET /api/admin/membership/subscribers
 * List all members with filtering
 */
router.get('/subscribers', requirePermission('subscription.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { tier, status, search, page = 1, limit = 50 } = req.query;
    
    const filter: any = {};
    if (tier) filter['tierId'] = tier;
    if (status) filter.status = status;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    let query = UserMembership.find(filter)
      .populate('tierId', 'tier displayName price')
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    const [memberships, total] = await Promise.all([
      query.lean(),
      UserMembership.countDocuments(filter),
    ]);
    
    res.json({
      success: true,
      data: {
        memberships,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Membership] Failed to fetch subscribers');
    res.status(500).json({ success: false, error: 'Failed to fetch subscribers' });
  }
});

/**
 * GET /api/admin/membership/subscribers/:membershipId
 * Get member details
 */
router.get('/subscribers/:membershipId', requirePermission('subscription.read'), async (req: AuthRequest, res: Response) => {
  try {
    const membership = await UserMembership.findById(req.params.membershipId)
      .populate('tierId')
      .populate('userId', 'fullName email phoneNumber emergencyContact');
    
    if (!membership) {
      res.status(404).json({ success: false, error: 'Membership not found' });
      return;
    }

    // Get user's tags
    const tags = await Tag.find({ ownerId: (membership.userId as any)._id, deletedAt: null });
    
    res.json({ success: true, data: { membership, tags } });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Membership] Failed to fetch subscriber');
    res.status(500).json({ success: false, error: 'Failed to fetch subscriber' });
  }
});

/**
 * POST /api/admin/membership/extend
 * Extend membership or tag warranty
 */
router.post('/extend', requirePermission('subscription.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { membershipId, extensionType, extensionDays } = req.body;
    
    if (!membershipId || !extensionType) {
      res.status(400).json({ success: false, error: 'membershipId and extensionType are required' });
      return;
    }

    if (!['charge', 'grace'].includes(extensionType)) {
      res.status(400).json({ success: false, error: 'extensionType must be "charge" or "grace"' });
      return;
    }

    const extended = await extendMembership(
      membershipId,
      req.user!.id,
      extensionType,
      extensionDays || 30
    );

    res.json({ success: true, data: extended });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Membership] Failed to extend membership');
    res.status(400).json({ success: false, error: error.message || 'Failed to extend membership' });
  }
});

/**
 * GET /api/admin/membership/stats
 * Get membership statistics
 */
router.get('/stats', requirePermission('stats.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const [totalMembers, activeMembers, tierDistribution, recentActivity] = await Promise.all([
      UserMembership.countDocuments(),
      UserMembership.countDocuments({ status: 'active' }),
      UserMembership.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$tierId', count: { $sum: 1 } } },
        { $lookup: { from: 'membershiptiers', localField: '_id', foreignField: '_id', as: 'tier' } },
        { $unwind: '$tier' },
        { $project: { tier: '$tier.tier', displayName: '$tier.displayName', count: 1 } },
      ]),
      UserMembership.find()
        .populate('tierId', 'tier displayName')
        .populate('userId', 'fullName email')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        totalMembers,
        activeMembers,
        tierDistribution,
        recentActivity,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Membership] Failed to fetch stats');
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

export default router;

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { User, Setting, Subscription } from '@pawtag/db';
import { auditService, type AuditContext } from '../services/audit';
import { createAuditContextFromRequest, type AuditRequest } from '../middleware/audit';
import { guardianSettingsSchema, membersQuerySchema, activityQuerySchema } from '../validation/loyalty';
import { clearGuardianCache } from '../services/loyalty/guardian-config';
import logger from '../lib/logger';

const router = Router();

async function auditAdminGuardianEvent(
  req: AuditRequest,
  input: Parameters<typeof auditService.log>[1],
  overrides: Partial<AuditContext> = {},
): Promise<void> {
  const reqContext = req.auditContext as AuditContext;
  if (!reqContext) {
    throw new Error('Audit middleware not applied - request has no audit context');
  }
  const context: AuditContext = {
    ...reqContext,
    ...overrides,
  } as AuditContext;
  await auditService.log(context, input);
}

// All admin routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/admin/guardian/stats:
 *   get:
 *     tags: [Admin - Guardian]
 *     summary: Get Guardian program statistics
 *     description: 'Returns aggregate Guardian stats: total members, tier distribution, total points earned, total rewards allocated.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Guardian stats
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.get('/stats', requirePermission('setting.read'), async (req: AuthRequest, res: Response) => {
  try {
    // Get total Guardian members
    const totalMembers = await User.countDocuments({ guardianTier: { $exists: true, $ne: null } });

    // Get tier distribution
    const tierDistribution = await User.aggregate([
      { $match: { guardianTier: { $exists: true, $ne: null } } },
      { $group: { _id: '$guardianTier', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Get total points earned
    const totalPointsResult = await User.aggregate([
      { $match: { guardianPoints: { $exists: true, $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$guardianPoints' } } },
    ]);
    const totalPointsEarned = totalPointsResult[0]?.total || 0;

    // Get total rewards allocated
    const totalRewardsResult = await User.aggregate([
      { $match: { pawRewardsTotalEarned: { $exists: true, $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$pawRewardsTotalEarned' } } },
    ]);
    const totalRewardsAllocated = totalRewardsResult[0]?.total || 0;

    // Get total rewards redeemed
    const totalRedeemedResult = await User.aggregate([
      { $match: { pawRewardsTotalRedeemed: { $exists: true, $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$pawRewardsTotalRedeemed' } } },
    ]);
    const totalRewardsRedeemed = totalRedeemedResult[0]?.total || 0;

    // Get Gold members (active monthly subscription at Gold price)
    const goldPriceSetting = await Setting.findOne({ key: 'guardian.goldPrice' }).lean();
    const goldPrice = parseFloat(goldPriceSetting?.value || '1.99');
    const goldMembersResult = await Subscription.aggregate([
      { $match: { status: 'active', planType: 'monthly', price: goldPrice } },
      { $group: { _id: '$userId' } },
      { $count: 'total' },
    ]);
    const goldMembers = goldMembersResult[0]?.total || 0;

    await auditAdminGuardianEvent(req, {
      action: 'guardian_stats_viewed',
      eventType: 'ADMIN_ACTION',
      eventCategory: 'READ',
      operationType: 'READ',
      resourceType: 'GUARDIAN',
      severity: 'LOW',
    });

    res.json({
      success: true,
      data: {
        totalMembers,
        tierDistribution: tierDistribution.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<string, number>),
        totalPointsEarned,
        totalRewardsAllocated,
        totalRewardsRedeemed,
        goldMembers,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get Guardian stats');
    res.status(500).json({ success: false, error: 'Failed to get Guardian stats' });
  }
});

/**
 * @swagger
 * /api/admin/guardian/members:
 *   get:
 *     tags: [Admin - Guardian]
 *     summary: Get Guardian members list
 *     description: 'Returns paginated list of Guardian members with filtering and search.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: tier
 *         schema:
 *           type: string
 *           enum: [CARE, NURTURE, PROTECTOR, SAFEGUARD]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Guardian members list
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.get('/members', requirePermission('setting.read'), async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const tier = req.query.tier as string;
    const membership = req.query.membership as string;
    const search = req.query.search as string;

    const query: any = { guardianTier: { $exists: true, $ne: null } };

    if (tier) {
      query.guardianTier = tier;
    }

    // Membership filter via Subscription collection (Gold = active monthly $1.99)
    if (membership === 'gold' || membership === 'guardian') {
      const goldSubs = await Subscription.find({
        status: 'active',
        planType: 'monthly',
        price: 1.99,
      }).select('userId').lean();
      const goldIds = goldSubs.map(s => s.userId);
      query._id = membership === 'gold' ? { $in: goldIds } : { $nin: goldIds };
    }

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
      ];
    }

    const members = await User.find(query)
      .select('email fullName guardianTier guardianPoints pawRewardsBalance createdAt')
      .sort({ guardianPoints: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await User.countDocuments(query);

    // Enrich with Gold membership status from Subscription collection
    const goldPriceSetting = await Setting.findOne({ key: 'guardian.goldPrice' }).lean();
    const goldPrice = parseFloat(goldPriceSetting?.value || '1.99');
    const memberIds = members.map(m => m._id);
    const goldSubscriptions = await Subscription.find({
      userId: { $in: memberIds },
      status: 'active',
      planType: 'monthly',
      price: goldPrice,
    }).select('userId').lean();
    const goldUserIds = new Set(goldSubscriptions.map(s => s.userId.toString()));
    const enrichedMembers = members.map(m => ({
      ...m,
      isGoldMember: goldUserIds.has(m._id.toString()),
    }));

    await auditAdminGuardianEvent(req, {
      action: 'guardian_members_viewed',
      eventType: 'ADMIN_ACTION',
      eventCategory: 'READ',
      operationType: 'READ',
      resourceType: 'GUARDIAN',
      severity: 'LOW',
    });

    res.json({
      success: true,
      data: {
        members: enrichedMembers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get Guardian members');
    res.status(500).json({ success: false, error: 'Failed to get Guardian members' });
  }
});

/**
 * @swagger
 * /api/admin/guardian/activity:
 *   get:
 *     tags: [Admin - Guardian]
 *     summary: Get recent Guardian activity
 *     description: 'Returns recent points earning and redemption activity across all Guardian members.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Recent Guardian activity
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.get('/activity', requirePermission('setting.read'), async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    // Import models dynamically to avoid circular dependencies
    const { GuardianPointsLedger } = require('@pawtag/db');
    const { PawRewardsLedger } = require('@pawtag/db');

    // Get recent points activity
    const recentPoints = await GuardianPointsLedger.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('userId', 'email fullName')
      .lean();

    // Get recent rewards activity
    const recentRewards = await PawRewardsLedger.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('userId', 'email fullName')
      .lean();

    // Combine and sort by date
    const activity = [
      ...recentPoints.map((item: any) => ({
        type: 'points',
        ...item,
      })),
      ...recentRewards.map((item: any) => ({
        type: 'rewards',
        ...item,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    await auditAdminGuardianEvent(req, {
      action: 'guardian_activity_viewed',
      eventType: 'ADMIN_ACTION',
      eventCategory: 'READ',
      operationType: 'READ',
      resourceType: 'GUARDIAN',
      severity: 'LOW',
    });

    res.json({
      success: true,
      data: { activity },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get Guardian activity');
    res.status(500).json({ success: false, error: 'Failed to get Guardian activity' });
  }
});

/**
 * @swagger
 * /api/admin/guardian/settings:
 *   get:
 *     tags: [Admin - Guardian]
 *     summary: Get Guardian settings
 *     description: 'Returns all Guardian program settings.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Guardian settings
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.get('/settings', requirePermission('setting.read'), async (req: AuthRequest, res: Response) => {
  try {
    // Get all guardian.* settings from the database
    const settings = await Setting.find({ key: { $regex: '^guardian\.' } }).lean();

    const guardianSettings: Record<string, any> = {};
    for (const setting of settings) {
      const key = setting.key.replace('guardian.', '');
      guardianSettings[key] = setting.value;
    }

    await auditAdminGuardianEvent(req, {
      action: 'guardian_settings_viewed',
      eventType: 'ADMIN_ACTION',
      eventCategory: 'READ',
      operationType: 'READ',
      resourceType: 'GUARDIAN',
      severity: 'LOW',
    });

    res.json({
      success: true,
      data: guardianSettings,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get Guardian settings');
    res.status(500).json({ success: false, error: 'Failed to get Guardian settings' });
  }
});

/**
 * @swagger
 * /api/admin/guardian/settings:
 *   put:
 *     tags: [Admin - Guardian]
 *     summary: Update Guardian settings
 *     description: 'Updates Guardian program settings. Requires admin role.'
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               purchaseRateGuardian:
 *                 type: number
 *               purchaseRateGold:
 *                 type: number
 *               tierThresholdNurture:
 *                 type: number
 *               tierThresholdProtector:
 *                 type: number
 *               tierThresholdSafeguard:
 *                 type: number
 *               pawRewardsCare:
 *                 type: number
 *               pawRewardsNurture:
 *                 type: number
 *               pawRewardsProtector:
 *                 type: number
 *               pawRewardsSafeguard:
 *                 type: number
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient permissions
 */
router.put('/settings', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const updates = req.body;

    const parsed = guardianSettingsSchema.safeParse(updates);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid settings',
      });
    }

    // Update each setting in the database
    for (const [key, value] of Object.entries(parsed.data)) {
      await Setting.findOneAndUpdate(
        { key: `guardian.${key}` },
        { value: String(value), updatedAt: new Date() },
        { upsert: true }
      );
    }

    // Clear in-memory cache so services pick up new values
    clearGuardianCache();

    await auditAdminGuardianEvent(req, {
      action: 'guardian_settings_updated',
      eventType: 'ADMIN_ACTION',
      eventCategory: 'UPDATE',
      operationType: 'UPDATE',
      resourceType: 'GUARDIAN',
      severity: 'MEDIUM',
      metadata: { updatedKeys: Object.keys(updates) },
    });

    res.json({
      success: true,
      message: 'Guardian settings updated successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update Guardian settings');
    res.status(500).json({ success: false, error: 'Failed to update Guardian settings' });
  }
});

export default router;

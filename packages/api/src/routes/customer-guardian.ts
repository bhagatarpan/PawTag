import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { User, Subscription } from '@pawtag/db';
import { auditService, type AuditContext } from '../services/audit';
import { createAuditContextFromRequest, type AuditRequest } from '../middleware/audit';
import { createDbRateLimiter } from '../lib/rate-limiter';
import { redeemRewardsSchema, paginationQuerySchema } from '../validation/loyalty';
import logger from '../lib/logger';

const router = Router();

// Rate limiters
const redeemRateLimiter = createDbRateLimiter({
  settingKey: 'rateLimit.guardian.redeem.max',
  defaultValue: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many redemption attempts. Please try again later.',
});

async function auditCustomerGuardianEvent(
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

// All customer routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/customer/guardian/points:
 *   get:
 *     tags: [Customer - Guardian]
 *     summary: Get Guardian points balance and history
 *     description: 'Returns the authenticated user\'s Guardian points balance and recent history.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Guardian points data
 *       401:
 *         description: Not authenticated
 */
router.get('/points', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const user = await User.findById(userId)
      .select('guardianPoints guardianTier pawRewardsBalance')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Import model dynamically to avoid circular dependencies
    const { GuardianPointsLedger } = require('@pawtag/db');

    const recentHistory = await GuardianPointsLedger.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Get tier benefits and next tier info
    const { getTierBenefits, TIER_THRESHOLDS } = require('../services/loyalty/tier.service');
    type TierName = 'CARE' | 'NURTURE' | 'PROTECTOR' | 'SAFEGUARD';
    const tier = (user.guardianTier || 'CARE') as TierName;
    const benefits = await getTierBenefits(tier);

    // Calculate next tier and points needed
    const tierOrder: TierName[] = ['CARE', 'NURTURE', 'PROTECTOR', 'SAFEGUARD'];
    const currentIndex = tierOrder.indexOf(tier);
    const nextTier = currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null;
    const pointsToNextTier = nextTier ? (TIER_THRESHOLDS[nextTier].min - (user.guardianPoints || 0)) : null;

    await auditCustomerGuardianEvent(req, {
      action: 'guardian_points_viewed',
      eventType: 'CUSTOMER_ACTION',
      eventCategory: 'READ',
      operationType: 'READ',
      resourceType: 'GUARDIAN',
      severity: 'LOW',
    });

    res.json({
      success: true,
      data: {
        points: user.guardianPoints || 0,
        tier,
        currentTier: tier,
        pawRewardsBalance: user.pawRewardsBalance || 0,
        recentHistory,
        benefits,
        pointsToNextTier: pointsToNextTier !== null ? Math.max(0, pointsToNextTier) : null,
        nextTier,
        displayName: benefits.displayName,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get Guardian points');
    res.status(500).json({ success: false, error: 'Failed to get Guardian points' });
  }
});

/**
 * @swagger
 * /api/customer/guardian/rewards:
 *   get:
 *     tags: [Customer - Guardian]
 *     summary: Get PawRewards balance and history
 *     description: 'Returns the authenticated user\'s PawRewards balance and recent history.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: PawRewards data
 *       401:
 *         description: Not authenticated
 */
router.get('/rewards', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const user = await User.findById(userId)
      .select('pawRewardsBalance pawRewardsTotalEarned pawRewardsTotalRedeemed pawRewardsTotalExpired guardianTier')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Import model dynamically to avoid circular dependencies
    const { PawRewardsLedger } = require('@pawtag/db');

    const recentHistory = await PawRewardsLedger.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    await auditCustomerGuardianEvent(req, {
      action: 'guardian_rewards_viewed',
      eventType: 'CUSTOMER_ACTION',
      eventCategory: 'READ',
      operationType: 'READ',
      resourceType: 'GUARDIAN',
      severity: 'LOW',
    });

    res.json({
      success: true,
      data: {
        balance: user.pawRewardsBalance || 0,
        totalEarned: user.pawRewardsTotalEarned || 0,
        totalRedeemed: user.pawRewardsTotalRedeemed || 0,
        totalExpired: user.pawRewardsTotalExpired || 0,
        tier: user.guardianTier || 'CARE',
        recentHistory,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get PawRewards');
    res.status(500).json({ success: false, error: 'Failed to get PawRewards' });
  }
});

/**
 * @swagger
 * /api/customer/guardian/rewards/redeem:
 *   post:
 *     tags: [Customer - Guardian]
 *     summary: Redeem PawRewards
 *     description: 'Redeems PawRewards for a purchase. Minimum $2 redemption required.'
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 2
 *                 description: Amount to redeem in NZD
 *               orderId:
 *                 type: string
 *                 description: Optional order ID to apply redemption to
 *     responses:
 *       200:
 *         description: Redemption successful
 *       400:
 *         description: Invalid amount or insufficient balance
 *       401:
 *         description: Not authenticated
 */
router.post('/rewards/redeem', redeemRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { amount, orderId } = req.body;

    const parsed = redeemRewardsSchema.safeParse({ amount, orderId });
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid input',
      });
    }

    const { redeemRewards } = require('../services/loyalty/pawrewards.service');
    const result = await redeemRewards(userId, parsed.data.amount, parsed.data.orderId);

    await auditCustomerGuardianEvent(req, {
      action: 'guardian_rewards_redeemed',
      eventType: 'CUSTOMER_ACTION',
      eventCategory: 'UPDATE',
      operationType: 'UPDATE',
      resourceType: 'GUARDIAN',
      severity: 'MEDIUM',
      metadata: { amount, orderId },
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to redeem PawRewards');
    res.status(400).json({ success: false, error: error.message || 'Failed to redeem PawRewards' });
  }
});

/**
 * @swagger
 * /api/customer/guardian/history:
 *   get:
 *     tags: [Customer - Guardian]
 *     summary: Get combined Guardian activity history
 *     description: 'Returns combined points and rewards activity history.'
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
 *         description: Activity history
 *       401:
 *         description: Not authenticated
 */
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const limitParsed = paginationQuerySchema.safeParse({ limit: req.query.limit });
    const limit = limitParsed.success ? limitParsed.data.limit : 50;

    // Import models dynamically to avoid circular dependencies
    const { GuardianPointsLedger } = require('@pawtag/db');
    const { PawRewardsLedger } = require('@pawtag/db');

    // Get recent points activity
    const recentPoints = await GuardianPointsLedger.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Get recent rewards activity
    const recentRewards = await PawRewardsLedger.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Combine and sort by date
    const history = [
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

    await auditCustomerGuardianEvent(req, {
      action: 'guardian_history_viewed',
      eventType: 'CUSTOMER_ACTION',
      eventCategory: 'READ',
      operationType: 'READ',
      resourceType: 'GUARDIAN',
      severity: 'LOW',
    });

    res.json({
      success: true,
      data: { history },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get Guardian history');
    res.status(500).json({ success: false, error: 'Failed to get Guardian history' });
  }
});

/**
 * @swagger
 * /api/customer/guardian/tier:
 *   get:
 *     tags: [Customer - Guardian]
 *     summary: Get Guardian tier information
 *     description: 'Returns the user\'s current tier, progress to next tier, and benefits.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Guardian tier data
 *       401:
 *         description: Not authenticated
 */
router.get('/tier', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const user = await User.findById(userId)
      .select('guardianPoints guardianTier')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Import tier service dynamically to avoid circular dependencies
    const { calculateTier } = require('../services/loyalty/tier.service');

    const tierInfo = await calculateTier(userId);
    const benefits = tierInfo.benefits;

    // Check Gold membership
    const goldSubscription = await Subscription.findOne({
      userId,
      status: 'active',
      planType: 'gold',
    }).lean();
    const isGoldMember = !!goldSubscription;

    await auditCustomerGuardianEvent(req, {
      action: 'guardian_tier_viewed',
      eventType: 'CUSTOMER_ACTION',
      eventCategory: 'READ',
      operationType: 'READ',
      resourceType: 'GUARDIAN',
      severity: 'LOW',
    });

    res.json({
      success: true,
      data: {
        currentTier: user.guardianTier || 'CARE',
        points: user.guardianPoints || 0,
        nextTier: tierInfo.nextTier,
        pointsToNextTier: tierInfo.pointsToNextTier,
        benefits,
        isGoldMember,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get Guardian tier');
    res.status(500).json({ success: false, error: 'Failed to get Guardian tier' });
  }
});

/**
 * @swagger
 * /api/customer/guardian/benefits:
 *   get:
 *     tags: [Customer - Guardian]
 *     summary: Get Gold benefits information
 *     description: 'Returns Gold membership benefits and status.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gold benefits data
 *       401:
 *         description: Not authenticated
 */
router.get('/benefits', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const { Subscription } = require('@pawtag/db');
    
    const goldSubscription = await Subscription.findOne({
      userId,
      status: 'active',
      planType: 'monthly',
      price: 1.99,
    }).lean();

    const isGoldMember = !!goldSubscription;
    
    const benefits = [
      'Free shipping on orders over $50',
      'Priority customer support',
      'Early access to new products',
      'Double points on all purchases',
      'Nurture tier starting point (100 bonus points)',
    ];

    await auditCustomerGuardianEvent(req, {
      action: 'guardian_benefits_viewed',
      eventType: 'CUSTOMER_ACTION',
      eventCategory: 'READ',
      operationType: 'READ',
      resourceType: 'GUARDIAN',
      severity: 'LOW',
    });

    res.json({
      success: true,
      data: {
        isGoldMember,
        benefits,
        nextBillingDate: goldSubscription?.currentPeriodEnd,
        monthlyPrice: 1.99,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get Gold benefits');
    res.status(500).json({ success: false, error: 'Failed to get Gold benefits' });
  }
});

export default router;

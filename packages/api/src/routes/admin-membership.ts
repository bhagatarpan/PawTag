import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { UserMembership, MembershipTier, Tag } from '@pawtag/db';
import { extendMembership, changeTier, cancelMembership } from '../services/membership.service';
import { auditService } from '../services/audit';
import { Setting } from '@pawtag/db';
import {
  getAllMembershipRetentionSettings,
  clearMembershipConfigCache,
  MEMBERSHIP_RETENTION_DEFAULTS,
} from '../services/membership-config';
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
 * POST /api/admin/membership/tiers
 * Create a new membership tier
 */
router.post('/tiers', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { tier, name, displayName, description, price, tagLimit, icon, color, gradient, displayOrder } = req.body;

    // Validate required fields
    if (!tier || !name || !displayName || !description || price === undefined || tagLimit === undefined) {
      res.status(400).json({ success: false, error: 'tier, name, displayName, description, price, and tagLimit are required' });
      return;
    }

    // Check if tier identifier already exists
    const existing = await MembershipTier.findOne({ tier: tier.toLowerCase() });
    if (existing) {
      res.status(409).json({ success: false, error: 'A tier with this identifier already exists' });
      return;
    }

    // Create the tier
    const newTier = await MembershipTier.create({
      tier: tier.toLowerCase(),
      name,
      displayName,
      description,
      price,
      tagLimit,
      icon: icon || 'Crown',
      color: color || '#F59E0B',
      gradient: gradient || 'from-yellow-400 to-amber-500',
      displayOrder: displayOrder || 0,
      isActive: true,
    });

    // Auto-create entitlement entries for the new tier
    try {
      const { membershipEntitlementService } = await import('../services/membership-entitlement.service');
      // Invalidate cache so the new tier appears in the matrix
      membershipEntitlementService.invalidateCache();
    } catch (err) {
      logger.error({ err }, '[Admin Membership] Failed to invalidate entitlement cache after tier creation');
    }

    logger.info({ tierId: newTier._id, tier: newTier.tier }, '[Admin Membership] Tier created');
    res.status(201).json({ success: true, data: newTier });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Membership] Failed to create tier');
    res.status(500).json({ success: false, error: error.message || 'Failed to create tier' });
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
    const { tier, status, _search, page = 1, limit = 50 } = req.query;
    
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

/**
 * POST /api/admin/membership/change-tier
 * Admin-initiated tier change with required evidence
 */
router.post('/change-tier', requirePermission('subscription.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { membershipId, newTierId, evidence } = req.body;

    if (!membershipId || !newTierId || !evidence) {
      res.status(400).json({ success: false, error: 'membershipId, newTierId, and evidence are required' });
      return;
    }

    // Validate required evidence fields
    const { customerEmailDate, customerEmailContent, actionRequired, reason, csrFullName } = evidence;
    if (!customerEmailDate || !customerEmailContent || !actionRequired || !reason || !csrFullName) {
      res.status(400).json({
        success: false,
        error: 'Evidence must include: customerEmailDate, customerEmailContent, actionRequired, reason, csrFullName',
      });
      return;
    }

    // Verify membership exists
    const membership = await UserMembership.findById(membershipId);
    if (!membership) {
      res.status(404).json({ success: false, error: 'Membership not found' });
      return;
    }

    // Perform tier change
    const updated = await changeTier(membership.userId.toString(), newTierId);

    // Log admin-initiated audit event with full evidence
    await auditService.log({
      requestId: req.auditContext?.requestId || 'admin-membership',
      correlationId: req.auditContext?.correlationId || 'admin-membership',
      traceId: req.auditContext?.traceId || 'admin-membership',
      transactionId: req.auditContext?.transactionId || 'admin-membership',
      sourceIp: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      applicationName: 'pawtag-api',
      applicationVersion: '1.0.0',
      apiVersion: 'v1',
      environment: process.env.NODE_ENV || 'development',
      actorType: 'CSR',
      actorId: req.user!.id,
      actorUsername: req.user!.email,
    }, {
      action: 'membership_tier_changed_by_admin',
      eventType: 'membership.tier_changed',
      eventCategory: 'FINANCIAL',
      operationType: 'UPDATE',
      resourceType: 'UserMembership',
      resourceId: membershipId,
      outcome: 'SUCCESS',
      severity: 'HIGH',
      metadata: {
        userId: membership.userId.toString(),
        membershipId,
        newTierId,
        evidence: {
          customerEmailDate,
          customerEmailContent,
          actionRequired,
          reason,
          csrFullName,
          csrNotes: evidence.csrNotes || '',
        },
      },
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Admin Membership] Change tier error');
    res.status(400).json({ success: false, error: error.message || 'Failed to change tier' });
  }
});

/**
 * POST /api/admin/membership/cancel
 * Admin-initiated cancellation with required evidence
 */
router.post('/cancel', requirePermission('subscription.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { membershipId, evidence } = req.body;

    if (!membershipId || !evidence) {
      res.status(400).json({ success: false, error: 'membershipId and evidence are required' });
      return;
    }

    // Validate required evidence fields
    const { customerEmailDate, customerEmailContent, actionRequired, reason, csrFullName } = evidence;
    if (!customerEmailDate || !customerEmailContent || !actionRequired || !reason || !csrFullName) {
      res.status(400).json({
        success: false,
        error: 'Evidence must include: customerEmailDate, customerEmailContent, actionRequired, reason, csrFullName',
      });
      return;
    }

    // Verify membership exists
    const membership = await UserMembership.findById(membershipId);
    if (!membership) {
      res.status(404).json({ success: false, error: 'Membership not found' });
      return;
    }

    // Perform cancellation
    const cancelled = await cancelMembership(membership.userId.toString(), reason);

    // Log admin-initiated audit event with full evidence
    await auditService.log({
      requestId: req.auditContext?.requestId || 'admin-membership',
      correlationId: req.auditContext?.correlationId || 'admin-membership',
      traceId: req.auditContext?.traceId || 'admin-membership',
      transactionId: req.auditContext?.transactionId || 'admin-membership',
      sourceIp: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      applicationName: 'pawtag-api',
      applicationVersion: '1.0.0',
      apiVersion: 'v1',
      environment: process.env.NODE_ENV || 'development',
      actorType: 'CSR',
      actorId: req.user!.id,
      actorUsername: req.user!.email,
    }, {
      action: 'membership_cancelled_by_admin',
      eventType: 'membership.cancelled',
      eventCategory: 'FINANCIAL',
      operationType: 'UPDATE',
      resourceType: 'UserMembership',
      resourceId: membershipId,
      outcome: 'SUCCESS',
      severity: 'HIGH',
      metadata: {
        userId: membership.userId.toString(),
        membershipId,
        evidence: {
          customerEmailDate,
          customerEmailContent,
          actionRequired,
          reason,
          csrFullName,
          csrNotes: evidence.csrNotes || '',
        },
      },
    });

    res.json({ success: true, data: cancelled });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Admin Membership] Cancel error');
    res.status(400).json({ success: false, error: error.message || 'Failed to cancel membership' });
  }
});

/**
 * GET /api/admin/membership/retention-settings
 * Get membership retention offer settings
 */
router.get('/retention-settings', requirePermission('setting.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await getAllMembershipRetentionSettings();
    res.json({ success: true, data: settings });
  } catch (error: any) {
    logger.error({ err: error }, '[AdminMembership] Failed to fetch retention settings');
    res.status(500).json({ success: false, error: 'Failed to fetch retention settings' });
  }
});

/**
 * PUT /api/admin/membership/retention-settings
 * Update membership retention offer settings
 */
router.put('/retention-settings', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const updates = req.body;

    // Validate: must be an object with at least one known key
    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: 'No settings provided' });
      return;
    }

    const validKeys = Object.keys(MEMBERSHIP_RETENTION_DEFAULTS);
    const invalidKeys = Object.keys(updates).filter((k) => !validKeys.includes(k));
    if (invalidKeys.length > 0) {
      res.status(400).json({ success: false, error: `Invalid setting keys: ${invalidKeys.join(', ')}` });
      return;
    }

    // Validate values are valid numbers
    for (const [key, value] of Object.entries(updates)) {
      const num = Number(value);
      if (isNaN(num) || num < 0) {
        res.status(400).json({ success: false, error: `Invalid value for ${key}: ${value}` });
        return;
      }
    }

    // Upsert each setting
    for (const [key, value] of Object.entries(updates)) {
      await Setting.findOneAndUpdate(
        { key: `membership.retention.${key}` },
        { value: String(value), updatedAt: new Date() },
        { upsert: true },
      );
    }

    // Clear cache so services pick up new values
    clearMembershipConfigCache();

    // Audit
    await auditService.log({
      actorType: 'ADMIN',
      actorId: req.user!.id,
      actorUsername: req.user!.email,
      sourceIp: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      applicationName: 'pawtag-api',
      applicationVersion: '1.0.0',
      apiVersion: 'v1',
      environment: process.env.NODE_ENV || 'development',
    }, {
      action: 'membership_retention_settings_updated',
      eventType: 'ADMIN_ACTION',
      eventCategory: 'UPDATE',
      operationType: 'UPDATE',
      resourceType: 'MembershipRetentionSettings',
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: { updatedKeys: Object.keys(updates), values: updates },
    });

    res.json({ success: true, message: 'Retention settings updated successfully' });
  } catch (error: any) {
    logger.error({ err: error }, '[AdminMembership] Failed to update retention settings');
    res.status(500).json({ success: false, error: 'Failed to update retention settings' });
  }
});

export default router;

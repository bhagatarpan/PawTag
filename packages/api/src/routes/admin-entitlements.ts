import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { MembershipBenefit, AuditEvent } from '@pawtag/db';
import { membershipEntitlementService } from '../services/membership-entitlement.service';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

/**
 * GET /api/admin/entitlements/matrix
 * Returns the full benefits matrix for admin UI.
 */
router.get('/matrix', requirePermission('setting.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const matrix = await membershipEntitlementService.getBenefitsMatrix();
    res.json({ success: true, data: matrix });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Entitlements] Failed to load matrix');
    res.status(500).json({ success: false, error: 'Failed to load entitlements matrix' });
  }
});

/**
 * GET /api/admin/entitlements/benefits
 * List all benefit definitions.
 */
router.get('/benefits', requirePermission('setting.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const benefits = await MembershipBenefit.find({}).sort({ category: 1, displayOrder: 1 }).lean();
    res.json({ success: true, data: benefits });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Entitlements] Failed to load benefits');
    res.status(500).json({ success: false, error: 'Failed to load benefits' });
  }
});

/**
 * POST /api/admin/entitlements/benefits
 * Create or update a benefit definition.
 */
router.post('/benefits', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { key, name, description, type, category, defaultValue, enabled, displayOrder } = req.body;

    if (!key || !name || !type || !category) {
      res.status(400).json({ success: false, error: 'key, name, type, and category are required' });
      return;
    }

    if (!['boolean', 'number', 'string'].includes(type)) {
      res.status(400).json({ success: false, error: 'type must be boolean, number, or string' });
      return;
    }

    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      res.status(400).json({ success: false, error: 'key must be snake_case (letters, numbers, underscores)' });
      return;
    }

    const benefit = await membershipEntitlementService.upsertBenefit({
      key, name, description, type, category, defaultValue, enabled, displayOrder,
    });

    await AuditEvent.create({
      eventId: `audit-entitlement-${Date.now()}`,
      actorId: req.user!.id,
      actorRole: 'admin',
      actorEmail: req.user!.email,
      category: 'SETTINGS',
      action: 'UPDATE',
      severity: 'MEDIUM',
      outcome: 'SUCCESS',
      resourceType: 'MembershipBenefit',
      resourceId: key,
      metadata: { key, name, type, category },
    });

    res.status(201).json({ success: true, data: benefit });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Entitlements] Failed to save benefit');
    res.status(500).json({ success: false, error: error.message || 'Failed to save benefit' });
  }
});

/**
 * PUT /api/admin/entitlements/benefits/:key
 * Update a benefit definition.
 */
router.put('/benefits/:key', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { name, description, type, category, defaultValue, enabled, displayOrder } = req.body;

    const existing = await MembershipBenefit.findOne({ key });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Benefit not found' });
      return;
    }

    const benefit = await membershipEntitlementService.upsertBenefit({
      key,
      name: name ?? existing.name,
      description: description ?? existing.description,
      type: type ?? existing.type,
      category: category ?? existing.category,
      defaultValue: defaultValue !== undefined ? defaultValue : existing.defaultValue,
      enabled: enabled !== undefined ? enabled : existing.enabled,
      displayOrder: displayOrder ?? existing.displayOrder,
    });

    await AuditEvent.create({
      eventId: `audit-entitlement-${Date.now()}`,
      actorId: req.user!.id,
      actorRole: 'admin',
      actorEmail: req.user!.email,
      category: 'SETTINGS',
      action: 'UPDATE',
      severity: 'MEDIUM',
      outcome: 'SUCCESS',
      resourceType: 'MembershipBenefit',
      resourceId: key,
      metadata: { key, changes: req.body },
    });

    res.json({ success: true, data: benefit });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Entitlements] Failed to update benefit');
    res.status(500).json({ success: false, error: error.message || 'Failed to update benefit' });
  }
});

/**
 * DELETE /api/admin/entitlements/benefits/:key
 * Delete a benefit and all tier values.
 */
router.delete('/benefits/:key', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.params;

    const existing = await MembershipBenefit.findOne({ key });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Benefit not found' });
      return;
    }

    await membershipEntitlementService.deleteBenefit(key);

    await AuditEvent.create({
      eventId: `audit-entitlement-${Date.now()}`,
      actorId: req.user!.id,
      actorRole: 'admin',
      actorEmail: req.user!.email,
      category: 'SETTINGS',
      action: 'DELETE',
      severity: 'HIGH',
      outcome: 'SUCCESS',
      resourceType: 'MembershipBenefit',
      resourceId: key,
      metadata: { key },
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Entitlements] Failed to delete benefit');
    res.status(500).json({ success: false, error: error.message || 'Failed to delete benefit' });
  }
});

/**
 * PUT /api/admin/entitlements/tiers/:tier/:benefitKey
 * Update a single benefit value for a tier.
 */
router.put('/tiers/:tier/:benefitKey', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { tier, benefitKey } = req.params;
    const { enabled, value } = req.body;

    if (!['gold', 'platinum', 'black'].includes(tier)) {
      res.status(400).json({ success: false, error: 'Invalid tier' });
      return;
    }

    if (enabled === undefined || value === undefined) {
      res.status(400).json({ success: false, error: 'enabled and value are required' });
      return;
    }

    const result = await membershipEntitlementService.setTierBenefit(tier, benefitKey, enabled, value);

    await AuditEvent.create({
      eventId: `audit-entitlement-${Date.now()}`,
      actorId: req.user!.id,
      actorRole: 'admin',
      actorEmail: req.user!.email,
      category: 'SETTINGS',
      action: 'UPDATE',
      severity: 'MEDIUM',
      outcome: 'SUCCESS',
      resourceType: 'MembershipTierBenefit',
      resourceId: `${tier}:${benefitKey}`,
      metadata: { tier, benefitKey, enabled, value },
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Entitlements] Failed to update tier benefit');
    res.status(500).json({ success: false, error: error.message || 'Failed to update tier benefit' });
  }
});

/**
 * PUT /api/admin/entitlements/tiers/:tier
 * Bulk update all benefit values for a tier.
 */
router.put('/tiers/:tier', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { tier } = req.params;
    const { benefits } = req.body;

    if (!['gold', 'platinum', 'black'].includes(tier)) {
      res.status(400).json({ success: false, error: 'Invalid tier' });
      return;
    }

    if (!benefits || typeof benefits !== 'object') {
      res.status(400).json({ success: false, error: 'benefits object is required' });
      return;
    }

    await membershipEntitlementService.setTierBenefits(tier, benefits);

    await AuditEvent.create({
      eventId: `audit-entitlement-${Date.now()}`,
      actorId: req.user!.id,
      actorRole: 'admin',
      actorEmail: req.user!.email,
      category: 'SETTINGS',
      action: 'UPDATE',
      severity: 'MEDIUM',
      outcome: 'SUCCESS',
      resourceType: 'MembershipTierBenefit',
      resourceId: `tier:${tier}`,
      metadata: { tier, benefitKeys: Object.keys(benefits) },
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Entitlements] Failed to update tier benefits');
    res.status(500).json({ success: false, error: error.message || 'Failed to update tier benefits' });
  }
});

/**
 * GET /api/admin/entitlements/tiers/:tier
 * Get all entitlements for a specific tier.
 */
router.get('/tiers/:tier', requirePermission('setting.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { tier } = req.params;

    if (!['gold', 'platinum', 'black'].includes(tier)) {
      res.status(400).json({ success: false, error: 'Invalid tier' });
      return;
    }

    const entitlements = await membershipEntitlementService.getTierEntitlements(tier);
    res.json({ success: true, data: entitlements });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Entitlements] Failed to load tier entitlements');
    res.status(500).json({ success: false, error: 'Failed to load tier entitlements' });
  }
});

/**
 * POST /api/admin/entitlements/cache/invalidate
 * Force invalidate the entitlement cache.
 */
router.post('/cache/invalidate', requirePermission('setting.update'), async (_req: AuthRequest, res: Response) => {
  membershipEntitlementService.invalidateCache();
  res.json({ success: true, message: 'Cache invalidated' });
});

export default router;

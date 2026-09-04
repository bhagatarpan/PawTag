import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { Referral, ReferralCode, User } from '@pawtag/db';
import {
  getOrCreateReferralCode,
  validateReferralCode,
  getReferralStats,
  getReferralHistory,
} from '../services/referral.service';
import { auditService, type AuditContext } from '../services/audit';
import { createAuditContextFromRequest, type AuditRequest } from '../middleware/audit';
import logger from '../lib/logger';

async function auditReferralEvent(
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

const router = Router();

  // Customer: Get or create referral code
router.get('/customer/referral', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const code = await getOrCreateReferralCode(req.user!.id);
    res.json({ success: true, data: { code, shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/refer?code=${code}` } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get referral code' });
  }
});

// Customer: Get referral stats
router.get('/customer/referral/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await getReferralStats(req.user!.id);
    res.json({ success: true, data: stats });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get referral stats' });
  }
});

// Customer: Get referral history
router.get('/customer/referral/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const history = await getReferralHistory(req.user!.id);
    res.json({ success: true, data: history });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get referral history' });
  }
});

// Customer: Get referred-by info
router.get('/customer/referral/referred-by', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const referral = await Referral.findOne({ refereeId: req.user!.id })
      .populate('referrerId', 'fullName')
      .lean();
    res.json({ success: true, data: referral?.referrerId || null });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get referred-by info' });
  }
});

// Public: Validate referral code
router.get('/finder/referral/:code', async (req, res: Response) => {
  try {
    const result = await validateReferralCode(req.params.code);
    if (!result.valid) {
      res.status(404).json({ success: false, error: 'Invalid referral code' });
      return;
    }
    res.json({ success: true, data: { valid: true, referrerName: result.referrerName } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to validate referral code' });
  }
});

// Admin: List all referrals
router.get('/admin/referrals', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Referral.find()
        .populate('referrerId', 'fullName email')
        .populate('refereeId', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Referral.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to list referrals' });
  }
});

// Admin: Referral stats
router.get('/admin/referrals/stats', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const totalReferrals = await Referral.countDocuments();
    const completedReferrals = await Referral.countDocuments({ status: { $in: ['completed', 'rewarded'] } });
    const pendingReferrals = await Referral.countDocuments({ status: 'pending' });
    const rewardedReferrals = await Referral.countDocuments({ status: 'rewarded' });
    const totalCodes = await ReferralCode.countDocuments({ isActive: true });

    res.json({
      success: true,
      data: { totalReferrals, completedReferrals, pendingReferrals, rewardedReferrals, totalCodes },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get referral stats' });
  }
});

/**
 * PUT /api/admin/referrals/:id/status
 *
 * Override referral status. Allows admins to manually mark a referral as
 * completed, rewarded, or cancelled. Only valid transitions are allowed.
 */
router.put('/admin/referrals/:id/status', authenticate, requirePermission('order.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'completed', 'rewarded', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ success: false, error: `Status must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const referral = await Referral.findById(req.params.id);
    if (!referral) {
      res.status(404).json({ success: false, error: 'Referral not found' });
      return;
    }

    const previousStatus = referral.status;
    referral.status = status;
    await referral.save();

    await auditReferralEvent(req, {
      action: 'referral_status_override',
      eventType: 'referral.status.updated',
      eventCategory: 'FINANCIAL',
      operationType: 'UPDATE',
      resourceType: 'Referral',
      resourceId: req.params.id,
      beforeState: { status: previousStatus },
      afterState: { status: status },
      changedFields: [{ field: 'status', before: previousStatus, after: status }],
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: { orderId: referral.orderId?.toString() },
    });

    logger.info({ referralId: req.params.id, previousStatus, newStatus: status, updatedBy: req.user!.id }, 'Referral status updated by admin');
    res.json({ success: true, data: referral });
  } catch (error) {
    await auditReferralEvent(req, {
      action: 'referral_status_override',
      eventType: 'referral.status.updated',
      eventCategory: 'FINANCIAL',
      operationType: 'UPDATE',
      resourceType: 'Referral',
      resourceId: req.params.id,
      outcome: 'FAILURE',
      severity: 'HIGH',
    });
    res.status(500).json({ success: false, error: 'Failed to update referral status' });
  }
});

/**
 * DELETE /api/admin/referrals/:id
 *
 * Delete a referral record. Only accessible by admin roles.
 */
router.delete('/admin/referrals/:id', authenticate, requirePermission('order.update'), async (req: AuthRequest, res: Response) => {
  try {
    const referral = await Referral.findByIdAndDelete(req.params.id);
    if (!referral) {
      res.status(404).json({ success: false, error: 'Referral not found' });
      return;
    }

    await auditReferralEvent(req, {
      action: 'referral_delete',
      eventType: 'referral.deleted',
      eventCategory: 'FINANCIAL',
      operationType: 'DELETE',
      resourceType: 'Referral',
      resourceId: req.params.id,
      beforeState: {
        referrerId: referral.referrerId,
        refereeId: referral.refereeId?.toString(),
        status: referral.status,
        orderId: referral.orderId?.toString(),
      },
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
    });

    logger.info({ referralId: req.params.id, deletedBy: req.user!.id }, 'Referral deleted by admin');
    res.json({ success: true, data: { message: 'Referral deleted' } });
  } catch (error) {
    await auditReferralEvent(req, {
      action: 'referral_delete',
      eventType: 'referral.deleted',
      eventCategory: 'FINANCIAL',
      operationType: 'DELETE',
      resourceType: 'Referral',
      resourceId: req.params.id,
      outcome: 'FAILURE',
      severity: 'HIGH',
    });
    res.status(500).json({ success: false, error: 'Failed to delete referral' });
  }
});

export default router;
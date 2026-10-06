import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { EscalationRecord } from '@pawtag/db';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

/**
 * GET /api/admin/escalations
 * List escalation records with filtering
 */
router.get('/', requirePermission('subscription.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, stage, _priority, page = '1', limit = '20' } = req.query;
    const query: any = {};

    if (status) query.status = status;
    if (stage) query.stage = stage;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [records, total] = await Promise.all([
      EscalationRecord.find(query)
        .populate('ownerId', 'fullName email phoneNumber emergencyContact')
        .populate('petId', 'name petId species breed color photos medicalAlerts')
        .populate('tagId', 'tagId')
        .sort({ foundAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      EscalationRecord.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        records,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Escalations] Failed to fetch escalations');
    res.status(500).json({ success: false, error: 'Failed to fetch escalations' });
  }
});

/**
 * GET /api/admin/escalations/urgent
 * Get urgent escalations (Stage 3 - PawTag team notified)
 */
router.get('/urgent', requirePermission('subscription.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const records = await EscalationRecord.find({
      stage: 'pawtag_team_notified',
      status: { $ne: 'resolved' },
    })
      .populate('ownerId', 'fullName email phoneNumber emergencyContact address')
      .populate('petId', 'name petId species breed color photos medicalAlerts')
      .populate('tagId', 'tagId')
      .sort({ pawtagTeamNotifiedAt: -1 })
      .lean();

    res.json({ success: true, data: records });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Escalations] Failed to fetch urgent escalations');
    res.status(500).json({ success: false, error: 'Failed to fetch urgent escalations' });
  }
});

/**
 * GET /api/admin/escalations/:id
 * Get single escalation record with full details
 */
router.get('/:id', requirePermission('subscription.read'), async (req: AuthRequest, res: Response) => {
  try {
    const record = await EscalationRecord.findById(req.params.id)
      .populate('ownerId', 'fullName email phoneNumber emergencyContact address')
      .populate('petId', 'name petId species breed color photos medicalAlerts status')
      .populate('tagId', 'tagId status')
      .lean();

    if (!record) {
      res.status(404).json({ success: false, error: 'Escalation record not found' });
      return;
    }

    res.json({ success: true, data: record });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Escalations] Failed to fetch escalation');
    res.status(500).json({ success: false, error: 'Failed to fetch escalation' });
  }
});

/**
 * POST /api/admin/escalations/:id/resolve
 * Resolve an escalation (admin action)
 */
router.post('/:id/resolve', requirePermission('subscription.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { notes } = req.body;
    const record = await EscalationRecord.findById(req.params.id);

    if (!record) {
      res.status(404).json({ success: false, error: 'Escalation record not found' });
      return;
    }

    record.status = 'resolved';
    record.resolvedAt = new Date();
    record.resolvedBy = 'admin';
    if (notes) {
      record.notes = (record.notes || '') + `\n[Admin] ${notes}`;
    }
    await record.save();

    res.json({ success: true, data: record });
  } catch (error: any) {
    logger.error({ err: error }, '[Admin Escalations] Failed to resolve escalation');
    res.status(500).json({ success: false, error: 'Failed to resolve escalation' });
  }
});

export default router;

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { CmsSmsTemplate, AuditLog } from '@pawtag/db';

const router = Router();
router.use(authenticate);

// ═══════════════════════════════════════════
// SMS TEMPLATES
// ═══════════════════════════════════════════

router.get('/sms-templates', requirePermission('cms.sms_template.read'), async (req, res: Response) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const query: any = { deletedAt: null };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) query.status = status;

    const total = await CmsSmsTemplate.countDocuments(query);
    const templates = await CmsSmsTemplate.find(query)
      .populate('createdBy', 'fullName')
      .populate('updatedBy', 'fullName')
      .sort({ updatedAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: { items: templates, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch SMS templates' });
  }
});

router.get('/sms-templates/:id', requirePermission('cms.sms_template.read'), async (req, res: Response) => {
  try {
    const template = await CmsSmsTemplate.findOne({ _id: req.params.id, deletedAt: null })
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email');
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }
    res.json({ success: true, data: template });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch SMS template' });
  }
});

router.post('/sms-templates', requirePermission('cms.sms_template.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug, message, variables, status } = req.body;

    if (!name || !slug || !message) {
      res.status(400).json({ success: false, error: 'name, slug, and message are required' });
      return;
    }

    const existing = await CmsSmsTemplate.findOne({ slug, deletedAt: null });
    if (existing) {
      res.status(400).json({ success: false, error: 'A template with this slug already exists' });
      return;
    }

    const template = await CmsSmsTemplate.create({
      name, slug, message, variables: variables || [],
      status: status || 'active',
      createdBy: req.user!.id, updatedBy: req.user!.id,
    });

    await AuditLog.create({
      userId: req.user!.id, action: 'create', entity: 'CmsSmsTemplate', entityId: template._id.toString(),
      changes: { name, slug },
    });

    res.status(201).json({ success: true, data: template });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create SMS template' });
  }
});

router.put('/sms-templates/:id', requirePermission('cms.sms_template.update'), async (req: AuthRequest, res: Response) => {
  try {
    const template = await CmsSmsTemplate.findOne({ _id: req.params.id, deletedAt: null });
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }

    const oldSlug = template.slug;
    const updateData = { ...req.body, updatedBy: req.user!.id };

    const updated = await CmsSmsTemplate.findByIdAndUpdate(req.params.id, updateData, { new: true });

    await AuditLog.create({
      userId: req.user!.id, action: 'update', entity: 'CmsSmsTemplate', entityId: req.params.id,
      changes: { slug: { old: oldSlug, new: req.body.slug || oldSlug } },
    });

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update SMS template' });
  }
});

router.delete('/sms-templates/:id', requirePermission('cms.sms_template.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const template = await CmsSmsTemplate.findOne({ _id: req.params.id, deletedAt: null });
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }

    template.deletedAt = new Date();
    await template.save();

    await AuditLog.create({
      userId: req.user!.id, action: 'soft_delete', entity: 'CmsSmsTemplate', entityId: req.params.id,
      changes: { slug: template.slug },
    });

    res.json({ success: true, data: { message: 'Template deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete SMS template' });
  }
});

export default router;

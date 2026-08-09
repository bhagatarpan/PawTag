import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { CmsSmsTemplate } from '@pawtag/db';
import { auditService, type AuditContext } from '../services/audit';
import { type AuditRequest } from '../middleware/audit';

const router = Router();
router.use(authenticate);

async function auditCmsEvent(
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
    actorId: req.user?.id,
    actorEmail: req.user?.email,
    ...overrides,
  } as AuditContext;
  await auditService.log(context, input);
}

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

    await auditCmsEvent(req, {
      action: 'cms_sms_template_create',
      eventType: 'cms_sms_template.created',
      eventCategory: 'CONFIG',
      operationType: 'CREATE',
      resourceType: 'CmsSmsTemplate',
      resourceId: template._id.toString(),
      metadata: { name, slug },
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
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

    await auditCmsEvent(req, {
      action: 'cms_sms_template_update',
      eventType: 'cms_sms_template.updated',
      eventCategory: 'CONFIG',
      operationType: 'UPDATE',
      resourceType: 'CmsSmsTemplate',
      resourceId: req.params.id,
      metadata: { slug: { old: oldSlug, new: req.body.slug || oldSlug } },
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
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

    await auditCmsEvent(req, {
      action: 'cms_sms_template_soft_delete',
      eventType: 'cms_sms_template.soft_deleted',
      eventCategory: 'CONFIG',
      operationType: 'DELETE',
      resourceType: 'CmsSmsTemplate',
      resourceId: req.params.id,
      metadata: { slug: template.slug },
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
    });

    res.json({ success: true, data: { message: 'Template deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete SMS template' });
  }
});

export default router;

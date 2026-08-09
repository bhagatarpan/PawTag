import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { CmsEmailTemplate } from '@pawtag/db';
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
// EMAIL TEMPLATES
// ═══════════════════════════════════════════

router.get('/email-templates', requirePermission('cms.email_template.read'), async (req, res: Response) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const query: any = { deletedAt: null };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) query.status = status;

    const total = await CmsEmailTemplate.countDocuments(query);
    const templates = await CmsEmailTemplate.find(query)
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
    res.status(500).json({ success: false, error: 'Failed to fetch email templates' });
  }
});

router.get('/email-templates/:id', requirePermission('cms.email_template.read'), async (req, res: Response) => {
  try {
    const template = await CmsEmailTemplate.findOne({ _id: req.params.id, deletedAt: null })
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email');
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }
    res.json({ success: true, data: template });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch email template' });
  }
});

router.get('/email-templates/slug/:slug', requirePermission('cms.email_template.read'), async (req, res: Response) => {
  try {
    const template = await CmsEmailTemplate.findOne({ slug: req.params.slug, deletedAt: null });
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }
    res.json({ success: true, data: template });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch email template' });
  }
});

router.post('/email-templates', requirePermission('cms.email_template.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug, subject, title, subtitle, body, ctaText, ctaUrl, preheader, footerText, senderEmail, senderName, variables, status } = req.body;

    if (!name || !slug || !subject || !title || !body || !senderEmail || !senderName) {
      res.status(400).json({ success: false, error: 'name, slug, subject, title, body, senderEmail, and senderName are required' });
      return;
    }

    const existing = await CmsEmailTemplate.findOne({ slug, deletedAt: null });
    if (existing) {
      res.status(400).json({ success: false, error: 'A template with this slug already exists' });
      return;
    }

    const template = await CmsEmailTemplate.create({
      name, slug, subject, title, subtitle, body, ctaText, ctaUrl, preheader, footerText, senderEmail, senderName, variables: variables || [],
      status: status || 'active',
      createdBy: req.user!.id, updatedBy: req.user!.id,
    });

    await auditCmsEvent(req, {
      action: 'cms_email_template_create',
      eventType: 'cms_email_template.created',
      eventCategory: 'CONFIG',
      operationType: 'CREATE',
      resourceType: 'CmsEmailTemplate',
      resourceId: template._id.toString(),
      metadata: { name, slug },
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
    });

    res.status(201).json({ success: true, data: template });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create email template' });
  }
});

router.put('/email-templates/:id', requirePermission('cms.email_template.update'), async (req: AuthRequest, res: Response) => {
  try {
    const template = await CmsEmailTemplate.findOne({ _id: req.params.id, deletedAt: null });
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }

    const oldSlug = template.slug;
    const updateData = { ...req.body, updatedBy: req.user!.id };

    const updated = await CmsEmailTemplate.findByIdAndUpdate(req.params.id, updateData, { new: true });

    await auditCmsEvent(req, {
      action: 'cms_email_template_update',
      eventType: 'cms_email_template.updated',
      eventCategory: 'CONFIG',
      operationType: 'UPDATE',
      resourceType: 'CmsEmailTemplate',
      resourceId: req.params.id,
      metadata: { slug: { old: oldSlug, new: req.body.slug || oldSlug } },
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
    });

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update email template' });
  }
});

router.delete('/email-templates/:id', requirePermission('cms.email_template.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const template = await CmsEmailTemplate.findOne({ _id: req.params.id, deletedAt: null });
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }

    template.deletedAt = new Date();
    await template.save();

    await auditCmsEvent(req, {
      action: 'cms_email_template_soft_delete',
      eventType: 'cms_email_template.soft_deleted',
      eventCategory: 'CONFIG',
      operationType: 'DELETE',
      resourceType: 'CmsEmailTemplate',
      resourceId: req.params.id,
      metadata: { slug: template.slug },
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
    });

    res.json({ success: true, data: { message: 'Template deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete email template' });
  }
});

export default router;

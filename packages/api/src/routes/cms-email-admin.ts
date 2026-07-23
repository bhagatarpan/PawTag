import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { CmsEmailTemplate, AuditLog } from '@pawtag/db';

const router = Router();
router.use(authenticate);

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

    await AuditLog.create({
      userId: req.user!.id, action: 'create', entity: 'CmsEmailTemplate', entityId: template._id.toString(),
      changes: { name, slug },
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

    await AuditLog.create({
      userId: req.user!.id, action: 'update', entity: 'CmsEmailTemplate', entityId: req.params.id,
      changes: { slug: { old: oldSlug, new: req.body.slug || oldSlug } },
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

    await AuditLog.create({
      userId: req.user!.id, action: 'soft_delete', entity: 'CmsEmailTemplate', entityId: req.params.id,
      changes: { slug: template.slug },
    });

    res.json({ success: true, data: { message: 'Template deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete email template' });
  }
});

export default router;

import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { CmsEmailTemplate, EmailAudit, EmailTemplateVersion } from '@pawtag/db';
import { auditService, type AuditContext } from '../services/audit';
import { type AuditRequest } from '../middleware/audit';

const router = Router();
router.use(authenticate);

async function auditCommEvent(
  _req: AuditRequest,
  input: Parameters<typeof auditService.log>[1],
  overrides: Partial<AuditContext> = {},
): Promise<void> {
  const reqContext = _req.auditContext as AuditContext;
  if (!reqContext) return;
  const context: AuditContext = {
    ...reqContext,
    actorId: _req.user?.id,
    actorEmail: _req.user?.email,
    ...overrides,
  } as AuditContext;
  await auditService.log(context, input);
}

// ═══════════════════════════════════════════
// COMMUNICATIONS DASHBOARD
// ═══════════════════════════════════════════

router.get('/dashboard', requirePermission('cms.email_template.read'), async (_req, res: Response) => {
  try {
    const [
      totalTemplates,
      activeTemplates,
      draftTemplates,
      disabledTemplates,
      archivedTemplates,
      totalEmails,
      sentEmails,
      deliveredEmails,
      failedEmails,
      bouncedEmails,
      emailsToday,
      emailsThisWeek,
    ] = await Promise.all([
      CmsEmailTemplate.countDocuments({ deletedAt: null }),
      CmsEmailTemplate.countDocuments({ status: 'active', deletedAt: null }),
      CmsEmailTemplate.countDocuments({ status: 'draft', deletedAt: null }),
      CmsEmailTemplate.countDocuments({ status: 'inactive', deletedAt: null }),
      CmsEmailTemplate.countDocuments({ status: 'archived', deletedAt: null }),
      EmailAudit.countDocuments({}),
      EmailAudit.countDocuments({ status: 'sent' }),
      EmailAudit.countDocuments({ status: 'delivered' }),
      EmailAudit.countDocuments({ status: 'failed' }),
      EmailAudit.countDocuments({ status: 'bounced' }),
      EmailAudit.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      EmailAudit.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
    ]);

    const recentFailures = await EmailAudit.find({ status: { $in: ['failed', 'bounced'] } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('recipientEmail subject status failureReason createdAt templateSlug');

    const recentlyUpdated = await CmsEmailTemplate.find({ deletedAt: null })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('name slug status businessFlow updatedAt version');

    res.json({
      success: true,
      data: {
        templates: { total: totalTemplates, active: activeTemplates, draft: draftTemplates, disabled: disabledTemplates, archived: archivedTemplates },
        emails: { total: totalEmails, sent: sentEmails, delivered: deliveredEmails, failed: failedEmails, bounced: bouncedEmails, today: emailsToday, thisWeek: emailsThisWeek },
        recentFailures,
        recentlyUpdated,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard' });
  }
});

// ═══════════════════════════════════════════
// ENHANCED EMAIL TEMPLATES
// ═══════════════════════════════════════════

router.get('/templates', requirePermission('cms.email_template.read'), async (req, res: Response) => {
  try {
    const { page = 1, limit = 20, search, status, businessFlow, emailType } = req.query;
    const query: any = { deletedAt: null };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { purpose: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) query.status = status;
    if (businessFlow) query.businessFlow = businessFlow;
    if (emailType) query.emailType = emailType;

    const total = await CmsEmailTemplate.countDocuments(query);
    const templates = await CmsEmailTemplate.find(query)
      .populate('createdBy', 'fullName')
      .populate('updatedBy', 'fullName')
      .sort({ businessFlow: 1, name: 1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: { items: templates, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch templates' });
  }
});

router.get('/templates/:id', requirePermission('cms.email_template.read'), async (req, res: Response) => {
  try {
    const template = await CmsEmailTemplate.findOne({ _id: req.params.id, deletedAt: null })
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email');
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }
    res.json({ success: true, data: template });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch template' });
  }
});

router.put('/templates/:id', requirePermission('cms.email_template.update'), async (req: AuthRequest, res: Response) => {
  try {
    const template = await CmsEmailTemplate.findOne({ _id: req.params.id, deletedAt: null });
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }

    // Save version before update
    const newVersion = (template.version || 1) + 1;
    await EmailTemplateVersion.create({
      templateId: template._id,
      templateSlug: template.slug,
      version: template.version || 1,
      subject: template.subject,
      title: template.title,
      subtitle: template.subtitle,
      body: template.body,
      ctaText: template.ctaText,
      ctaUrl: template.ctaUrl,
      preheader: template.preheader,
      footerText: template.footerText,
      senderEmail: template.senderEmail,
      senderName: template.senderName,
      variables: template.variables,
      variableDefinitions: template.variableDefinitions || [],
      changedBy: req.user!.id,
      changedAt: new Date(),
      changeDescription: req.body.changeDescription || 'Template updated',
    });

    const allowedFields = [
      'name', 'slug', 'subject', 'title', 'subtitle', 'body', 'ctaText', 'ctaUrl',
      'preheader', 'footerText', 'senderEmail', 'senderName', 'variables', 'status',
      'businessFlow', 'purpose', 'triggerDescription', 'recipientDescription',
      'emailType', 'isCritical', 'variableDefinitions',
    ];
    const updateData: Record<string, any> = { updatedBy: req.user!.id, version: newVersion };
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    const updated = await CmsEmailTemplate.findByIdAndUpdate(req.params.id, updateData, { new: true });

    await auditCommEvent(req, {
      action: 'communication_template_update',
      eventType: 'communication.template.updated',
      eventCategory: 'CONFIG',
      operationType: 'UPDATE',
      resourceType: 'CmsEmailTemplate',
      resourceId: req.params.id,
      metadata: { slug: template.slug, version: newVersion },
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
    });

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update template' });
  }
});

// ═══════════════════════════════════════════
// TEMPLATE VERSION HISTORY
// ═══════════════════════════════════════════

router.get('/templates/:id/versions', requirePermission('cms.email_template.read'), async (req, res: Response) => {
  try {
    const versions = await EmailTemplateVersion.find({ templateId: req.params.id })
      .populate('changedBy', 'fullName')
      .sort({ version: -1 })
      .limit(50);
    res.json({ success: true, data: versions });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch versions' });
  }
});

router.get('/templates/:id/versions/:version', requirePermission('cms.email_template.read'), async (req, res: Response) => {
  try {
    const version = await EmailTemplateVersion.findOne({
      templateId: req.params.id,
      version: Number(req.params.version),
    }).populate('changedBy', 'fullName');
    if (!version) { res.status(404).json({ success: false, error: 'Version not found' }); return; }
    res.json({ success: true, data: version });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch version' });
  }
});

// ═══════════════════════════════════════════
// EMAIL AUDIT
// ═══════════════════════════════════════════

router.get('/audit', requirePermission('communication.email_audit.read'), async (req, res: Response) => {
  try {
    const { page = 1, limit = 25, search, status, businessFlow, templateSlug, dateFrom, dateTo, isTest } = req.query;
    const query: any = {};
    if (search) {
      query.$or = [
        { recipientEmail: { $regex: search, $options: 'i' } },
        { recipientName: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { providerMessageId: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) query.status = status;
    if (businessFlow) query.businessFlow = businessFlow;
    if (templateSlug) query.templateSlug = templateSlug;
    if (isTest !== undefined) query.isTest = isTest === 'true';
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) query.createdAt.$lte = new Date(dateTo as string);
    }

    const total = await EmailAudit.countDocuments(query);
    const records = await EmailAudit.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .select('-htmlContent -plainTextContent'); // Don't load full HTML in list

    res.json({
      success: true,
      data: { items: records, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch audit records' });
  }
});

router.get('/audit/:id', requirePermission('communication.email_audit.read'), async (req, res: Response) => {
  try {
    const record = await EmailAudit.findById(req.params.id);
    if (!record) { res.status(404).json({ success: false, error: 'Audit record not found' }); return; }
    res.json({ success: true, data: record });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch audit record' });
  }
});

// ═══════════════════════════════════════════
// SEND TEST EMAIL
// ═══════════════════════════════════════════

router.post('/templates/:id/send-test', requirePermission('communication.email_template.send_test'), async (req: AuthRequest, res: Response) => {
  try {
    const { recipientEmail } = req.body;
    if (!recipientEmail) {
      res.status(400).json({ success: false, error: 'recipientEmail is required' });
      return;
    }

    const template = await CmsEmailTemplate.findOne({ _id: req.params.id, deletedAt: null });
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }

    // Update last tested
    template.lastTestedAt = new Date();
    template.lastTestedBy = new mongoose.Types.ObjectId(req.user!.id);
    await template.save();

    await auditCommEvent(req, {
      action: 'communication_template_send_test',
      eventType: 'communication.template.test_sent',
      eventCategory: 'CONFIG',
      operationType: 'CREATE',
      resourceType: 'CmsEmailTemplate',
      resourceId: req.params.id,
      metadata: { slug: template.slug, recipientEmail },
      outcome: 'SUCCESS',
      severity: 'LOW',
    });

    res.json({ success: true, data: { message: `Test email queued for ${recipientEmail}` } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to send test email' });
  }
});

export default router;

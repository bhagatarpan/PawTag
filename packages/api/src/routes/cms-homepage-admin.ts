import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { CmsHomepageSection } from '@pawtag/db';
import { heroSlideContentSchema } from '../middleware/schemas';
import { auditService, type AuditContext } from '../services/audit';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

/**
 * Validate hero slide content server-side before persistence. Client-side
 * validation in the admin editor is convenience only — CMS content is
 * rendered to visitors, so unsafe URLs and oversized fields are rejected
 * here regardless of origin.
 */
function validateHeroContent(
  res: Response,
  sectionType: string | undefined,
  content: unknown,
): boolean {
  if (sectionType !== 'hero_slide' || content === undefined || content === null) return true;
  const parsed = heroSlideContentSchema.safeParse(content);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: parsed.error.issues.map((issue) => ({
        field: `content.${issue.path.join('.')}`,
        message: issue.message,
      })),
    });
    return false;
  }
  return true;
}

async function auditSectionChange(
  req: AuthRequest,
  action: string,
  section: { _id: unknown; title?: string; sectionType?: string },
  extra: Record<string, unknown>,
): Promise<void> {
  try {
    await auditService.log(req.auditContext as AuditContext, {
      action,
      eventType: `cms_homepage.${action}`,
      eventCategory: 'CONFIG',
      operationType: action.endsWith('created') ? 'CREATE' : action.endsWith('deleted') ? 'DELETE' : 'UPDATE',
      resourceType: 'CmsHomepageSection',
      resourceId: String(section._id),
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      businessOperation: `Homepage section "${section.title || ''}" (${section.sectionType || ''}) ${action.replace('cms_homepage_section_', '')}`,
      ...extra,
    });
  } catch (err) {
    logger.error({ err, action, sectionId: String(section._id) }, 'CMS homepage section audit failed');
  }
}

// GET /api/admin/cms/homepage - List all homepage sections
router.get('/', requirePermission('cms.homepage.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { sectionType } = req.query;
    const filter: Record<string, unknown> = { deletedAt: null };
    if (sectionType) filter.sectionType = sectionType;

    const sections = await CmsHomepageSection.find(filter).sort({ sectionType: 1, order: 1 });
    res.json({ success: true, data: sections });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch homepage sections' });
  }
});

// GET /api/admin/cms/homepage/:id - Get single section
router.get('/:id', requirePermission('cms.homepage.read'), async (req: AuthRequest, res: Response) => {
  try {
    const section = await CmsHomepageSection.findOne({ _id: req.params.id, deletedAt: null });
    if (!section) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }
    res.json({ success: true, data: section });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch section' });
  }
});

// POST /api/admin/cms/homepage - Create section
router.post('/', requirePermission('cms.homepage.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { sectionType, title, subtitle, content, order, isActive } = req.body;
    if (!sectionType || !title) {
      return res.status(400).json({ success: false, error: 'sectionType and title are required' });
    }
    if (!validateHeroContent(res, sectionType, content)) return;

    const section = new CmsHomepageSection({
      sectionType,
      title,
      subtitle,
      content: content || {},
      order: order ?? 0,
      isActive: isActive ?? true,
    });
    await section.save();

    logger.info({ sectionId: String(section._id), sectionType, title }, 'CMS homepage section created');
    await auditSectionChange(req, 'cms_homepage_section_created', section, {
      afterState: { sectionType, title, order: section.order, isActive: section.isActive },
    });

    res.status(201).json({ success: true, data: section });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create section' });
  }
});

// PUT /api/admin/cms/homepage/:id - Update section
router.put('/:id', requirePermission('cms.homepage.update'), async (req: AuthRequest, res: Response) => {
  try {
    const section = await CmsHomepageSection.findOne({ _id: req.params.id, deletedAt: null });
    if (!section) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }

    const { sectionType, title, subtitle, content, order, isActive } = req.body;
    if (!validateHeroContent(res, sectionType ?? section.sectionType, content)) return;

    const beforeState = {
      title: section.title,
      order: section.order,
      isActive: section.isActive,
      content: section.content,
    };

    if (sectionType !== undefined) section.sectionType = sectionType;
    if (title !== undefined) section.title = title;
    if (subtitle !== undefined) section.subtitle = subtitle;
    if (content !== undefined) section.content = content;
    if (order !== undefined) section.order = order;
    if (isActive !== undefined) section.isActive = isActive;
    await section.save();

    logger.info({ sectionId: String(section._id), title: section.title }, 'CMS homepage section updated');
    await auditSectionChange(req, 'cms_homepage_section_updated', section, {
      beforeState,
      afterState: {
        title: section.title,
        order: section.order,
        isActive: section.isActive,
        content: section.content,
      },
    });

    res.json({ success: true, data: section });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update section' });
  }
});

// DELETE /api/admin/cms/homepage/:id - Soft delete section
router.delete('/:id', requirePermission('cms.homepage.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const section = await CmsHomepageSection.findOne({ _id: req.params.id, deletedAt: null });
    if (!section) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }
    section.deletedAt = new Date();
    await section.save();

    logger.info({ sectionId: String(section._id), title: section.title }, 'CMS homepage section soft-deleted');
    await auditSectionChange(req, 'cms_homepage_section_deleted', section, {
      beforeState: { isActive: section.isActive },
    });

    res.json({ success: true, data: section });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete section' });
  }
});

// PUT /api/admin/cms/homepage/:id/toggle - Toggle active status
router.put('/:id/toggle', requirePermission('cms.homepage.update'), async (req: AuthRequest, res: Response) => {
  try {
    const section = await CmsHomepageSection.findOne({ _id: req.params.id, deletedAt: null });
    if (!section) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }
    const wasActive = section.isActive;
    section.isActive = !section.isActive;
    await section.save();

    logger.info({ sectionId: String(section._id), isActive: section.isActive }, 'CMS homepage section toggled');
    await auditSectionChange(req, 'cms_homepage_section_toggled', section, {
      beforeState: { isActive: wasActive },
      afterState: { isActive: section.isActive },
    });

    res.json({ success: true, data: section });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to toggle section' });
  }
});

export default router;

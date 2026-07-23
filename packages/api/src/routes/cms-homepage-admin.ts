import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { CmsHomepageSection } from '@pawtag/db';

const router = Router();
router.use(authenticate);

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

    const section = new CmsHomepageSection({
      sectionType,
      title,
      subtitle,
      content: content || {},
      order: order ?? 0,
      isActive: isActive ?? true,
    });
    await section.save();

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
    if (sectionType !== undefined) section.sectionType = sectionType;
    if (title !== undefined) section.title = title;
    if (subtitle !== undefined) section.subtitle = subtitle;
    if (content !== undefined) section.content = content;
    if (order !== undefined) section.order = order;
    if (isActive !== undefined) section.isActive = isActive;
    await section.save();

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
    section.isActive = !section.isActive;
    await section.save();

    res.json({ success: true, data: section });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to toggle section' });
  }
});

export default router;
import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { CmsAuthPage } from '@pawtag/db';

const router = Router();
router.use(authenticate);

// GET /api/admin/cms/auth-pages - List all auth pages
router.get('/', requirePermission('cms.auth_page.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const pages = await CmsAuthPage.find({ deletedAt: null }).sort({ pageType: 1 });
    res.json({ success: true, data: pages });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch auth pages' });
  }
});

// GET /api/admin/cms/auth-pages/:id - Get single page
router.get('/:id', requirePermission('cms.auth_page.read'), async (req: AuthRequest, res: Response) => {
  try {
    const page = await CmsAuthPage.findOne({ _id: req.params.id, deletedAt: null });
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
    res.json({ success: true, data: page });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch page' });
  }
});

// PUT /api/admin/cms/auth-pages/:id - Update page
router.put('/:id', requirePermission('cms.auth_page.update'), async (req: AuthRequest, res: Response) => {
  try {
    const page = await CmsAuthPage.findOne({ _id: req.params.id, deletedAt: null });
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }

    const { title, subtitle, content, isActive } = req.body;
    if (title !== undefined) page.title = title;
    if (subtitle !== undefined) page.subtitle = subtitle;
    if (content !== undefined) page.content = content;
    if (isActive !== undefined) page.isActive = isActive;
    await page.save();

    res.json({ success: true, data: page });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update page' });
  }
});

export default router;
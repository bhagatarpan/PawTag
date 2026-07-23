import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { CmsShopPage } from '@pawtag/db';

const router = Router();
router.use(authenticate);

// GET /api/admin/cms/shop-pages - List all shop pages
router.get('/', requirePermission('cms.shop_page.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const pages = await CmsShopPage.find({ deletedAt: null }).sort({ slug: 1 });
    res.json({ success: true, data: pages });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch shop pages' });
  }
});

// GET /api/admin/cms/shop-pages/:id - Get single page
router.get('/:id', requirePermission('cms.shop_page.read'), async (req: AuthRequest, res: Response) => {
  try {
    const page = await CmsShopPage.findOne({ _id: req.params.id, deletedAt: null });
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
    res.json({ success: true, data: page });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch page' });
  }
});

// POST /api/admin/cms/shop-pages - Create page
router.post('/', requirePermission('cms.shop_page.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { slug, title, subtitle, content, metaTitle, metaDescription, isActive } = req.body;
    if (!slug || !title) {
      return res.status(400).json({ success: false, error: 'slug and title are required' });
    }

    const existing = await CmsShopPage.findOne({ slug, deletedAt: null });
    if (existing) {
      return res.status(409).json({ success: false, error: 'A page with this slug already exists' });
    }

    const page = new CmsShopPage({
      slug: slug.toLowerCase().trim(),
      title,
      subtitle,
      content: content || {},
      metaTitle,
      metaDescription,
      isActive: isActive ?? true,
    });
    await page.save();

    res.status(201).json({ success: true, data: page });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create page' });
  }
});

// PUT /api/admin/cms/shop-pages/:id - Update page
router.put('/:id', requirePermission('cms.shop_page.update'), async (req: AuthRequest, res: Response) => {
  try {
    const page = await CmsShopPage.findOne({ _id: req.params.id, deletedAt: null });
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }

    const { slug, title, subtitle, content, metaTitle, metaDescription, isActive } = req.body;
    if (slug !== undefined) page.slug = slug.toLowerCase().trim();
    if (title !== undefined) page.title = title;
    if (subtitle !== undefined) page.subtitle = subtitle;
    if (content !== undefined) page.content = content;
    if (metaTitle !== undefined) page.metaTitle = metaTitle;
    if (metaDescription !== undefined) page.metaDescription = metaDescription;
    if (isActive !== undefined) page.isActive = isActive;
    await page.save();

    res.json({ success: true, data: page });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update page' });
  }
});

// DELETE /api/admin/cms/shop-pages/:id - Soft delete page
router.delete('/:id', requirePermission('cms.shop_page.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const page = await CmsShopPage.findOne({ _id: req.params.id, deletedAt: null });
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
    page.deletedAt = new Date();
    await page.save();

    res.json({ success: true, data: page });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete page' });
  }
});

export default router;
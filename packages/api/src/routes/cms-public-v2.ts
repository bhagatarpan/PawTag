import { Router, Response } from 'express';
import { CmsHomepageSection, CmsShopPage, CmsAuthPage } from '@pawtag/db';

const router = Router();

// GET /public/cms/homepage/sections - Get active homepage sections
router.get('/homepage/sections', async (req, res: Response) => {
  try {
    const { sectionType } = req.query;
    const filter: Record<string, unknown> = { isActive: true, deletedAt: null };
    if (sectionType) filter.sectionType = sectionType;

    const sections = await CmsHomepageSection.find(filter).sort({ order: 1 });
    res.json({ success: true, data: sections });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch homepage sections' });
  }
});

// GET /public/cms/homepage/sections/:type - Get active sections by type
router.get('/homepage/sections/:type', async (req, res: Response) => {
  try {
    const sections = await CmsHomepageSection.find({
      sectionType: req.params.type,
      isActive: true,
      deletedAt: null,
    }).sort({ order: 1 });
    res.json({ success: true, data: sections });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch sections' });
  }
});

// GET /public/cms/shop/:slug - Get active shop page
router.get('/shop/:slug', async (req, res: Response) => {
  try {
    const page = await CmsShopPage.findOne({
      slug: req.params.slug,
      isActive: true,
      deletedAt: null,
    });
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
    res.json({ success: true, data: page });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch shop page' });
  }
});

// GET /public/cms/auth/:pageType - Get auth page
router.get('/auth/:pageType', async (req, res: Response) => {
  try {
    const page = await CmsAuthPage.findOne({
      pageType: req.params.pageType,
      isActive: true,
      deletedAt: null,
    });
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
    res.json({ success: true, data: page });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch auth page' });
  }
});

export default router;
import { Router, Response } from 'express';
import { CmsHomepageSection, CmsShopPage, CmsAuthPage } from '@pawtag/db';

const router = Router();

/**
 * Public projection of a homepage section: strips Mongo internals
 * (__v/timestamps/deletedAt) and, for hero slides, limits content to the
 * known presentation keys with length caps. Legacy hero keys are included
 * so previously saved slides keep rendering.
 */
const HERO_CONTENT_KEYS = [
  'eyebrow', 'tag', 'headline', 'sub',
  'ctaText', 'ctaUrl', 'secondaryCtaText', 'secondaryCtaUrl',
  'desktopImageUrl', 'mobileImageUrl', 'imageAlt', 'imageFocalPoint',
  'duration', 'imageUrl', 'bg', 'visualType', 'stats', 'flowSteps',
] as const;

function clampString(value: unknown, max: number): string | undefined {
  return typeof value === 'string' ? value.slice(0, max) : undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose doc (Mixed content) projected deliberately
function toPublicSection(doc: any): Record<string, unknown> {
  const base = {
    _id: String(doc._id),
    sectionType: doc.sectionType as string,
    title: clampString(doc.title, 200) || '',
    subtitle: clampString(doc.subtitle, 300) || '',
    order: doc.order as number,
    isActive: Boolean(doc.isActive),
  };

  if (doc.sectionType !== 'hero_slide') {
    return { ...base, content: doc.content || {} };
  }

  const raw = (doc.content || {}) as Record<string, unknown>;
  const content: Record<string, unknown> = {};
  const limits: Record<string, number> = {
    eyebrow: 120, tag: 120, headline: 300, sub: 600,
    ctaText: 80, ctaUrl: 500, secondaryCtaText: 80, secondaryCtaUrl: 500,
    desktopImageUrl: 2000, mobileImageUrl: 2000, imageAlt: 300,
    imageFocalPoint: 40, bg: 200, visualType: 40, imageUrl: 2000,
  };
  for (const key of HERO_CONTENT_KEYS) {
    const value = raw[key];
    if (value === undefined) continue;
    if (key === 'duration' && typeof value === 'number' && Number.isFinite(value)) {
      content.duration = Math.min(30, Math.max(3, value));
    } else if (key === 'stats' && Array.isArray(value)) {
      content.stats = value
        .slice(0, 6)
        .map((s: Record<string, unknown>) => ({
          number: clampString(s?.number, 20) || '',
          label: clampString(s?.label, 60) || '',
        }));
    } else if (key === 'flowSteps' && Array.isArray(value)) {
      content.flowSteps = value
        .slice(0, 8)
        .map((s: Record<string, unknown>) => ({
          icon: clampString(s?.icon, 40) || '',
          label: clampString(s?.label, 60) || '',
          desc: clampString(s?.desc, 120) || '',
        }));
    } else {
      const capped = clampString(value, limits[key] || 500);
      if (capped !== undefined) content[key] = capped;
    }
  }
  return { ...base, content };
}

// GET /public/cms/homepage/sections - Get active homepage sections
router.get('/homepage/sections', async (req, res: Response) => {
  try {
    const { sectionType } = req.query;
    const filter: Record<string, unknown> = { isActive: true, deletedAt: null };
    if (sectionType) filter.sectionType = sectionType;

    const sections = await CmsHomepageSection.find(filter).sort({ order: 1 });
    res.json({ success: true, data: sections.map(toPublicSection) });
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
    res.json({ success: true, data: sections.map(toPublicSection) });
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
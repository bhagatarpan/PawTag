import { Router, Request, Response } from 'express';
import {
  CmsPage,
  CmsNavigation,
  CmsFooter,
  CmsAnnouncement,
  CmsRedirect,
  Setting,
} from '@pawtag/db';

const router = Router();

// ═══════════════════════════════════════════
// PAGES (public)
// ═══════════════════════════════════════════

router.get('/pages/:slug', async (req: Request, res: Response) => {
  try {
    const page = await CmsPage.findOne({ slug: req.params.slug, status: 'published', deletedAt: null })
      .select('-__v -createdBy -updatedBy -deletedAt');
    if (!page) { res.status(404).json({ success: false, error: 'Page not found' }); return; }

    // Filter to published sections only
    const visibleSections = (page.sections || []).filter(
      (s) => s.visible && s.status === 'published'
    );

    res.json({
      success: true,
      data: {
        ...page.toObject(),
        sections: visibleSections,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch page' });
  }
});

// ═══════════════════════════════════════════
// NAVIGATION (public)
// ═══════════════════════════════════════════

router.get('/navigation/:location', async (req: Request, res: Response) => {
  try {
    const menus = await CmsNavigation.find({
      location: req.params.location,
      status: 'published',
      deletedAt: null,
    }).select('-__v -createdBy -updatedBy -deletedAt');

    // Filter visible items
    const sanitized = menus.map((menu) => ({
      ...menu.toObject(),
      items: (menu.items || []).filter((item) => item.visible),
    }));

    res.json({ success: true, data: sanitized });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch navigation' });
  }
});

// ═══════════════════════════════════════════
// FOOTER (public)
// ═══════════════════════════════════════════

router.get('/footer', async (_req: Request, res: Response) => {
  try {
    const footer = await CmsFooter.findOne({ status: 'published', deletedAt: null })
      .select('-__v -createdBy -updatedBy -deletedAt')
      .sort({ updatedAt: -1 });

    if (!footer) {
      res.json({ success: true, data: null });
      return;
    }

    // Filter visible groups and links
    const sanitized = {
      ...footer.toObject(),
      groups: (footer.groups || [])
        .filter((g) => g.visible)
        .map((g) => ({
          ...g,
          links: (g.links || []).filter((l) => l.visible),
        })),
    };

    res.json({ success: true, data: sanitized });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch footer' });
  }
});

// ═══════════════════════════════════════════
// SETTINGS (public — specific keys only)
// ═══════════════════════════════════════════

const PUBLIC_SETTING_KEYS = [
  'site.name',
  'site.tagline',
  'site.description',
  'site.logo',
  'site.favicon',
  'company.name',
  'company.email',
  'company.phone',
  'company.address',
  'social.facebook',
  'social.twitter',
  'social.instagram',
  'social.linkedin',
  'social.youtube',
  'social.tiktok',
  'seo.defaultTitle',
  'seo.defaultDescription',
  'seo.defaultKeywords',
  'contact.businessHours',
  'contact.businessHoliday',
];

router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const settings = await Setting.find({ key: { $in: PUBLIC_SETTING_KEYS } }).select('key value');
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }
    res.json({ success: true, data: settingsMap });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

// ═══════════════════════════════════════════
// ANNOUNCEMENTS (public)
// ═══════════════════════════════════════════

router.get('/announcements', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const query: any = {
      status: 'published',
      visible: true,
      deletedAt: null,
      $or: [
        { startsAt: null },
        { startsAt: { $lte: now } },
      ],
      $and: [
        { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
      ],
    };

    // Filter by target audience if auth info available
    const isLoggedIn = !!(req as any).user;
    if (isLoggedIn) {
      query.targetAudience = { $in: ['all', 'logged_in'] };
    } else {
      query.targetAudience = { $in: ['all', 'logged_out'] };
    }

    const announcements = await CmsAnnouncement.find(query)
      .select('-__v -createdBy -updatedBy -deletedAt')
      .sort({ priority: -1 });

    res.json({ success: true, data: announcements });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch announcements' });
  }
});

// ═══════════════════════════════════════════
// REDIRECTS (check before 404)
// ═══════════════════════════════════════════

router.get('/redirects/check', async (req: Request, res: Response) => {
  try {
    const { path: checkPath } = req.query;
    if (!checkPath) {
      res.json({ success: true, data: { redirect: false } });
      return;
    }

    const redirect = await CmsRedirect.findOne({
      from: checkPath,
      status: 'active',
      deletedAt: null,
    });

    if (redirect) {
      redirect.hitCount += 1;
      await redirect.save();

      res.json({
        success: true,
        data: {
          redirect: true,
          to: redirect.to,
          type: redirect.type === 'permanent' ? 301 : 302,
        },
      });
    } else {
      res.json({ success: true, data: { redirect: false } });
    }
  } catch {
    res.status(500).json({ success: false, error: 'Failed to check redirect' });
  }
});

export default router;

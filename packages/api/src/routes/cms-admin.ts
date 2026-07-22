import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import {
  CmsPage,
  CmsPageVersion,
  CmsNavigation,
  CmsFooter,
  CmsMedia,
  CmsAnnouncement,
  CmsRedirect,
  AuditLog,
} from '@pawtag/db';

const router = Router();
router.use(authenticate);

// ═══════════════════════════════════════════
// PAGES
// ═══════════════════════════════════════════

router.get('/pages', requirePermission('cms.page.read'), async (req, res: Response) => {
  try {
    const { page = 1, limit = 20, search, status, template } = req.query;
    const query: any = { deletedAt: null };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) query.status = status;
    if (template) query.template = template;

    const total = await CmsPage.countDocuments(query);
    const pages = await CmsPage.find(query)
      .select('-sections')
      .populate('createdBy', 'fullName')
      .populate('updatedBy', 'fullName')
      .sort({ updatedAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: { items: pages, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch pages' });
  }
});

router.get('/pages/:id', requirePermission('cms.page.read'), async (req, res: Response) => {
  try {
    const page = await CmsPage.findOne({ _id: req.params.id, deletedAt: null })
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email');
    if (!page) { res.status(404).json({ success: false, error: 'Page not found' }); return; }
    res.json({ success: true, data: page });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch page' });
  }
});

router.post('/pages', requirePermission('cms.page.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { slug, title, description, template, sections, metaTitle, metaDescription, metaKeywords, canonicalUrl, ogImage, ogTitle, ogDescription, schemaJsonLd } = req.body;

    if (!slug || !title) {
      res.status(400).json({ success: false, error: 'slug and title are required' });
      return;
    }

    const existing = await CmsPage.findOne({ slug, deletedAt: null });
    if (existing) {
      res.status(400).json({ success: false, error: 'A page with this slug already exists' });
      return;
    }

    const page = await CmsPage.create({
      slug,
      title,
      description,
      template: template || 'default',
      sections: sections || [],
      metaTitle,
      metaDescription,
      metaKeywords,
      canonicalUrl,
      ogImage,
      ogTitle,
      ogDescription,
      schemaJsonLd,
      status: 'draft',
      version: 1,
      createdBy: req.user!.id,
      updatedBy: req.user!.id,
    });

    await AuditLog.create({
      userId: req.user!.id,
      action: 'create',
      entity: 'CmsPage',
      entityId: page._id.toString(),
      changes: { slug, title },
    });

    res.status(201).json({ success: true, data: page });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create page' });
  }
});

router.put('/pages/:id', requirePermission('cms.page.update'), async (req: AuthRequest, res: Response) => {
  try {
    const page = await CmsPage.findOne({ _id: req.params.id, deletedAt: null });
    if (!page) { res.status(404).json({ success: false, error: 'Page not found' }); return; }

    // Save version before update
    await CmsPageVersion.create({
      pageId: page._id,
      version: page.version,
      snapshot: page.toObject(),
      createdBy: req.user!.id,
    });

    const oldSlug = page.slug;
    const updateData = { ...req.body, updatedBy: req.user!.id, $inc: { version: 1 } };

    if (updateData.status === 'published' && !page.publishedAt) {
      (updateData as any).publishedAt = new Date();
    }

    const updated = await CmsPage.findByIdAndUpdate(req.params.id, updateData, { new: true });

    await AuditLog.create({
      userId: req.user!.id,
      action: 'update',
      entity: 'CmsPage',
      entityId: req.params.id,
      changes: { slug: { old: oldSlug, new: req.body.slug || oldSlug } },
    });

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update page' });
  }
});

router.put('/pages/:id/publish', requirePermission('cms.page.publish'), async (req: AuthRequest, res: Response) => {
  try {
    const page = await CmsPage.findOne({ _id: req.params.id, deletedAt: null });
    if (!page) { res.status(404).json({ success: false, error: 'Page not found' }); return; }

    page.status = 'published';
    page.publishedAt = new Date();
    page.updatedBy = req.user!.id as any;
    await page.save();

    await AuditLog.create({
      userId: req.user!.id,
      action: 'publish',
      entity: 'CmsPage',
      entityId: req.params.id,
    });

    res.json({ success: true, data: page });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to publish page' });
  }
});

router.delete('/pages/:id', requirePermission('cms.page.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const page = await CmsPage.findOne({ _id: req.params.id, deletedAt: null });
    if (!page) { res.status(404).json({ success: false, error: 'Page not found' }); return; }

    page.deletedAt = new Date();
    await page.save();

    await AuditLog.create({
      userId: req.user!.id,
      action: 'soft_delete',
      entity: 'CmsPage',
      entityId: req.params.id,
      changes: { slug: page.slug },
    });

    res.json({ success: true, data: { message: 'Page deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete page' });
  }
});

router.get('/pages/:id/versions', requirePermission('cms.page.read'), async (req, res: Response) => {
  try {
    const versions = await CmsPageVersion.find({ pageId: req.params.id })
      .populate('createdBy', 'fullName')
      .sort({ version: -1 })
      .limit(50);
    res.json({ success: true, data: versions });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch versions' });
  }
});

router.post('/pages/:id/rollback', requirePermission('cms.page.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { versionId } = req.body;
    const version = await CmsPageVersion.findOne({ _id: versionId, pageId: req.params.id });
    if (!version) { res.status(404).json({ success: false, error: 'Version not found' }); return; }

    const page = await CmsPage.findOne({ _id: req.params.id, deletedAt: null });
    if (!page) { res.status(404).json({ success: false, error: 'Page not found' }); return; }

    // Save current as version before rollback
    await CmsPageVersion.create({
      pageId: page._id,
      version: page.version,
      snapshot: page.toObject(),
      createdBy: req.user!.id,
    });

    const snapshot = version.snapshot as any;
    await CmsPage.findByIdAndUpdate(req.params.id, {
      ...snapshot,
      _id: req.params.id,
      version: page.version + 1,
      updatedBy: req.user!.id,
    });

    await AuditLog.create({
      userId: req.user!.id,
      action: 'rollback',
      entity: 'CmsPage',
      entityId: req.params.id,
      changes: { rolledBackToVersion: version.version },
    });

    const updated = await CmsPage.findById(req.params.id);
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to rollback page' });
  }
});

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════

router.get('/navigation', requirePermission('cms.navigation.read'), async (req, res: Response) => {
  try {
    const { location } = req.query;
    const query: any = { deletedAt: null };
    if (location) query.location = location;
    const menus = await CmsNavigation.find(query)
      .populate('createdBy', 'fullName')
      .sort({ updatedAt: -1 });
    res.json({ success: true, data: menus });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch navigation' });
  }
});

router.get('/navigation/:id', requirePermission('cms.navigation.read'), async (req, res: Response) => {
  try {
    const menu = await CmsNavigation.findOne({ _id: req.params.id, deletedAt: null })
      .populate('createdBy', 'fullName')
      .populate('updatedBy', 'fullName');
    if (!menu) { res.status(404).json({ success: false, error: 'Navigation not found' }); return; }
    res.json({ success: true, data: menu });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch navigation' });
  }
});

router.post('/navigation', requirePermission('cms.navigation.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug, location, items, status } = req.body;
    if (!name || !slug || !location) {
      res.status(400).json({ success: false, error: 'name, slug, and location are required' });
      return;
    }

    const existing = await CmsNavigation.findOne({ slug, deletedAt: null });
    if (existing) {
      res.status(400).json({ success: false, error: 'A navigation with this slug already exists' });
      return;
    }

    const menu = await CmsNavigation.create({
      name, slug, location, items: items || [], status: status || 'draft',
      createdBy: req.user!.id, updatedBy: req.user!.id,
    });

    await AuditLog.create({ userId: req.user!.id, action: 'create', entity: 'CmsNavigation', entityId: menu._id.toString(), changes: { name, slug, location } });
    res.status(201).json({ success: true, data: menu });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create navigation' });
  }
});

router.put('/navigation/:id', requirePermission('cms.navigation.update'), async (req: AuthRequest, res: Response) => {
  try {
    const menu = await CmsNavigation.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { ...req.body, updatedBy: req.user!.id },
      { new: true },
    );
    if (!menu) { res.status(404).json({ success: false, error: 'Navigation not found' }); return; }

    await AuditLog.create({ userId: req.user!.id, action: 'update', entity: 'CmsNavigation', entityId: req.params.id });
    res.json({ success: true, data: menu });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update navigation' });
  }
});

router.delete('/navigation/:id', requirePermission('cms.navigation.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const menu = await CmsNavigation.findOne({ _id: req.params.id, deletedAt: null });
    if (!menu) { res.status(404).json({ success: false, error: 'Navigation not found' }); return; }
    menu.deletedAt = new Date();
    await menu.save();
    await AuditLog.create({ userId: req.user!.id, action: 'soft_delete', entity: 'CmsNavigation', entityId: req.params.id, changes: { name: menu.name } });
    res.json({ success: true, data: { message: 'Navigation deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete navigation' });
  }
});

// ═══════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════

router.get('/footer', requirePermission('cms.footer.read'), async (_req, res: Response) => {
  try {
    const footers = await CmsFooter.find({ deletedAt: null })
      .populate('createdBy', 'fullName')
      .sort({ updatedAt: -1 });
    res.json({ success: true, data: footers });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch footer' });
  }
});

router.get('/footer/:id', requirePermission('cms.footer.read'), async (req, res: Response) => {
  try {
    const footer = await CmsFooter.findOne({ _id: req.params.id, deletedAt: null })
      .populate('createdBy', 'fullName')
      .populate('updatedBy', 'fullName');
    if (!footer) { res.status(404).json({ success: false, error: 'Footer not found' }); return; }
    res.json({ success: true, data: footer });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch footer' });
  }
});

router.post('/footer', requirePermission('cms.footer.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, groups, copyright, socialLinks, status } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }
    const footer = await CmsFooter.create({
      name, groups: groups || [], copyright, socialLinks, status: status || 'draft',
      createdBy: req.user!.id, updatedBy: req.user!.id,
    });
    await AuditLog.create({ userId: req.user!.id, action: 'create', entity: 'CmsFooter', entityId: footer._id.toString(), changes: { name } });
    res.status(201).json({ success: true, data: footer });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create footer' });
  }
});

router.put('/footer/:id', requirePermission('cms.footer.update'), async (req: AuthRequest, res: Response) => {
  try {
    const footer = await CmsFooter.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { ...req.body, updatedBy: req.user!.id },
      { new: true },
    );
    if (!footer) { res.status(404).json({ success: false, error: 'Footer not found' }); return; }
    await AuditLog.create({ userId: req.user!.id, action: 'update', entity: 'CmsFooter', entityId: req.params.id });
    res.json({ success: true, data: footer });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update footer' });
  }
});

router.delete('/footer/:id', requirePermission('cms.footer.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const footer = await CmsFooter.findOne({ _id: req.params.id, deletedAt: null });
    if (!footer) { res.status(404).json({ success: false, error: 'Footer not found' }); return; }
    footer.deletedAt = new Date();
    await footer.save();
    await AuditLog.create({ userId: req.user!.id, action: 'soft_delete', entity: 'CmsFooter', entityId: req.params.id, changes: { name: footer.name } });
    res.json({ success: true, data: { message: 'Footer deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete footer' });
  }
});

// ═══════════════════════════════════════════
// MEDIA
// ═══════════════════════════════════════════

router.get('/media', requirePermission('cms.media.read'), async (req, res: Response) => {
  try {
    const { page = 1, limit = 20, search, folder, mimeType, tag } = req.query;
    const query: any = { deletedAt: null };
    if (search) {
      query.$or = [
        { originalName: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { alt: { $regex: search, $options: 'i' } },
      ];
    }
    if (folder) query.folder = folder;
    if (mimeType) query.mimeType = { $regex: mimeType, $options: 'i' };
    if (tag) query.tags = tag;

    const total = await CmsMedia.countDocuments(query);
    const media = await CmsMedia.find(query)
      .populate('uploadedBy', 'fullName')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: { items: media, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch media' });
  }
});

router.get('/media/:id', requirePermission('cms.media.read'), async (req, res: Response) => {
  try {
    const media = await CmsMedia.findOne({ _id: req.params.id, deletedAt: null })
      .populate('uploadedBy', 'fullName');
    if (!media) { res.status(404).json({ success: false, error: 'Media not found' }); return; }
    res.json({ success: true, data: media });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch media' });
  }
});

router.put('/media/:id', requirePermission('cms.media.update'), async (req: AuthRequest, res: Response) => {
  try {
    const media = await CmsMedia.findOne({ _id: req.params.id, deletedAt: null });
    if (!media) { res.status(404).json({ success: false, error: 'Media not found' }); return; }

    const { alt, caption, title, folder, tags } = req.body;
    if (alt !== undefined) media.alt = alt;
    if (caption !== undefined) media.caption = caption;
    if (title !== undefined) media.title = title;
    if (folder !== undefined) media.folder = folder;
    if (tags !== undefined) media.tags = tags;
    await media.save();

    await AuditLog.create({ userId: req.user!.id, action: 'update', entity: 'CmsMedia', entityId: req.params.id });
    res.json({ success: true, data: media });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update media' });
  }
});

router.delete('/media/:id', requirePermission('cms.media.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const media = await CmsMedia.findOne({ _id: req.params.id, deletedAt: null });
    if (!media) { res.status(404).json({ success: false, error: 'Media not found' }); return; }
    media.deletedAt = new Date();
    await media.save();
    await AuditLog.create({ userId: req.user!.id, action: 'soft_delete', entity: 'CmsMedia', entityId: req.params.id, changes: { filename: media.filename } });
    res.json({ success: true, data: { message: 'Media deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete media' });
  }
});

// ═══════════════════════════════════════════
// ANNOUNCEMENTS
// ═══════════════════════════════════════════

router.get('/announcements', requirePermission('cms.announcement.read'), async (req, res: Response) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const query: any = { deletedAt: null };
    if (status) query.status = status;
    if (type) query.type = type;

    const total = await CmsAnnouncement.countDocuments(query);
    const announcements = await CmsAnnouncement.find(query)
      .populate('createdBy', 'fullName')
      .sort({ priority: -1, createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: { items: announcements, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch announcements' });
  }
});

router.get('/announcements/:id', requirePermission('cms.announcement.read'), async (req, res: Response) => {
  try {
    const announcement = await CmsAnnouncement.findOne({ _id: req.params.id, deletedAt: null })
      .populate('createdBy', 'fullName')
      .populate('updatedBy', 'fullName');
    if (!announcement) { res.status(404).json({ success: false, error: 'Announcement not found' }); return; }
    res.json({ success: true, data: announcement });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch announcement' });
  }
});

router.post('/announcements', requirePermission('cms.announcement.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, message, type, priority, status, startsAt, endsAt, link, linkText, dismissible, visible, targetAudience } = req.body;
    if (!title || !message || !type) {
      res.status(400).json({ success: false, error: 'title, message, and type are required' });
      return;
    }
    const announcement = await CmsAnnouncement.create({
      title, message, type, priority: priority || 0, status: status || 'draft',
      startsAt, endsAt, link, linkText, dismissible: dismissible !== false, visible: visible !== false,
      targetAudience: targetAudience || 'all',
      createdBy: req.user!.id, updatedBy: req.user!.id,
    });
    await AuditLog.create({ userId: req.user!.id, action: 'create', entity: 'CmsAnnouncement', entityId: announcement._id.toString(), changes: { title, type } });
    res.status(201).json({ success: true, data: announcement });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create announcement' });
  }
});

router.put('/announcements/:id', requirePermission('cms.announcement.update'), async (req: AuthRequest, res: Response) => {
  try {
    const announcement = await CmsAnnouncement.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { ...req.body, updatedBy: req.user!.id },
      { new: true },
    );
    if (!announcement) { res.status(404).json({ success: false, error: 'Announcement not found' }); return; }
    await AuditLog.create({ userId: req.user!.id, action: 'update', entity: 'CmsAnnouncement', entityId: req.params.id });
    res.json({ success: true, data: announcement });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update announcement' });
  }
});

router.delete('/announcements/:id', requirePermission('cms.announcement.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const announcement = await CmsAnnouncement.findOne({ _id: req.params.id, deletedAt: null });
    if (!announcement) { res.status(404).json({ success: false, error: 'Announcement not found' }); return; }
    announcement.deletedAt = new Date();
    await announcement.save();
    await AuditLog.create({ userId: req.user!.id, action: 'soft_delete', entity: 'CmsAnnouncement', entityId: req.params.id, changes: { title: announcement.title } });
    res.json({ success: true, data: { message: 'Announcement deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete announcement' });
  }
});

// ═══════════════════════════════════════════
// REDIRECTS
// ═══════════════════════════════════════════

router.get('/redirects', requirePermission('cms.redirect.read'), async (req, res: Response) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const query: any = { deletedAt: null };
    if (search) {
      query.$or = [
        { from: { $regex: search, $options: 'i' } },
        { to: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) query.status = status;

    const total = await CmsRedirect.countDocuments(query);
    const redirects = await CmsRedirect.find(query)
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: { items: redirects, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch redirects' });
  }
});

router.post('/redirects', requirePermission('cms.redirect.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { from, to, type, status: redirectStatus } = req.body;
    if (!from || !to) {
      res.status(400).json({ success: false, error: 'from and to are required' });
      return;
    }
    const existing = await CmsRedirect.findOne({ from, deletedAt: null });
    if (existing) {
      res.status(400).json({ success: false, error: 'A redirect for this path already exists' });
      return;
    }
    const redirect = await CmsRedirect.create({
      from, to, type: type || 'permanent', status: redirectStatus || 'active',
      createdBy: req.user!.id, updatedBy: req.user!.id,
    });
    await AuditLog.create({ userId: req.user!.id, action: 'create', entity: 'CmsRedirect', entityId: redirect._id.toString(), changes: { from, to } });
    res.status(201).json({ success: true, data: redirect });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create redirect' });
  }
});

router.put('/redirects/:id', requirePermission('cms.redirect.update'), async (req: AuthRequest, res: Response) => {
  try {
    const redirect = await CmsRedirect.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { ...req.body, updatedBy: req.user!.id },
      { new: true },
    );
    if (!redirect) { res.status(404).json({ success: false, error: 'Redirect not found' }); return; }
    await AuditLog.create({ userId: req.user!.id, action: 'update', entity: 'CmsRedirect', entityId: req.params.id });
    res.json({ success: true, data: redirect });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update redirect' });
  }
});

router.delete('/redirects/:id', requirePermission('cms.redirect.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const redirect = await CmsRedirect.findOne({ _id: req.params.id, deletedAt: null });
    if (!redirect) { res.status(404).json({ success: false, error: 'Redirect not found' }); return; }
    redirect.deletedAt = new Date();
    await redirect.save();
    await AuditLog.create({ userId: req.user!.id, action: 'soft_delete', entity: 'CmsRedirect', entityId: req.params.id, changes: { from: redirect.from } });
    res.json({ success: true, data: { message: 'Redirect deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete redirect' });
  }
});

// ═══════════════════════════════════════════
// MEDIA UPLOAD (via existing upload route)
// ═══════════════════════════════════════════

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const cmsMediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/cms');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `cms-${uniqueSuffix}${ext}`);
  },
});

const cmsUpload = multer({
  storage: cmsMediaStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'video/mp4', 'video/webm', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed'));
  },
});

router.post('/media/upload', requirePermission('cms.media.upload'), (req: AuthRequest, res: Response) => {
  cmsUpload.array('files', 10)(req, res, async (err) => {
    if (err) {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({ success: false, error: 'No files uploaded' });
      return;
    }

    try {
      const baseUrl = `${req.protocol}://${req.get('host')}/api/uploads/cms`;
      const uploaded = [];

      for (const file of req.files) {
        const fileBuffer = fs.readFileSync(file.path);
        const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');

        // Check for duplicate
        const existingMedia = await CmsMedia.findOne({ hash, deletedAt: null });
        if (existingMedia) {
          // Delete the duplicate file
          fs.unlinkSync(file.path);
          uploaded.push(existingMedia);
          continue;
        }

        const media = await CmsMedia.create({
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: `${baseUrl}/${file.filename}`,
          hash,
          folder: req.body.folder || '/',
          tags: req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags]) : [],
          uploadedBy: req.user!.id,
        });

        await AuditLog.create({ userId: req.user!.id, action: 'upload', entity: 'CmsMedia', entityId: media._id.toString(), changes: { filename: file.filename } });
        uploaded.push(media);
      }

      res.json({ success: true, data: { files: uploaded } });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Failed to process uploads' });
    }
  });
});

export default router;

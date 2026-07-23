import { Router, Request, Response } from 'express';
import { CmsEmailTemplate, CmsSmsTemplate, CmsPetReference, Setting } from '@pawtag/db';

const router = Router();

// ═══════════════════════════════════════════
// EMAIL TEMPLATES (public - for rendering)
// ═══════════════════════════════════════════

router.get('/email-templates/:slug', async (req: Request, res: Response) => {
  try {
    const template = await CmsEmailTemplate.findOne({ slug: req.params.slug, status: 'active', deletedAt: null })
      .select('-__v -createdBy -updatedBy -deletedAt');
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }
    res.json({ success: true, data: template });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch email template' });
  }
});

// ═══════════════════════════════════════════
// SMS TEMPLATES (public - for rendering)
// ═══════════════════════════════════════════

router.get('/sms-templates/:slug', async (req: Request, res: Response) => {
  try {
    const template = await CmsSmsTemplate.findOne({ slug: req.params.slug, status: 'active', deletedAt: null })
      .select('-__v -createdBy -updatedBy -deletedAt');
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }
    res.json({ success: true, data: template });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch SMS template' });
  }
});

// ═══════════════════════════════════════════
// PET REFERENCES (public)
// ═══════════════════════════════════════════

router.get('/pet-references', async (req: Request, res: Response) => {
  try {
    const { type, petSpecies } = req.query;
    const query: any = { deletedAt: null, isActive: true };
    if (type) query.type = type;
    if (petSpecies) query.petSpecies = petSpecies;

    const references = await CmsPetReference.find(query)
      .select('type petSpecies label value order')
      .sort({ type: 1, petSpecies: 1, order: 1, label: 1 });

    res.json({ success: true, data: references });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch pet references' });
  }
});

router.get('/pet-references/grouped', async (_req: Request, res: Response) => {
  try {
    const references = await CmsPetReference.find({ deletedAt: null, isActive: true })
      .select('type petSpecies label value order')
      .sort({ type: 1, petSpecies: 1, order: 1, label: 1 });

    const grouped: Record<string, Record<string, { label: string; value: string }[]>> = {};
    for (const ref of references) {
      if (!grouped[ref.type]) grouped[ref.type] = {};
      const speciesKey = ref.petSpecies || '_all';
      if (!grouped[ref.type][speciesKey]) grouped[ref.type][speciesKey] = [];
      grouped[ref.type][speciesKey].push({ label: ref.label, value: ref.value });
    }

    res.json({ success: true, data: grouped });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch grouped pet references' });
  }
});

// ═══════════════════════════════════════════
// SITE SETTINGS (public - expanded)
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
  'company.country',
  'company.currency',
  'social.facebook',
  'social.twitter',
  'social.instagram',
  'social.linkedin',
  'social.youtube',
  'social.tiktok',
  'seo.defaultTitle',
  'seo.defaultDescription',
  'seo.defaultKeywords',
  'contact.email',
  'contact.phone',
  'contact.address',
  'urls.customerPortal',
  'urls.finderPortal',
  'urls.adminPortal',
  'urls.frontend',
  'emails.senderName',
  'emails.senderEmail',
  'emails.supportEmail',
  'sms.senderNumber',
  'checkout.defaultCountry',
  'checkout.currencyLabel',
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

export default router;

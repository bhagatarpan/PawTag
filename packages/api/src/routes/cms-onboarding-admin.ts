import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { CmsOnboarding, ICmsOnboardingStep } from '@pawtag/db';

const router = Router();
router.use(authenticate);

// GET /api/admin/cms/onboarding - Get onboarding config
router.get('/', requirePermission('cms.onboarding.read'), async (_req: AuthRequest, res: Response) => {
  try {
    let config = await CmsOnboarding.findOne();
    if (!config) {
      config = await CmsOnboarding.create({ steps: [] });
    }
    res.json({ success: true, data: config });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch onboarding config' });
  }
});

// PUT /api/admin/cms/onboarding - Replace all steps (full save)
router.put('/', requirePermission('cms.onboarding.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { steps } = req.body;
    if (!Array.isArray(steps)) {
      return res.status(400).json({ success: false, error: 'steps must be an array' });
    }

    let config = await CmsOnboarding.findOne();
    if (!config) {
      config = new CmsOnboarding({ steps });
    } else {
      config.steps = steps;
    }
    config.updatedBy = req.user!.id;
    await config.save();

    res.json({ success: true, data: config });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update onboarding config' });
  }
});

// POST /api/admin/cms/onboarding/steps - Add a new step
router.post('/steps', requirePermission('cms.onboarding.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { stepId, title, subtitle, icon, order, isActive, type, formFields, content } = req.body;
    if (!stepId || !title) {
      return res.status(400).json({ success: false, error: 'stepId and title are required' });
    }

    let config = await CmsOnboarding.findOne();
    if (!config) {
      config = new CmsOnboarding({ steps: [] });
    }

    const existing = config.steps.find((s: ICmsOnboardingStep) => s.stepId === stepId);
    if (existing) {
      return res.status(400).json({ success: false, error: `Step with stepId "${stepId}" already exists` });
    }

    config.steps.push({
      stepId,
      title,
      subtitle: subtitle || '',
      icon: icon || 'Heart',
      order: order ?? config.steps.length,
      isActive: isActive ?? true,
      type: type || 'info',
      formFields,
      content,
    });

    config.steps.sort((a: ICmsOnboardingStep, b: ICmsOnboardingStep) => a.order - b.order);
    config.updatedBy = req.user!.id;
    await config.save();

    res.status(201).json({ success: true, data: config });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to add step' });
  }
});

// PUT /api/admin/cms/onboarding/steps/:stepId - Update a single step
router.put('/steps/:stepId', requirePermission('cms.onboarding.update'), async (req: AuthRequest, res: Response) => {
  try {
    const config = await CmsOnboarding.findOne();
    if (!config) {
      return res.status(404).json({ success: false, error: 'Onboarding config not found' });
    }

    const step = config.steps.find((s: ICmsOnboardingStep) => s.stepId === req.params.stepId);
    if (!step) {
      return res.status(404).json({ success: false, error: 'Step not found' });
    }

    const { title, subtitle, icon, order, isActive, type, formFields, content } = req.body;
    if (title !== undefined) step.title = title;
    if (subtitle !== undefined) step.subtitle = subtitle;
    if (icon !== undefined) step.icon = icon;
    if (order !== undefined) step.order = order;
    if (isActive !== undefined) step.isActive = isActive;
    if (type !== undefined) step.type = type;
    if (formFields !== undefined) step.formFields = formFields;
    if (content !== undefined) step.content = content;

    config.steps.sort((a: ICmsOnboardingStep, b: ICmsOnboardingStep) => a.order - b.order);
    config.updatedBy = req.user!.id;
    await config.save();

    res.json({ success: true, data: config });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update step' });
  }
});

// DELETE /api/admin/cms/onboarding/steps/:stepId - Remove a step
router.delete('/steps/:stepId', requirePermission('cms.onboarding.update'), async (req: AuthRequest, res: Response) => {
  try {
    const config = await CmsOnboarding.findOne();
    if (!config) {
      return res.status(404).json({ success: false, error: 'Onboarding config not found' });
    }

    const idx = config.steps.findIndex((s: ICmsOnboardingStep) => s.stepId === req.params.stepId);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Step not found' });
    }

    config.steps.splice(idx, 1);
    config.updatedBy = req.user!.id;
    await config.save();

    res.json({ success: true, data: config });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete step' });
  }
});

export default router;

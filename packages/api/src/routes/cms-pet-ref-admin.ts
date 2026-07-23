import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { CmsPetReference, AuditLog } from '@pawtag/db';

const router = Router();
router.use(authenticate);

// ═══════════════════════════════════════════
// PET REFERENCE DATA
// ═══════════════════════════════════════════

router.get('/pet-references', requirePermission('cms.pet_reference.read'), async (req, res: Response) => {
  try {
    const { type, petSpecies, isActive } = req.query;
    const query: any = { deletedAt: null };
    if (type) query.type = type;
    if (petSpecies) query.petSpecies = petSpecies;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const references = await CmsPetReference.find(query)
      .populate('createdBy', 'fullName')
      .sort({ type: 1, petSpecies: 1, order: 1, label: 1 });

    res.json({ success: true, data: references });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch pet references' });
  }
});

router.get('/pet-references/grouped', requirePermission('cms.pet_reference.read'), async (_req, res: Response) => {
  try {
    const references = await CmsPetReference.find({ deletedAt: null, isActive: true })
      .sort({ type: 1, petSpecies: 1, order: 1, label: 1 });

    // Group by type and species
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

router.get('/pet-references/:id', requirePermission('cms.pet_reference.read'), async (req, res: Response) => {
  try {
    const reference = await CmsPetReference.findOne({ _id: req.params.id, deletedAt: null })
      .populate('createdBy', 'fullName email');
    if (!reference) { res.status(404).json({ success: false, error: 'Reference not found' }); return; }
    res.json({ success: true, data: reference });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch pet reference' });
  }
});

router.post('/pet-references', requirePermission('cms.pet_reference.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { type, petSpecies, label, value, order, isActive } = req.body;

    if (!type || !label || !value) {
      res.status(400).json({ success: false, error: 'type, label, and value are required' });
      return;
    }

    // Check for duplicate
    const existing = await CmsPetReference.findOne({
      type, petSpecies: petSpecies || null, value, deletedAt: null,
    });
    if (existing) {
      res.status(400).json({ success: false, error: 'A reference with this value already exists for this type/species' });
      return;
    }

    const reference = await CmsPetReference.create({
      type, petSpecies, label, value: value.toLowerCase(), order: order || 0,
      isActive: isActive !== false,
      createdBy: req.user!.id, updatedBy: req.user!.id,
    });

    await AuditLog.create({
      userId: req.user!.id, action: 'create', entity: 'CmsPetReference', entityId: reference._id.toString(),
      changes: { type, label, value },
    });

    res.status(201).json({ success: true, data: reference });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create pet reference' });
  }
});

router.put('/pet-references/:id', requirePermission('cms.pet_reference.update'), async (req: AuthRequest, res: Response) => {
  try {
    const reference = await CmsPetReference.findOne({ _id: req.params.id, deletedAt: null });
    if (!reference) { res.status(404).json({ success: false, error: 'Reference not found' }); return; }

    const updateData = { ...req.body, updatedBy: req.user!.id };
    if (updateData.value) updateData.value = updateData.value.toLowerCase();

    const updated = await CmsPetReference.findByIdAndUpdate(req.params.id, updateData, { new: true });

    await AuditLog.create({
      userId: req.user!.id, action: 'update', entity: 'CmsPetReference', entityId: req.params.id,
    });

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update pet reference' });
  }
});

router.delete('/pet-references/:id', requirePermission('cms.pet_reference.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const reference = await CmsPetReference.findOne({ _id: req.params.id, deletedAt: null });
    if (!reference) { res.status(404).json({ success: false, error: 'Reference not found' }); return; }

    reference.deletedAt = new Date();
    await reference.save();

    await AuditLog.create({
      userId: req.user!.id, action: 'soft_delete', entity: 'CmsPetReference', entityId: req.params.id,
      changes: { type: reference.type, label: reference.label },
    });

    res.json({ success: true, data: { message: 'Reference deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete pet reference' });
  }
});

router.post('/pet-references/bulk', requirePermission('cms.pet_reference.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: 'items array is required' });
      return;
    }

    const created = [];
    const errors = [];

    for (const item of items) {
      try {
        const existing = await CmsPetReference.findOne({
          type: item.type, petSpecies: item.petSpecies || null, value: item.value.toLowerCase(), deletedAt: null,
        });
        if (existing) {
          errors.push({ item, error: 'Already exists' });
          continue;
        }

        const reference = await CmsPetReference.create({
          type: item.type, petSpecies: item.petSpecies, label: item.label, value: item.value.toLowerCase(),
          order: item.order || 0, isActive: item.isActive !== false,
          createdBy: req.user!.id, updatedBy: req.user!.id,
        });
        created.push(reference);
      } catch (err) {
        errors.push({ item, error: 'Failed to create' });
      }
    }

    await AuditLog.create({
      userId: req.user!.id, action: 'bulk_create', entity: 'CmsPetReference',
      changes: { created: created.length, errors: errors.length },
    });

    res.json({ success: true, data: { created: created.length, errors: errors.length, details: errors } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to bulk create pet references' });
  }
});

export default router;

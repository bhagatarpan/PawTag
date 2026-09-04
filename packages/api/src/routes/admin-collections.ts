/**
 * @module Admin Collection Routes
 * @description Admin API routes for product collection management.
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { Collection } from '@pawtag/db';
import { toAppError } from '../lib/app-errors';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('product.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const query: Record<string, any> = {};
    if (search) query.name = { $regex: search, $options: 'i' };
    const total = await Collection.countDocuments(query);
    const items = await Collection.find(query).sort({ sortOrder: 1, name: 1 }).skip((Number(page) - 1) * Number(limit)).limit(Number(limit));
    res.json({ success: true, data: { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.get('/:id', requirePermission('product.read'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await Collection.findById(req.params.id);
    if (!item) { res.status(404).json({ success: false, error: 'Collection not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.post('/', requirePermission('product.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug, description, image, sortOrder } = req.body;
    if (!name || !slug) { res.status(400).json({ success: false, error: 'name and slug are required' }); return; }
    const item = await Collection.create({ name, slug, description, image, sortOrder });
    res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    if (err.code === 11000) { res.status(409).json({ success: false, error: 'Collection with this slug already exists' }); return; }
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

router.put('/:id', requirePermission('product.update'), async (req: AuthRequest, res: Response) => {
  try {
    /** Whitelist allowed fields — prevents mass-assignment of system-managed fields
     *  such as productCount, _id, createdAt, updatedAt */
    const { name, slug, description, image, sortOrder, isActive } = req.body;
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;

    const item = await Collection.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!item) { res.status(404).json({ success: false, error: 'Collection not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.delete('/:id', requirePermission('product.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await Collection.findByIdAndDelete(req.params.id);
    if (!item) { res.status(404).json({ success: false, error: 'Collection not found' }); return; }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

export default router;

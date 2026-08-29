/**
 * @module Admin Brand Routes
 * @description Admin API routes for brand management.
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { Brand } from '@pawtag/db';
import { toAppError } from '../lib/app-errors';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('product.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const query: Record<string, any> = {};
    if (search) query.name = { $regex: search, $options: 'i' };
    const total = await Brand.countDocuments(query);
    const items = await Brand.find(query).sort({ name: 1 }).skip((Number(page) - 1) * Number(limit)).limit(Number(limit));
    res.json({ success: true, data: { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.get('/:id', requirePermission('product.read'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await Brand.findById(req.params.id);
    if (!item) { res.status(404).json({ success: false, error: 'Brand not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.post('/', requirePermission('product.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug, description, logo, website } = req.body;
    if (!name || !slug) { res.status(400).json({ success: false, error: 'name and slug are required' }); return; }
    const item = await Brand.create({ name, slug, description, logo, website });
    res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    if (err.code === 11000) { res.status(409).json({ success: false, error: 'Brand with this slug already exists' }); return; }
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

router.put('/:id', requirePermission('product.update'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await Brand.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) { res.status(404).json({ success: false, error: 'Brand not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.delete('/:id', requirePermission('product.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await Brand.findByIdAndDelete(req.params.id);
    if (!item) { res.status(404).json({ success: false, error: 'Brand not found' }); return; }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

export default router;

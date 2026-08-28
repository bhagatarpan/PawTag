/**
 * @module Admin Shipping Routes
 * @description Admin API routes for shipping method management.
 */

import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { ShippingMethod } from '@pawtag/db';
import { toAppError } from '../lib/app-errors';

const router = Router();

router.get('/', requirePermission('setting.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const query: Record<string, any> = {};
    if (search) query.name = { $regex: search, $options: 'i' };
    const total = await ShippingMethod.countDocuments(query);
    const items = await ShippingMethod.find(query).sort({ sortOrder: 1, name: 1 }).skip((Number(page) - 1) * Number(limit)).limit(Number(limit));
    res.json({ success: true, data: { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.get('/:id', requirePermission('setting.read'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await ShippingMethod.findById(req.params.id);
    if (!item) { res.status(404).json({ success: false, error: 'Shipping method not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.post('/', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await ShippingMethod.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.put('/:id', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await ShippingMethod.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) { res.status(404).json({ success: false, error: 'Shipping method not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.delete('/:id', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await ShippingMethod.findByIdAndDelete(req.params.id);
    if (!item) { res.status(404).json({ success: false, error: 'Shipping method not found' }); return; }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

export default router;

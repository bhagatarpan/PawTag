/**
 * @module Admin Category Routes
 * @description Admin API routes for product category management.
 *
 * Provides CRUD operations for categories with hierarchy support.
 *
 * Routes:
 * - GET    /api/admin/commerce/categories       — List categories
 * - GET    /api/admin/commerce/categories/:id   — Get category
 * - POST   /api/admin/commerce/categories       — Create category
 * - PUT    /api/admin/commerce/categories/:id   — Update category
 * - DELETE /api/admin/commerce/categories/:id   — Delete category
 */

import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { Category } from '@pawtag/db';
import { toAppError } from '../lib/app-errors';
import logger from '../lib/logger';

const router = Router();

router.get('/', requirePermission('product.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50, search, parentId } = req.query;
    const query: Record<string, any> = {};
    if (search) query.name = { $regex: search, $options: 'i' };
    if (parentId) query.parentId = parentId;
    else if (parentId === 'null') query.parentId = null;

    const total = await Category.countDocuments(query);
    const categories = await Category.find(query)
      .sort({ sortOrder: 1, name: 1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({ success: true, data: { items: categories, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.get('/:id', requirePermission('product.read'), async (req: AuthRequest, res: Response) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) { res.status(404).json({ success: false, error: 'Category not found' }); return; }
    res.json({ success: true, data: category });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.post('/', requirePermission('product.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug, description, parentId, image, sortOrder } = req.body;
    if (!name || !slug) { res.status(400).json({ success: false, error: 'name and slug are required' }); return; }
    const category = await Category.create({ name, slug, description, parentId, image, sortOrder });
    res.status(201).json({ success: true, data: category });
  } catch (err: any) {
    if (err.code === 11000) { res.status(409).json({ success: false, error: 'Category with this slug already exists' }); return; }
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

router.put('/:id', requirePermission('product.update'), async (req: AuthRequest, res: Response) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!category) { res.status(404).json({ success: false, error: 'Category not found' }); return; }
    res.json({ success: true, data: category });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.delete('/:id', requirePermission('product.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) { res.status(404).json({ success: false, error: 'Category not found' }); return; }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

export default router;

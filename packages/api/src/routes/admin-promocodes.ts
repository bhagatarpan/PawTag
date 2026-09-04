/**
 * @module Admin PromoCode Routes
 * @description Admin API routes for discount code management.
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { PromoCode } from '@pawtag/db';
import { toAppError } from '../lib/app-errors';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('product.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;
    const query: Record<string, any> = {};
    if (search) query.code = { $regex: search, $options: 'i' };
    if (isActive !== undefined) query.isActive = isActive === 'true';
    const total = await PromoCode.countDocuments(query);
    const items = await PromoCode.find(query).sort({ createdAt: -1 }).skip((Number(page) - 1) * Number(limit)).limit(Number(limit));
    res.json({ success: true, data: { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.get('/:id', requirePermission('product.read'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await PromoCode.findById(req.params.id);
    if (!item) { res.status(404).json({ success: false, error: 'Discount code not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.post('/', requirePermission('product.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { code, description, discountType, discountValue, maxDiscountAmount, minOrderAmount, usageLimit, perUserLimit, startsAt, expiresAt } = req.body;
    if (!code || !discountType || discountValue === undefined) {
      res.status(400).json({ success: false, error: 'code, discountType, and discountValue are required' }); return;
    }
    const item = await PromoCode.create({ code, description, discountType, discountValue, maxDiscountAmount, minOrderAmount, usageLimit, perUserLimit, startsAt, expiresAt, createdBy: req.user!.id });
    logger.info({ promoCode: item.code, createdBy: req.user!.id }, 'Promo code created');
    res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    if (err.code === 11000) { res.status(409).json({ success: false, error: 'Discount code with this code already exists' }); return; }
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

router.put('/:id', requirePermission('product.update'), async (req: AuthRequest, res: Response) => {
  try {
    /** Whitelist allowed fields — prevents mass-assignment of system-managed fields
     *  such as usageCount, createdBy, _id, createdAt, updatedAt */
    const { code, description, discountType, discountValue, maxDiscountAmount, minOrderAmount, usageLimit, perUserLimit, startsAt, expiresAt, isActive, applicableProducts, applicableCategories } = req.body;
    const updateData: Record<string, any> = {};
    if (code !== undefined) updateData.code = code;
    if (description !== undefined) updateData.description = description;
    if (discountType !== undefined) updateData.discountType = discountType;
    if (discountValue !== undefined) updateData.discountValue = discountValue;
    if (maxDiscountAmount !== undefined) updateData.maxDiscountAmount = maxDiscountAmount;
    if (minOrderAmount !== undefined) updateData.minOrderAmount = minOrderAmount;
    if (usageLimit !== undefined) updateData.usageLimit = usageLimit;
    if (perUserLimit !== undefined) updateData.perUserLimit = perUserLimit;
    if (startsAt !== undefined) updateData.startsAt = startsAt;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (applicableProducts !== undefined) updateData.applicableProducts = applicableProducts;
    if (applicableCategories !== undefined) updateData.applicableCategories = applicableCategories;

    const item = await PromoCode.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!item) { res.status(404).json({ success: false, error: 'Discount code not found' }); return; }
    logger.info({ promoCode: item.code, updatedBy: req.user!.id, fields: Object.keys(updateData) }, 'Promo code updated');
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.delete('/:id', requirePermission('product.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await PromoCode.findByIdAndDelete(req.params.id);
    if (!item) { res.status(404).json({ success: false, error: 'Discount code not found' }); return; }
    logger.info({ promoCode: item.code, deletedBy: req.user!.id }, 'Promo code deleted');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

export default router;

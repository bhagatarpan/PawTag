/**
 * @module Admin Returns Routes
 * @description Admin API routes for return request management.
 */

import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { Return } from '@pawtag/db';
import { toAppError } from '../lib/app-errors';
import logger from '../lib/logger';

const router = Router();

router.get('/', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query: Record<string, any> = {};
    if (status) query.status = status;
    const total = await Return.countDocuments(query);
    const items = await Return.find(query).sort({ createdAt: -1 }).skip((Number(page) - 1) * Number(limit)).limit(Number(limit)).populate('userId', 'fullName email').populate('orderId', 'orderNumber');
    res.json({ success: true, data: { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.get('/:id', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await Return.findById(req.params.id).populate('userId', 'fullName email').populate('orderId', 'orderNumber status');
    if (!item) { res.status(404).json({ success: false, error: 'Return not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.put('/:id/status', requirePermission('order.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, refundAmount, notes } = req.body;
    const update: Record<string, any> = { status, reviewedBy: req.user!.id, reviewedAt: new Date() };
    if (refundAmount !== undefined) update.refundAmount = refundAmount;
    if (notes) update.notes = notes;
    if (status === 'received') update.receivedAt = new Date();
    const item = await Return.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!item) { res.status(404).json({ success: false, error: 'Return not found' }); return; }
    logger.info({ returnId: req.params.id, status }, 'Return status updated');
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

export default router;

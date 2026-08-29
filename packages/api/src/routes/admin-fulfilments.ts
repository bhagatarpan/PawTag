/**
 * @module Admin Fulfilment Routes
 * @description Admin API routes for order fulfilment management.
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { Fulfilment, Order } from '@pawtag/db';
import { toAppError } from '../lib/app-errors';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const query: Record<string, any> = {};
    if (status) query.status = status;
    if (search) query.orderNumber = { $regex: search, $options: 'i' };
    const total = await Fulfilment.countDocuments(query);
    const items = await Fulfilment.find(query).sort({ createdAt: -1 }).skip((Number(page) - 1) * Number(limit)).limit(Number(limit));
    res.json({ success: true, data: { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.get('/:id', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await Fulfilment.findById(req.params.id).populate('orderId', 'orderNumber status');
    if (!item) { res.status(404).json({ success: false, error: 'Fulfilment not found' }); return; }
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.post('/', requirePermission('order.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, items, notes } = req.body;
    if (!orderId || !items?.length) { res.status(400).json({ success: false, error: 'orderId and items are required' }); return; }
    const order = await Order.findById(orderId);
    if (!order) { res.status(404).json({ success: false, error: 'Order not found' }); return; }
    const fulfilment = await Fulfilment.create({ orderId, orderNumber: order.orderNumber, items, notes });
    res.status(201).json({ success: true, data: fulfilment });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

router.put('/:id/status', requirePermission('order.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const update: Record<string, any> = { status };
    if (status === 'fulfilled') update.fulfilledAt = new Date();
    const item = await Fulfilment.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!item) { res.status(404).json({ success: false, error: 'Fulfilment not found' }); return; }
    logger.info({ fulfilmentId: req.params.id, status }, 'Fulfilment status updated');
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

export default router;

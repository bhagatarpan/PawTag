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
import { auditService, type AuditContext } from '../services/audit';
import { createAuditContextFromRequest, type AuditRequest } from '../middleware/audit';

const router = Router();
router.use(authenticate);

async function auditFulfilmentEvent(
  req: AuditRequest,
  input: Parameters<typeof auditService.log>[1],
  overrides: Partial<AuditContext> = {},
): Promise<void> {
  const reqContext = req.auditContext as AuditContext;
  if (!reqContext) {
    throw new Error('Audit middleware not applied - request has no audit context missing');
  }
  const context: AuditContext = {
    ...reqContext,
    ...overrides,
  } as AuditContext;
  await auditService.log(context, input);
}

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

/**
 * PUT /api/admin/fulfilments/:id
 *
 * Update fulfilment details: notes and assignedTo.
 * Allows partial updates — only provided fields are applied.
 */
router.put('/:id', requirePermission('order.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { notes, assignedTo } = req.body;
    const updateData: Record<string, any> = {};
    if (notes !== undefined) updateData.notes = notes;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ success: false, error: 'No fields to update' });
      return;
    }

    const existing = await Fulfilment.findById(req.params.id);
    if (!existing) { res.status(404).json({ success: false, error: 'Fulfilment not found' }); return; }

    const item = await Fulfilment.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!item) { res.status(404).json({ success: false, error: 'Fulfilment not found' }); return; }

    await auditFulfilmentEvent(req, {
      action: 'fulfilment_update',
      eventType: 'fulfilment.updated',
      eventCategory: 'UPDATE',
      operationType: 'UPDATE',
      resourceType: 'Fulfilment',
      resourceId: req.params.id,
      beforeState: { 
        notes: existing.notes, 
        assignedTo: existing.assignedTo?.toString() 
      },
      afterState: { 
        notes: item.notes, 
        assignedTo: item.assignedTo?.toString() 
      },
      changedFields: Object.keys(updateData).map(key => ({
        field: key,
        before: (existing as any)[key],
        after: (item as any)[key]
      })),
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: { orderNumber: item.orderNumber },
    });

logger.info({ fulfilmentId: req.params.id, updatedFields: Object.keys(updateData), updatedBy: req.user!.id }, 'Fulfilment updated');
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, error: toAppError(err).userMessage }); }
});

export default router;
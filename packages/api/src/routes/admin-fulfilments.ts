/**
 * @module Admin Fulfilment Routes
 * @description Admin API routes for order fulfilment management.
 */

import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { Fulfilment, Order, Tag, Product } from '@pawtag/db';
import { toAppError } from '../lib/app-errors';
import logger from '../lib/logger';
import { auditService, type AuditContext } from '../services/audit';
import { createAuditContextFromRequest, type AuditRequest } from '../middleware/audit';
import { generateTagId } from '../lib/tag-id';

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

/**
 * POST /api/admin/fulfilments/:id/assign-tag
 *
 * Assign a Tag ID to a fulfilment item during warehouse packing.
 * This creates the Tag record with Active Period and Warranty Period dates.
 *
 * HYBRID 2 Model: Tag IDs are created at fulfillment time, not order time.
 * This ensures the Active Period starts when the customer receives the tag.
 */
router.post('/:id/assign-tag', requirePermission('order.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { orderItemId, productId } = req.body;
    
    if (!orderItemId || !productId) {
      res.status(400).json({ success: false, error: 'orderItemId and productId are required' });
      return;
    }

    // Find the fulfilment
    const fulfilment = await Fulfilment.findById(req.params.id);
    if (!fulfilment) {
      res.status(404).json({ success: false, error: 'Fulfilment not found' });
      return;
    }

    // Find the order
    const order = await Order.findById(fulfilment.orderId);
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    // Find the product to get period configuration
    const product = await Product.findById(productId).lean();
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    // Check if product is a tag product
    if (!product.isTagProduct && product.productType !== 'physical') {
      res.status(400).json({ success: false, error: 'Product is not a tag product' });
      return;
    }

    // Check if this order item already has a tag assigned
    const existingTag = await Tag.findOne({
      orderId: order._id,
      'orderItemId': orderItemId,
    });
    if (existingTag) {
      res.status(409).json({ success: false, error: 'Tag already assigned to this order item', tagId: existingTag.tagId });
      return;
    }

    // Generate Tag ID
    const tagIdStr = await generateTagId();

    // Calculate Active Period and Warranty Period dates
    const now = new Date();
    const activePeriodEndsAt = new Date(now);
    activePeriodEndsAt.setMonth(activePeriodEndsAt.getMonth() + (product.activePeriodMonths || 3));

    const warrantyEndsAt = new Date(now);
    warrantyEndsAt.setMonth(warrantyEndsAt.getMonth() + (product.warrantyMonths || 12));

    // Create Tag record
    const tag = await Tag.create({
      tagId: tagIdStr,
      tagType: 'qr',
      petId: null,
      ownerId: order.userId,
      orderId: order._id,
      status: 'inactive',
      subscriptionStatus: 'none',
      activatedAt: null,
      activePeriodEndsAt,
      warrantyEndsAt,
    });

    // Update fulfilment with tag assignment
    fulfilment.tagAssignment = {
      tagId: tagIdStr,
      productId: new mongoose.Types.ObjectId(productId),
      orderItemId: new mongoose.Types.ObjectId(orderItemId),
      nfcWritten: false,
      assignedAt: now,
      assignedBy: new mongoose.Types.ObjectId(req.user!.id),
    };
    await fulfilment.save();

    // Audit log
    await auditFulfilmentEvent(req, {
      action: 'tag_assigned',
      eventType: 'fulfilment.tag_assigned',
      eventCategory: 'UPDATE',
      operationType: 'UPDATE',
      resourceType: 'Tag',
      resourceId: tag._id.toString(),
      afterState: {
        tagId: tagIdStr,
        orderId: order._id.toString(),
        activePeriodEndsAt: activePeriodEndsAt.toISOString(),
        warrantyEndsAt: warrantyEndsAt.toISOString(),
      },
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: {
        orderNumber: order.orderNumber,
        fulfilmentId: fulfilment._id.toString(),
        productId: productId,
      },
    });

    logger.info({
      tagId: tagIdStr,
      orderId: order.orderNumber,
      fulfilmentId: fulfilment._id,
      activePeriodMonths: product.activePeriodMonths || 3,
      warrantyMonths: product.warrantyMonths || 12,
      assignedBy: req.user!.id,
    }, 'Tag assigned during fulfillment');

    res.status(201).json({
      success: true,
      data: {
        tagId: tagIdStr,
        activePeriodEndsAt,
        warrantyEndsAt,
        message: 'Tag assigned. Staff can now write this Tag ID to the NFC chip.',
      },
    });
  } catch (err) {
    logger.error({ err, fulfilmentId: req.params.id }, 'Failed to assign tag');
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

/**
 * PUT /api/admin/fulfilments/:id/confirm-nfc
 *
 * Confirm that NFC has been written for an assigned tag.
 */
router.put('/:id/confirm-nfc', requirePermission('order.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { tagId } = req.body;
    
    if (!tagId) {
      res.status(400).json({ success: false, error: 'tagId is required' });
      return;
    }

    const fulfilment = await Fulfilment.findById(req.params.id);
    if (!fulfilment) {
      res.status(404).json({ success: false, error: 'Fulfilment not found' });
      return;
    }

    if (fulfilment.tagAssignment?.tagId !== tagId) {
      res.status(400).json({ success: false, error: 'Tag ID does not match fulfilment assignment' });
      return;
    }

    // Update fulfilment
    if (fulfilment.tagAssignment) {
      fulfilment.tagAssignment.nfcWritten = true;
      fulfilment.tagAssignment.confirmedAt = new Date();
      fulfilment.tagAssignment.confirmedBy = new mongoose.Types.ObjectId(req.user!.id);
    }
    await fulfilment.save();

    // Update tag NFC status
    const tag = await Tag.findOne({ tagId });
    if (tag) {
      tag.nfcEnabled = true;
      await tag.save();
    }

    // Audit log
    await auditFulfilmentEvent(req, {
      action: 'nfc_confirmed',
      eventType: 'fulfilment.nfc_confirmed',
      eventCategory: 'UPDATE',
      operationType: 'UPDATE',
      resourceType: 'Fulfilment',
      resourceId: fulfilment._id.toString(),
      afterState: {
        tagId,
        nfcWritten: true,
      },
      outcome: 'SUCCESS',
      severity: 'LOW',
      metadata: {
        orderNumber: fulfilment.orderNumber,
        confirmedBy: req.user!.id,
      },
    });

    logger.info({
      fulfilmentId: fulfilment._id,
      tagId,
      confirmedBy: req.user!.id,
    }, 'NFC write confirmed');

    res.json({
      success: true,
      data: {
        tagId,
        nfcWritten: true,
        message: 'NFC write confirmed. Tag is ready for shipping.',
      },
    });
  } catch (err) {
    logger.error({ err, fulfilmentId: req.params.id }, 'Failed to confirm NFC write');
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

export default router;
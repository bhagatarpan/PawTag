/**
 * @module Admin Digital Product Routes
 * @description Admin CRUD routes for digital products.
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { DigitalProduct, Product } from '@pawtag/db';
import { NotFoundError, ValidationError } from '../lib/app-errors';
import { auditService } from '../services/audit';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

/**
 * GET /api/admin/digital-products
 * List all digital products with pagination
 */
router.get('/', requirePermission('product.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, search } = _req.query;
    const query: any = {};

    if (search) {
      const productIds = await Product.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } },
        ],
      }).distinct('_id');
      query.productId = { $in: productIds };
    }

    const total = await DigitalProduct.countDocuments(query);
    const items = await DigitalProduct.find(query)
      .populate('productId', 'name sku price images')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list digital products');
    res.status(500).json({ success: false, error: 'Failed to list digital products' });
  }
});

/**
 * GET /api/admin/digital-products/:id
 * Get a single digital product
 */
router.get('/:id', requirePermission('product.read'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await DigitalProduct.findById(req.params.id).populate('productId', 'name sku price images description');
    if (!item) throw new NotFoundError('Digital product');

    res.json({ success: true, data: item });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({ success: false, error: error.message });
    } else {
      logger.error({ error }, 'Failed to get digital product');
      res.status(500).json({ success: false, error: 'Failed to get digital product' });
    }
  }
});

/**
 * POST /api/admin/digital-products
 * Create a new digital product
 */
router.post('/', requirePermission('product.create'), async (req: AuthRequest, res: Response) => {
  try {
    const { productId, fileUrl, accessType, accessDurationDays, downloadLimit, fileSize, mimeType, accessInstructions } = req.body;

    if (!productId || !fileUrl) {
      throw new ValidationError('productId and fileUrl are required');
    }

    // Verify the product exists and has productType 'digital'
    const product = await Product.findById(productId);
    if (!product) throw new NotFoundError('Product');
    if (product.productType !== 'digital') {
      throw new ValidationError('Product must have productType "digital"');
    }

    // Check if digital product already exists for this product
    const existing = await DigitalProduct.findOne({ productId });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Digital product already exists for this product' });
    }

    const item = await DigitalProduct.create({
      productId,
      fileUrl,
      accessType: accessType || 'permanent',
      accessDurationDays,
      downloadLimit: downloadLimit || 0,
      fileSize,
      mimeType,
      accessInstructions,
    });

    await auditService.log(
      (req as any).auditContext || { actorType: 'admin', actorId: req.user?.id },
      {
        action: 'digital_product.created',
        eventType: 'digital_product_create',
        eventCategory: 'CREATE',
        operationType: 'CREATE',
        resourceType: 'DigitalProduct',
        resourceId: item._id.toString(),
        outcome: 'SUCCESS',
        severity: 'LOW',
      }
    );

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
    } else if (error instanceof NotFoundError) {
      res.status(404).json({ success: false, error: error.message });
    } else {
      logger.error({ error }, 'Failed to create digital product');
      res.status(500).json({ success: false, error: 'Failed to create digital product' });
    }
  }
});

/**
 * PUT /api/admin/digital-products/:id
 * Update a digital product
 */
router.put('/:id', requirePermission('product.update'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await DigitalProduct.findById(req.params.id);
    if (!item) throw new NotFoundError('Digital product');

    const { fileUrl, accessType, accessDurationDays, downloadLimit, fileSize, mimeType, accessInstructions, isActive } = req.body;

    if (fileUrl !== undefined) item.fileUrl = fileUrl;
    if (accessType !== undefined) item.accessType = accessType;
    if (accessDurationDays !== undefined) item.accessDurationDays = accessDurationDays;
    if (downloadLimit !== undefined) item.downloadLimit = downloadLimit;
    if (fileSize !== undefined) item.fileSize = fileSize;
    if (mimeType !== undefined) item.mimeType = mimeType;
    if (accessInstructions !== undefined) item.accessInstructions = accessInstructions;
    if (isActive !== undefined) item.isActive = isActive;

    await item.save();

    await auditService.log(
      (req as any).auditContext || { actorType: 'admin', actorId: req.user?.id },
      {
        action: 'digital_product.updated',
        eventType: 'digital_product_update',
        eventCategory: 'UPDATE',
        operationType: 'UPDATE',
        resourceType: 'DigitalProduct',
        resourceId: item._id.toString(),
        outcome: 'SUCCESS',
        severity: 'LOW',
      }
    );

    res.json({ success: true, data: item });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({ success: false, error: error.message });
    } else {
      logger.error({ error }, 'Failed to update digital product');
      res.status(500).json({ success: false, error: 'Failed to update digital product' });
    }
  }
});

/**
 * DELETE /api/admin/digital-products/:id
 * Delete a digital product
 */
router.delete('/:id', requirePermission('product.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const item = await DigitalProduct.findById(req.params.id);
    if (!item) throw new NotFoundError('Digital product');

    await DigitalProduct.deleteOne({ _id: req.params.id });

    await auditService.log(
      (req as any).auditContext || { actorType: 'admin', actorId: req.user?.id },
      {
        action: 'digital_product.deleted',
        eventType: 'digital_product_delete',
        eventCategory: 'DELETE',
        operationType: 'DELETE',
        resourceType: 'DigitalProduct',
        resourceId: req.params.id,
        outcome: 'SUCCESS',
        severity: 'MEDIUM',
      }
    );

    res.json({ success: true, message: 'Digital product deleted' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({ success: false, error: error.message });
    } else {
      logger.error({ error }, 'Failed to delete digital product');
      res.status(500).json({ success: false, error: 'Failed to delete digital product' });
    }
  }
});

export default router;

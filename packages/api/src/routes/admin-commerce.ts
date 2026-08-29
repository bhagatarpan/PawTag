/**
 * @module Commerce Admin Routes
 * @description Admin API routes for commerce management.
 *
 * Provides CRUD operations for:
 * - Products (list, create, update, delete)
 * - Orders (list, detail, status update, refund, ship)
 * - Inventory (stock levels, adjustments, movements)
 * - Shipping configuration
 * - Tax configuration
 * - Commerce settings (all commerce.* settings)
 *
 * All routes require admin authentication + permissions.
 *
 * RBAC permissions:
 * - product.read / product.create / product.update / product.delete
 * - order.read / order.update / order.refund / order.ship
 * - inventory.read / inventory.adjust
 * - setting.read / setting.update
 *
 * @example
 * ```typescript
 * // GET /api/admin/commerce/products?page=1&limit=20
 * // POST /api/admin/commerce/products { name, sku, price, ... }
 * // PUT /api/admin/commerce/products/:id { price: 24.99 }
 * // DELETE /api/admin/commerce/products/:id
 * ```
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { productService } from '../commerce/services/product.service';
import { inventoryService } from '../commerce/services/inventory.service';
import { shippingService } from '../commerce/services/shipping.service';
import { refundService } from '../commerce/services/refund.service';
import { getAllSettings, updateSetting, type CommerceSettingKey } from '../commerce/config';
import { logOrderEvent } from '../commerce/audit';
import { isValidTransition } from '../services/orderStatus.service';
import { Order, Invoice, type IOrderDocument } from '@pawtag/db';
import { toAppError } from '../lib/app-errors';
import { auditService } from '../services/audit';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

// ─── Product Management ─────────────────────────────────────────

/**
 * GET /api/admin/commerce/products
 *
 * List products with filtering, sorting, and pagination.
 */
router.get('/products', requirePermission('product.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, search, category, isActive, stockStatus, sortBy, sortDir } = req.query;

    const result = await productService.list(
      {
        search: search as string,
        category: category as string,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        stockStatus: stockStatus as 'in' | 'low' | 'out',
      },
      {
        page: Number(page),
        limit: Math.min(Number(limit), 100),
        sortBy: sortBy as string,
        sortDir: sortDir as 'asc' | 'desc',
      },
    );

    res.json({ success: true, data: result });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * GET /api/admin/commerce/products/:id
 *
 * Get a single product by ID.
 */
router.get('/products/:id', requirePermission('product.read'), async (req: AuthRequest, res: Response) => {
  try {
    const product = await productService.getById(req.params.id);
    res.json({ success: true, data: product });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * POST /api/admin/commerce/products
 *
 * Create a new product.
 */
router.post('/products', requirePermission('product.create'), async (req: AuthRequest, res: Response) => {
  try {
    const product = await productService.create(req.body);

    await auditService.log(
      { actorType: 'ADMIN', actorId: req.user!.id, actorUsername: req.user!.email },
      {
        action: 'product_created',
        eventType: 'admin.product.created',
        eventCategory: 'INTEGRATION',
        operationType: 'CREATE',
        resourceType: 'Product',
        resourceId: String(product._id),
        outcome: 'SUCCESS',
        severity: 'MEDIUM',
        metadata: { name: product.name, sku: product.sku, price: product.price },
      },
    );

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * PUT /api/admin/commerce/products/:id
 *
 * Update a product.
 */
router.put('/products/:id', requirePermission('product.update'), async (req: AuthRequest, res: Response) => {
  try {
    const product = await productService.update(req.params.id, req.body);

    await auditService.log(
      { actorType: 'ADMIN', actorId: req.user!.id, actorUsername: req.user!.email },
      {
        action: 'product_updated',
        eventType: 'admin.product.updated',
        eventCategory: 'INTEGRATION',
        operationType: 'UPDATE',
        resourceType: 'Product',
        resourceId: String(product._id),
        outcome: 'SUCCESS',
        severity: 'MEDIUM',
        metadata: { name: product.name, sku: product.sku },
      },
    );

    res.json({ success: true, data: product });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * DELETE /api/admin/commerce/products/:id
 *
 * Delete a product.
 */
router.delete('/products/:id', requirePermission('product.delete'), async (req: AuthRequest, res: Response) => {
  try {
    await productService.delete(req.params.id);

    await auditService.log(
      { actorType: 'ADMIN', actorId: req.user!.id, actorUsername: req.user!.email },
      {
        action: 'product_deleted',
        eventType: 'admin.product.deleted',
        eventCategory: 'INTEGRATION',
        operationType: 'DELETE',
        resourceType: 'Product',
        resourceId: req.params.id,
        outcome: 'SUCCESS',
        severity: 'HIGH',
      },
    );

    res.json({ success: true });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

// ─── Inventory Management ───────────────────────────────────────

/**
 * GET /api/admin/commerce/inventory/:productId
 *
 * Get inventory status for a product.
 */
router.get('/inventory/:productId', requirePermission('inventory.read'), async (req: AuthRequest, res: Response) => {
  try {
    const status = await inventoryService.getStatus(req.params.productId);
    res.json({ success: true, data: status });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * POST /api/admin/commerce/inventory/:productId/adjust
 *
 * Adjust stock level for a product.
 * Body: { quantity, reason }
 */
router.post('/inventory/:productId/adjust', requirePermission('inventory.adjust'), async (req: AuthRequest, res: Response) => {
  try {
    const { quantity, reason } = req.body;

    if (quantity === undefined || !reason) {
      res.status(400).json({ success: false, error: 'quantity and reason are required' });
      return;
    }

    await inventoryService.adjust({
      productId: req.params.productId,
      quantity,
      reason,
      actor: req.user!.email,
    });

    res.json({ success: true });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * GET /api/admin/commerce/inventory/:productId/movements
 *
 * Get stock movement history for a product.
 */
router.get('/inventory/:productId/movements', requirePermission('inventory.read'), async (req: AuthRequest, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const movements = await inventoryService.getMovements(req.params.productId, limit);
    res.json({ success: true, data: movements });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

// ─── Order Management ──────────────────────────────────────────

/**
 * GET /api/admin/commerce/orders
 *
 * List orders with filtering and pagination.
 */
router.get('/orders', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, status, search, sortBy = 'createdAt', sortDir = 'desc' } = req.query;

    const query: Record<string, any> = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'payment.transactionId': { $regex: search, $options: 'i' } },
      ];
    }

    const sort: Record<string, 1 | -1> = {};
    sort[sortBy as string] = sortDir === 'asc' ? 1 : -1;

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .sort(sort)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      data: {
        items: orders,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * GET /api/admin/commerce/orders/:id
 *
 * Get order details.
 */
router.get('/orders/:id', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    res.json({ success: true, data: order });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * POST /api/admin/commerce/orders/:id/refund
 *
 * Process a refund for an order.
 * Body: { amount?, reason }
 */
router.post('/orders/:id/refund', requirePermission('order.refund'), async (req: AuthRequest, res: Response) => {
  try {
    const { amount, reason } = req.body;

    const result = await refundService.processRefund(req.params.id, {
      amount,
      reason,
      initiatedBy: req.user!.email,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * POST /api/admin/commerce/orders/:id/ship
 *
 * Create a shipment for an order.
 */
router.post('/orders/:id/ship', requirePermission('order.update'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await shippingService.createShipment(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * POST /api/admin/commerce/orders/:id/cancel
 *
 * Cancel an order and release reserved stock.
 * Body: { reason }
 */
router.post('/orders/:id/cancel', requirePermission('order.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ success: false, error: 'Cancellation reason is required' });
      return;
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    if (!isValidTransition(order.status, 'cancelled')) {
      res.status(400).json({ success: false, error: `Cannot cancel order in "${order.status}" status` });
      return;
    }

    const previousStatus = order.status;
    order.status = 'cancelled';
    order.cancellationReason = reason;
    await order.save();

    // Release reserved stock
    await inventoryService.releaseForOrder(String(order._id), order.items.map((item: any) => ({
      productId: String(item.productId),
      quantity: item.quantity,
    })));

    // Audit log
    await logOrderEvent('cancelled', {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      amount: order.payment.amount,
      reason,
    });

    res.json({ success: true, data: order });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

// ─── Invoice Management ──────────────────────────────────────

/**
 * GET /api/admin/commerce/invoices
 *
 * List invoices with filtering and pagination.
 */
router.get('/invoices', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, status, search, sortBy = 'createdAt', sortDir = 'desc' } = req.query;

    const query: Record<string, any> = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const sort: Record<string, 1 | -1> = {};
    sort[sortBy as string] = sortDir === 'asc' ? 1 : -1;

    const total = await Invoice.countDocuments(query);
    const invoices = await Invoice.find(query)
      .sort(sort)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .populate('userId', 'fullName email')
      .populate('orderId', 'orderNumber');

    res.json({
      success: true,
      data: {
        items: invoices,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * GET /api/admin/commerce/invoices/:id
 *
 * Get invoice details.
 */
router.get('/invoices/:id', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('userId', 'fullName email phoneNumber')
      .populate('orderId', 'orderNumber items status');
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }
    res.json({ success: true, data: invoice });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

// ─── Settings Management ────────────────────────────────────────

/**
 * GET /api/admin/commerce/settings
 *
 * Get all commerce settings.
 */
router.get('/settings', requirePermission('setting.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await getAllSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

/**
 * PUT /api/admin/commerce/settings
 *
 * Update commerce settings.
 * Body: { settings: { key: value, ... } }
 */
router.put('/settings', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ success: false, error: 'settings object is required' });
      return;
    }

    for (const [key, value] of Object.entries(settings)) {
      await updateSetting(key as CommerceSettingKey, value as string, req.user!.email);
    }

    await auditService.log(
      { actorType: 'ADMIN', actorId: req.user!.id, actorUsername: req.user!.email },
      {
        action: 'commerce_settings_updated',
        eventType: 'admin.commerce.settings_updated',
        eventCategory: 'INTEGRATION',
        operationType: 'UPDATE',
        resourceType: 'Setting',
        outcome: 'SUCCESS',
        severity: 'MEDIUM',
        metadata: { updatedKeys: Object.keys(settings) },
      },
    );

    res.json({ success: true });
  } catch (err) {
    const error = toAppError(err);
    res.status(error.httpStatus).json({ success: false, error: error.userMessage });
  }
});

export default router;

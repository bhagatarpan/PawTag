/**
 * @module Admin Shipment Routes
 * @description Admin API routes for shipment management.
 *
 * Provides endpoints for:
 * - Listing shipments with pagination and filters
 * - Viewing shipment details
 * - Creating shipments from orders
 * - Updating shipment status
 * - Fetching tracking events from carrier
 * - Polling tracking updates for all active shipments
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { shipmentService } from '../commerce/services/shipment.service';
import { generateShippingLabelHtml } from '../services/shipping-label.service';
import { toAppError } from '../lib/app-errors';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

/**
 * GET /api/admin/commerce/shipments
 * List shipments with pagination and filtering.
 */
router.get('/', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, status, carrier, search } = req.query;

    const result = await shipmentService.listShipments({
      page: Number(page),
      limit: Number(limit),
      status: status as any,
      carrier: carrier as string,
      search: search as string,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

/**
 * GET /api/admin/commerce/shipments/:id
 * Get shipment details by ID.
 */
router.get('/:id', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const shipment = await shipmentService.getShipment(req.params.id);
    if (!shipment) {
      res.status(404).json({ success: false, error: 'Shipment not found' });
      return;
    }
    res.json({ success: true, data: shipment });
  } catch (err) {
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

/**
 * POST /api/admin/commerce/shipments
 * Create a new shipment for an order.
 */
router.post('/', requirePermission('order.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, fulfilmentId, carrier, notes } = req.body;

    if (!orderId) {
      res.status(400).json({ success: false, error: 'orderId is required' });
      return;
    }

    const shipment = await shipmentService.createShipment({
      orderId,
      fulfilmentId,
      carrier,
      notes,
    });

    res.status(201).json({ success: true, data: shipment });
  } catch (err) {
    const appErr = toAppError(err);
    res.status(appErr.httpStatus || 500).json({ success: false, error: appErr.userMessage });
  }
});

/**
 * PUT /api/admin/commerce/shipments/:id/status
 * Update shipment status.
 */
router.put('/:id/status', requirePermission('order.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, notes } = req.body;

    if (!status) {
      res.status(400).json({ success: false, error: 'status is required' });
      return;
    }

    const shipment = await shipmentService.updateStatus(req.params.id, status, notes);
    res.json({ success: true, data: shipment });
  } catch (err) {
    const appErr = toAppError(err);
    res.status(appErr.httpStatus || 500).json({ success: false, error: appErr.userMessage });
  }
});

/**
 * GET /api/admin/commerce/shipments/:id/tracking
 * Get tracking events for a shipment from the carrier API.
 */
router.get('/:id/tracking', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const events = await shipmentService.getTrackingEvents(req.params.id);
    res.json({ success: true, data: events });
  } catch (err) {
    const appErr = toAppError(err);
    res.status(appErr.httpStatus || 500).json({ success: false, error: appErr.userMessage });
  }
});

/**
 * GET /api/admin/commerce/shipments/:id/label
 * Generate a printable HTML shipping label.
 */
router.get('/:id/label', requirePermission('order.read'), async (req: AuthRequest, res: Response) => {
  try {
    const html = await generateShippingLabelHtml(req.params.id);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    const appErr = toAppError(err);
    res.status(appErr.httpStatus || 500).json({ success: false, error: appErr.userMessage });
  }
});

/**
 * POST /api/admin/commerce/shipments/poll-tracking
 * Poll all active shipments for tracking updates from carriers.
 */
router.post('/poll-tracking', requirePermission('order.update'), async (_req: AuthRequest, res: Response) => {
  try {
    const result = await shipmentService.pollTrackingUpdates();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: toAppError(err).userMessage });
  }
});

export default router;

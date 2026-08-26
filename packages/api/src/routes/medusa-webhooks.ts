import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Order, User, WebhookEvent, Notification as PawTagNotification } from '@pawtag/db';
import logger from '../lib/logger';
import { auditService, type AuditContext } from '../services/audit';

const router = Router();

const WEBHOOK_SECRET = process.env.MEDUSA_WEBHOOK_SECRET || '';

// Record an activity entry on an order's activity timeline
export async function recordOrderActivity(
  orderId: any,
  type: string,
  message: string,
  actor: 'system' | 'admin' | 'customer' = 'system',
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await Order.findByIdAndUpdate(orderId, {
      $push: {
        activity: {
          type,
          message,
          timestamp: new Date(),
          actor,
          metadata,
        },
      },
    });
  } catch (err) {
    logger.error({ err, orderId, type }, 'Failed to record order activity');
  }
}

// Verify Medusa webhook signature (HMAC SHA-256)
function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    // No secret configured — skip verification (dev mode)
    return true;
  }
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// Audit webhook events
async function auditMedusaEvent(
  event: string,
  data: Record<string, unknown>,
  overrides: Partial<AuditContext> = {},
): Promise<void> {
  const logAudit = async () => {
    try {
      await auditService.log({
        actorType: 'WEBHOOK',
        actorId: 'medusa',
        actorUsername: 'medusa-webhook',
        sourceIp: 'webhook',
        userAgent: 'medusa-webhook',
        applicationName: 'pawtag-api',
        applicationVersion: '1.0.0',
        apiVersion: 'v1',
        environment: process.env.NODE_ENV || 'development',
        ...overrides,
      }, {
        action: `medusa.${event}`,
        eventType: 'SYSTEM',
        eventCategory: 'INTEGRATION',
        operationType: 'WEBHOOK',
        resourceType: 'order',
        resourceId: data.id as string,
        metadata: { event, data },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to log Medusa webhook event');
    }
  };
  logAudit();
}

// POST /api/webhooks/medusa — receive Medusa events
router.post('/', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-medusa-signature'] as string || '';
    const rawBody = JSON.stringify(req.body);

    if (WEBHOOK_SECRET && !verifyWebhookSignature(rawBody, signature)) {
      logger.warn('Medusa webhook signature verification failed');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    const { event, data } = req.body;
    const eventId = data?.id || `${event}_${Date.now()}`;
    logger.info({ event, eventId }, 'Received Medusa webhook event');

    // Idempotency check — store event and skip if already processed
    const existingEvent = await WebhookEvent.findOne({ source: 'medusa', eventId });
    if (existingEvent?.status === 'completed') {
      logger.info({ eventId }, 'Medusa webhook already processed — skipping');
      return res.status(200).json({ received: true, duplicate: true });
    }

    // Store event for retry capability
    if (!existingEvent) {
      try {
        await WebhookEvent.create({
          source: 'medusa',
          event,
          eventId,
          payload: req.body,
          status: 'processing',
          attempts: 1,
        });
      } catch (err: any) {
        if (err.code === 11000) {
          // Duplicate key — race condition, another request stored it first
          logger.info({ eventId }, 'Medusa webhook event already stored — skipping');
          return res.status(200).json({ received: true, duplicate: true });
        }
        throw err;
      }
    } else {
      existingEvent.status = 'processing';
      existingEvent.attempts += 1;
      existingEvent.lastError = undefined;
      await existingEvent.save();
    }

    let handlerSucceeded = false;
    switch (event) {
      case 'order.placed':
        handlerSucceeded = await handleOrderPlaced(data);
        break;
      case 'payment.captured':
        handlerSucceeded = await handlePaymentCaptured(data);
        break;
      case 'order.canceled':
        handlerSucceeded = await handleOrderCanceled(data);
        break;
      case 'order.fulfillment_created':
        handlerSucceeded = await handleFulfillmentCreated(data);
        break;
      case 'order.fulfillment_canceled':
        handlerSucceeded = await handleFulfillmentCanceled(data);
        break;
      case 'shipment.created':
        handlerSucceeded = await handleShipmentCreated(data);
        break;
      default:
        logger.info({ event }, 'Unhandled Medusa webhook event');
        handlerSucceeded = true; // Unhandled events are OK
    }

    // Only mark completed if handler actually succeeded
    if (handlerSucceeded) {
      await WebhookEvent.findOneAndUpdate(
        { source: 'medusa', eventId },
        { status: 'completed', processedAt: new Date() }
      );
    } else {
      // Handler failed (e.g., user not found) — mark for retry
      const nextRetry = new Date(Date.now() + 60000);
      await WebhookEvent.findOneAndUpdate(
        { source: 'medusa', eventId },
        { status: 'failed', lastError: 'Handler returned false', nextRetryAt: nextRetry }
      );
    }

    await auditMedusaEvent(event, data || {});

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error({ err: error }, 'Medusa webhook error');

    // Mark as failed for retry
    const eventId = req.body?.data?.id;
    if (eventId) {
      const nextRetry = new Date(Date.now() + 60000); // Retry in 1 minute
      await WebhookEvent.findOneAndUpdate(
        { source: 'medusa', eventId },
        { status: 'failed', lastError: (error as Error)?.message, nextRetryAt: nextRetry }
      ).catch(() => {});
    }

    return res.status(200).json({ received: true }); // Always 200 to prevent Medusa retries
  }
});

// Handle order.placed — delegates to shared createOrderFromMedusa service
async function handleOrderPlaced(data: { id: string }): Promise<boolean> {
  const { id: medusaOrderId } = data;
  if (!medusaOrderId) {
    logger.warn('order.placed: no order ID');
    return false;
  }

  logger.info({ medusaOrderId }, 'Processing order.placed');

  try {
    const { createOrderFromMedusa } = await import('../services/order-creation.service');
    const result = await createOrderFromMedusa(medusaOrderId);
    if (result.isNew) {
      logger.info({ orderNumber: result.order.orderNumber }, 'Order created via webhook');
    } else {
      logger.info({ orderNumber: result.order.orderNumber }, 'Order already existed (webhook idempotent)');
    }
    return true;
  } catch (err: any) {
    logger.error({ err, medusaOrderId }, 'Failed to create order from webhook');
    return false;
  }
}

// Handle payment.captured — mark existing order as paid
async function handlePaymentCaptured(data: { id: string }): Promise<boolean> {
  const { id: paymentId } = data;
  if (!paymentId) return false;

  logger.info({ paymentId }, 'Processing payment.captured');

  // Find order by payment transaction ID
  const order = await Order.findOne({ 'payment.transactionId': paymentId });
  if (!order) {
    logger.info({ paymentId }, 'No matching PawTag order for payment');
    return false;
  }

  if (order.status === 'paid') {
    logger.info({ orderNumber: order.orderNumber }, 'Order already marked as paid');
    return true;
  }

  order.status = 'paid';
  order.payment.status = 'completed';
  order.payment.paidAt = new Date();
  await order.save();

  await recordOrderActivity(order._id, 'payment_confirmed', 'Payment confirmed', 'system');

  logger.info({ orderNumber: order.orderNumber }, 'Order marked as paid via payment.captured');
  return true;
}

// Handle order.canceled
async function handleOrderCanceled(data: { id: string }): Promise<boolean> {
  const { id: medusaOrderId } = data;
  if (!medusaOrderId) return false;

  logger.info({ medusaOrderId }, 'Processing order.canceled');

  const order = await Order.findOne({ 'payment.transactionId': medusaOrderId });
  if (!order || order.status === 'cancelled') return true;

  order.status = 'cancelled';
  order.cancellationReason = 'Canceled via Medusa';
  await order.save();

  // Notify customer (records activity + sends email + push + in-app)
  const { notifyCustomerOfStatusChange } = await import('../services/orderNotification.service');
  await notifyCustomerOfStatusChange(order, 'cancelled', { reason: 'Canceled via Medusa' });

  logger.info({ orderNumber: order.orderNumber }, 'Order cancelled via Medusa');
  return true;
}

// Handle order.fulfillment_created — items packed, ready for shipping
async function handleFulfillmentCreated(data: { order_id?: string; fulfillment_id?: string }): Promise<boolean> {
  const { order_id: medusaOrderId, fulfillment_id } = data;
  if (!medusaOrderId) return false;

  logger.info({ medusaOrderId, fulfillment_id }, 'Processing order.fulfillment_created');

  const order = await Order.findOne({ 'payment.transactionId': medusaOrderId });
  if (!order) {
    logger.info({ medusaOrderId }, 'No matching PawTag order for fulfillment');
    return false;
  }

  if (order.status !== 'paid') {
    logger.info({ orderNumber: order.orderNumber, status: order.status }, 'Order not in paid status — skipping fulfillment update');
    return true;
  }

  order.status = 'packing';
  await order.save();

  // Record activity
  await recordOrderActivity(order._id, 'packing', 'Order is being packed', 'system');

  // Notify customer
  const { notifyCustomerOfStatusChange } = await import('../services/orderNotification.service');
  // packing has no notification config, but we record the activity
  await PawTagNotification.create({
    userId: order.userId,
    audience: 'admin',
    type: 'order_update',
    title: 'Order packing started',
    message: `Order ${order.orderNumber} is being packed.`,
    data: { orderId: order._id.toString(), orderNumber: order.orderNumber, status: 'packing', fulfillmentId: fulfillment_id },
    priority: 'normal',
    channel: 'info',
  }).catch(() => {});

  logger.info({ orderNumber: order.orderNumber }, 'Order marked as packing via fulfillment_created');
  return true;
}

// Handle order.fulfillment_canceled — revert to paid
async function handleFulfillmentCanceled(data: { order_id?: string; fulfillment_id?: string }): Promise<boolean> {
  const { order_id: medusaOrderId, fulfillment_id } = data;
  if (!medusaOrderId) return false;

  logger.info({ medusaOrderId, fulfillment_id }, 'Processing order.fulfillment_canceled');

  const order = await Order.findOne({ 'payment.transactionId': medusaOrderId });
  if (!order) return false;

  if (order.status !== 'packing') {
    logger.info({ orderNumber: order.orderNumber, status: order.status }, 'Order not in packing status — skipping');
    return true;
  }

  order.status = 'paid';
  await order.save();

  await recordOrderActivity(order._id, 'status_change', 'Shipment cancelled — returned to paid', 'system');

  logger.info({ orderNumber: order.orderNumber }, 'Order reverted to paid via fulfillment_canceled');
  return true;
}

// Handle shipment.created — tracking number assigned, order shipped
async function handleShipmentCreated(data: { id?: string }): Promise<boolean> {
  const { id: fulfillmentId } = data;
  if (!fulfillmentId) return false;

  logger.info({ fulfillmentId }, 'Processing shipment.created');

  // Fetch full fulfillment from Medusa to get tracking info
  const MEDUSA_URL = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';
  const MEDUSA_ADMIN_TOKEN = process.env.MEDUSA_ADMIN_TOKEN || '';

  let fulfillment: any = null;
  try {
    const response = await fetch(`${MEDUSA_URL}/admin/fulfillments/${fulfillmentId}`, {
      headers: {
        'Authorization': `Bearer ${MEDUSA_ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    if (response.ok) {
      const result = await response.json() as any;
      fulfillment = result.fulfillment;
    }
  } catch (err) {
    logger.error({ err, fulfillmentId }, 'Failed to fetch fulfillment from Medusa');
    return false;
  }

  if (!fulfillment) {
    logger.error({ fulfillmentId }, 'Fulfillment not found in Medusa');
    return false;
  }

  // Find the PawTag order by the fulfillment's order link or items
  // The fulfillment has items with line_item_id, but we need to find by order
  // We'll search by the fulfillment's associated order
  // Since shipment.created only has fulfillment ID, we need to find the order
  // via the fulfillment's metadata or by checking recent orders

  // Alternative: look up via the order that has this fulfillment
  // The fulfillment object has provider_id, labels with tracking info
  const labels = fulfillment.labels || [];
  const trackingNumber = labels[0]?.tracking_number || '';
  const trackingUrl = labels[0]?.tracking_url || '';
  const carrier = fulfillment.provider_id || fulfillment.shipping_option?.provider_id || 'Unknown';

  // Find order by looking at fulfillment items → line_item_id → order items
  // Or use the fulfillment's order_id if available
  const medusaOrderId = fulfillment.metadata?.order_id || fulfillment.order_id;

  let order;
  if (medusaOrderId) {
    order = await Order.findOne({ 'payment.transactionId': medusaOrderId });
  }

  if (!order) {
    // Try to find by recent packing orders
    order = await Order.findOne({ status: 'packing' }).sort({ updatedAt: -1 });
  }

  if (!order) {
    logger.warn({ fulfillmentId }, 'No matching PawTag order for shipment');
    return false;
  }

  // Update order with tracking info
  order.status = 'shipped';
  if (trackingNumber) order.trackingNumber = trackingNumber;
  if (carrier) order.carrier = carrier;
  if (trackingUrl) order.shippingLabelUrl = trackingUrl;
  await order.save();

  // Notify customer (records activity + sends email + push + in-app)
  // Note: Do NOT call recordOrderActivity() separately — notifyCustomerOfStatusChange handles it
  const { notifyCustomerOfStatusChange } = await import('../services/orderNotification.service');
  await notifyCustomerOfStatusChange(order, 'shipped', { trackingNumber, carrier });

  logger.info({ orderNumber: order.orderNumber, trackingNumber, carrier }, 'Order marked as shipped via shipment.created');
  return true;
}

// Process subscriptions for subscription products
export default router;

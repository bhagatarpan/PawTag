import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Order, Subscription, Tag, User, Notification } from '@pawtag/db';
import { createSubscription } from '../services/subscription.service';
import { sendOrderConfirmation } from '../services/email.service';
import { generateTagId } from '../lib/tag-id';
import logger from '../lib/logger';
import { auditService, type AuditContext } from '../services/audit';

const router = Router();

const WEBHOOK_SECRET = process.env.MEDUSA_WEBHOOK_SECRET || '';

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
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event, data } = req.body;
    logger.info({ event, dataId: data?.id }, 'Received Medusa webhook event');

    switch (event) {
      case 'order.placed':
        await handleOrderPlaced(data);
        break;
      case 'payment.captured':
        await handlePaymentCaptured(data);
        break;
      case 'order.canceled':
        await handleOrderCanceled(data);
        break;
      default:
        logger.info({ event }, 'Unhandled Medusa webhook event');
    }

    await auditMedusaEvent(event, data || {});

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error({ err: error }, 'Medusa webhook error');
    return res.status(200).json({ received: true }); // Always 200 to prevent retries on processing errors
  }
});

// Handle order.placed — create PawTag order and process subscriptions
async function handleOrderPlaced(data: { id: string }) {
  const { id: medusaOrderId } = data;
  if (!medusaOrderId) {
    logger.warn('order.placed: no order ID');
    return;
  }

  logger.info({ medusaOrderId }, 'Processing order.placed');

  // Fetch full order from Medusa
  const MEDUSA_URL = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';
  const response = await fetch(`${MEDUSA_URL}/store/orders/${medusaOrderId}`, {
    headers: { 'x-publishable-api-key': process.env.MEDUSA_PUBLISHABLE_KEY || '' },
  });

  if (!response.ok) {
    logger.error({ status: response.status, medusaOrderId }, 'Failed to fetch Medusa order');
    return;
  }

  const { order: medusaOrder } = await response.json() as any;

  // Find PawTag user by Medusa customer email or metadata
  let pawtagUser = null;
  if (medusaOrder.customer_id) {
    pawtagUser = await User.findOne({ medusaCustomerId: medusaOrder.customer_id });
  }
  if (!pawtagUser && medusaOrder.email) {
    pawtagUser = await User.findOne({ email: medusaOrder.email.toLowerCase() });
  }

  if (!pawtagUser) {
    logger.warn({ medusaOrderId, email: medusaOrder.email }, 'PawTag user not found for Medusa order');
    return;
  }

  // Check if PawTag order already exists (idempotent)
  const existingOrder = await Order.findOne({
    $or: [
      { 'payment.transactionId': medusaOrderId },
      { notes: `Medusa Order: ${medusaOrderId}` },
    ],
  });

  if (existingOrder) {
    logger.info({ orderNumber: existingOrder.orderNumber }, 'PawTag order already exists');
    return;
  }

  // Generate PawTag order number
  const orderCount = await Order.countDocuments();
  const orderNumber = `PT-${String(orderCount + 1).padStart(6, '0')}`;

  // Map Medusa items to PawTag items
  const items = (medusaOrder.items || []).map((item: any) => {
    // Try to find the product by Medusa product ID in metadata
    const productId = item.product_id || item.metadata?.pawtagProductId || '';
    return {
      productId,
      productName: item.title || item.name,
      quantity: item.quantity,
      unitPrice: (item.unit_price || 0) / 100, // cents → dollars
      totalPrice: ((item.unit_price || 0) * item.quantity) / 100,
    };
  });

  // Create PawTag order
  const order = await Order.create({
    orderNumber,
    userId: pawtagUser._id,
    items,
    status: 'paid',
    payment: {
      method: 'card',
      status: 'completed',
      transactionId: medusaOrderId,
      amount: (medusaOrder.total || 0) / 100,
      currency: (medusaOrder.currency_code || 'nzd').toUpperCase(),
      paidAt: new Date(medusaOrder.created_at),
    },
    shippingAddress: medusaOrder.shipping_address ? {
      line1: medusaOrder.shipping_address.address_1 || '',
      line2: medusaOrder.shipping_address.address_2 || '',
      city: medusaOrder.shipping_address.city || '',
      state: medusaOrder.shipping_address.province || '',
      zip: medusaOrder.shipping_address.postal_code || '',
      country: (medusaOrder.shipping_address.country_code || 'nz').toUpperCase(),
    } : {
      line1: '',
      city: '',
      state: '',
      zip: '',
      country: 'NZ',
    },
    notes: `Medusa Order: ${medusaOrderId}`,
  });

  logger.info({ orderNumber, medusaOrderId }, 'Created PawTag order from Medusa');

  // Process subscriptions for subscription products
  await processSubscriptions(order, pawtagUser, medusaOrder);

  // Send order confirmation email
  try {
    await sendOrderConfirmation({
      to: pawtagUser.email,
      customerName: pawtagUser.fullName,
      orderNumber: order.orderNumber,
      total: order.payment.amount,
      items: order.items.map((i: any) => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      shippingAddress: order.shippingAddress,
    });
  } catch (err) {
    logger.error({ err, orderNumber }, 'Failed to send order confirmation email');
  }

  // Create notification
  try {
    await Notification.create({
      userId: pawtagUser._id,
      type: 'order',
      title: 'Order Confirmed',
      message: `Your order ${order.orderNumber} has been confirmed and paid.`,
      read: false,
    });
  } catch {
    // Non-critical
  }
}

// Handle payment.captured — mark existing order as paid
async function handlePaymentCaptured(data: { id: string }) {
  const { id: paymentId } = data;
  if (!paymentId) return;

  logger.info({ paymentId }, 'Processing payment.captured');

  // Find order by payment transaction ID
  const order = await Order.findOne({ 'payment.transactionId': paymentId });
  if (!order) {
    logger.info({ paymentId }, 'No matching PawTag order for payment');
    return;
  }

  if (order.status === 'paid') {
    logger.info({ orderNumber: order.orderNumber }, 'Order already marked as paid');
    return;
  }

  order.status = 'paid';
  order.payment.status = 'completed';
  order.payment.paidAt = new Date();
  await order.save();

  logger.info({ orderNumber: order.orderNumber }, 'Order marked as paid via payment.captured');
}

// Handle order.canceled
async function handleOrderCanceled(data: { id: string }) {
  const { id: medusaOrderId } = data;
  if (!medusaOrderId) return;

  logger.info({ medusaOrderId }, 'Processing order.canceled');

  const order = await Order.findOne({ 'payment.transactionId': medusaOrderId });
  if (!order || order.status === 'cancelled') return;

  order.status = 'cancelled';
  order.cancellationReason = 'Canceled via Medusa';
  await order.save();

  logger.info({ orderNumber: order.orderNumber }, 'Order cancelled via Medusa');
}

// Process subscriptions for subscription products
async function processSubscriptions(order: any, user: any, medusaOrder: any) {
  const MEDUSA_URL = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';

  for (const item of order.items) {
    // Find the Medusa product ID from the order items
    const medusaItem = (medusaOrder.items || []).find((mi: any) =>
      mi.product_id === item.productId || mi.title === item.productName
    );
    if (!medusaItem?.product_id) continue;

    // Fetch product metadata from Medusa
    let productMetadata: any = null;
    try {
      const response = await fetch(`${MEDUSA_URL}/store/products/${medusaItem.product_id}`, {
        headers: { 'x-publishable-api-key': process.env.MEDUSA_PUBLISHABLE_KEY || '' },
      });
      if (response.ok) {
        const { product } = await response.json() as any;
        productMetadata = product?.metadata;
      }
    } catch {
      // Non-critical — skip subscription if product fetch fails
    }

    if (!productMetadata?.isSubscription || !productMetadata?.subscriptionConfig) continue;

    // Find user's unlinked tags
    const userTags = await Tag.find({ ownerId: user._id, deletedAt: null });
    for (const tag of userTags) {
      if (tag.subscriptionStatus === 'none' || !tag.subscriptionId) {
        try {
          await createSubscription({
            userId: user._id.toString(),
            tagId: tag._id.toString(),
            orderId: order._id.toString(),
            planType: productMetadata.subscriptionConfig.type || 'annual',
            planId: medusaItem.product_id,
            price: item.unitPrice,
          });
          logger.info({ orderNumber: order.orderNumber, tagId: tag._id }, 'Subscription created');
          break; // One subscription per order item
        } catch (err) {
          logger.error({ err, orderNumber: order.orderNumber }, 'Failed to create subscription');
        }
      }
    }
  }
}

export default router;

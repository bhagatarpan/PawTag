import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Order, Subscription, Tag, User, Notification, Invoice, InvoiceAccessToken, WebhookEvent } from '@pawtag/db';
import { createSubscription } from '../services/subscription.service';
import { sendOrderConfirmation, sendInvoiceEmail, sendMail } from '../services/email.service';
import { generateInvoiceHtml } from '../services/invoice-html.service';
import { sendPushToUser } from '../services/push-notification.service';
import { generateSecureToken, hashToken } from '../services/auth.service';
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

    // Mark as completed
    await WebhookEvent.findOneAndUpdate(
      { source: 'medusa', eventId },
      { status: 'completed', processedAt: new Date() }
    );

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

  // Generate PawTag order number atomically to prevent race conditions
  const counter = await Order.db!.collection('counters').findOneAndUpdate(
    { _id: 'orderNumber' as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const orderNumber = `PT-${String(counter?.value?.seq || 1).padStart(6, '0')}`;

  // Map Medusa items to PawTag items
    const items = (medusaOrder.items || []).map((item: any) => {
    // Medusa v2 stores prices in major units (dollars), not cents
    const productId = item.product_id || item.metadata?.pawtagProductId || '';
    return {
      productId,
      productName: item.title || item.name,
      quantity: item.quantity,
      unitPrice: item.unit_price || 0,
      totalPrice: (item.unit_price || 0) * item.quantity,
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
      amount: medusaOrder.total || 0,
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

  // Create Invoice record
  try {
    const invoiceCount = await Invoice.countDocuments();
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(6, '0')}`;

    // Check if order has subscription
    let subscriptionId: any = undefined;
    let billingPeriod: { start: Date; end: Date } | undefined = undefined;
    const sub = await Subscription.findOne({ userId: pawtagUser._id, orderId: order._id });
    if (sub) {
      subscriptionId = sub._id;
      if (sub.currentPeriodStart && sub.currentPeriodEnd) {
        billingPeriod = { start: sub.currentPeriodStart, end: sub.currentPeriodEnd };
      }
    }

    const invoice = await Invoice.create({
      ...(subscriptionId ? { subscriptionId } : {}),
      orderId: order._id,
      userId: pawtagUser._id,
      invoiceNumber,
      amount: order.payment.amount,
      currency: order.payment.currency || 'NZD',
      status: 'paid',
      paymentMethod: order.payment.method,
      paidAt: order.payment.paidAt || new Date(),
      ...(billingPeriod ? { billingPeriod } : {}),
    });
    logger.info({ invoiceNumber, orderNumber }, 'Invoice created');

    // Generate secure access token for invoice
    const secureToken = generateSecureToken();
    const tokenHash = hashToken(secureToken);
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    await InvoiceAccessToken.create({
      invoiceId: invoice._id,
      userId: pawtagUser._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      verifiedAt: new Date(),
    });
    const invoiceUrl = `${FRONTEND_URL}/invoice/${secureToken}?admin=1`;

    // Send invoice email
    const invoiceHtml = await generateInvoiceHtml(invoice._id.toString());
    await sendInvoiceEmail(pawtagUser.email, pawtagUser.fullName, invoiceNumber, invoiceHtml, invoiceUrl, invoice.amount);
    logger.info({ orderNumber }, 'Invoice email sent');
  } catch (err) {
    logger.error({ err, orderNumber }, 'Failed to create invoice');
  }

  // Process referral rewards
  try {
    const { createReferralOnOrder, completeReferralRewards } = await import('../services/referral.service');
    if (order.referredByCode) {
      await createReferralOnOrder(order.referredByCode, pawtagUser._id.toString(), order.referredByCode, order._id.toString());
      await completeReferralRewards(order._id.toString());
      logger.info({ orderNumber }, 'Referral rewards processed');
    }
  } catch (err) {
    logger.error({ err, orderNumber }, 'Referral processing error');
  }

  // Admin notification (idempotent)
  try {
    const existingAdminNotif = await Notification.findOne({
      audience: 'admin',
      'data.medusaOrderId': medusaOrderId,
    });
    if (!existingAdminNotif) {
      await Notification.create({
        userId: pawtagUser._id,
        audience: 'admin',
        type: 'new_order',
        title: 'New order received',
        message: `Order ${order.orderNumber} — $${order.payment.amount.toFixed(2)} NZD`,
        data: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          amount: order.payment.amount,
          medusaOrderId,
          customerName: pawtagUser.fullName || 'Unknown',
          customerEmail: pawtagUser.email || 'Unknown',
        },
        priority: 'high',
        channel: 'alert',
      });

      // Send admin email
      const adminEmail = process.env.ADMIN_ALERT_EMAIL;
      if (adminEmail) {
        try {
          await sendMail(
            adminEmail,
            `New PawTag order: ${order.orderNumber}`,
            `<h2>New Order Received</h2>
             <p><strong>Order:</strong> ${order.orderNumber}</p>
             <p><strong>Customer:</strong> ${pawtagUser.fullName || 'Unknown'} (${pawtagUser.email || 'Unknown'})</p>
             <p><strong>Amount:</strong> $${order.payment.amount.toFixed(2)} NZD</p>
             <p><strong>Medusa Order:</strong> ${medusaOrderId}</p>`,
          );
        } catch (emailErr) {
          logger.error({ err: emailErr }, 'Admin notification email error');
        }
      }
      logger.info({ orderNumber }, 'Admin notification created');
    }
  } catch (adminError) {
    logger.error({ err: adminError }, 'Admin notification error');
  }

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

  // Create customer notification
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

  // Push notification
  try {
    await sendPushToUser(
      pawtagUser._id.toString(),
      'Order Confirmed',
      `Your order ${order.orderNumber} has been confirmed.`,
    );
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

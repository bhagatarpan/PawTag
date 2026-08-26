/**
 * Shared order creation service — used by both the direct API endpoint
 * (POST /customer/orders/place) and the Medusa webhook handler.
 *
 * This ensures consistent order creation logic regardless of the entry point.
 * The function is idempotent — calling it twice with the same medusaOrderId
 * returns the existing order without creating a duplicate.
 */

import { Order, Invoice, InvoiceAccessToken, Subscription, User, Notification } from '@pawtag/db';
import { sendOrderConfirmation, sendInvoiceEmail, sendMail } from './email.service';
import { generateInvoiceHtml } from './invoice-html.service';
import { sendPushToUser } from './push-notification.service';
import { generateSecureToken, hashToken } from './auth.service';
import { recordOrderActivity } from '../routes/medusa-webhooks';
import logger from '../lib/logger';

const MEDUSA_URL = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';
const MEDUSA_PUBLISHABLE_KEY = process.env.MEDUSA_PUBLISHABLE_KEY || '';
const MEDUSA_ADMIN_TOKEN = process.env.MEDUSA_ADMIN_TOKEN || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export interface CreateOrderResult {
  order: any;
  invoice: any;
  invoiceUrl: string;
  isNew: boolean; // true if order was just created, false if it already existed
}

/**
 * Find the PawTag user that corresponds to a Medusa order.
 * Uses a chain of fallbacks: customer_id → email → admin API → metadata.
 */
async function findPawTagUser(medusaOrder: any): Promise<any | null> {
  // 1. By medusaCustomerId
  if (medusaOrder.customer_id) {
    const user = await User.findOne({ medusaCustomerId: medusaOrder.customer_id });
    if (user) return user;
  }

  // 2. By email
  if (medusaOrder.email) {
    const user = await User.findOne({ email: medusaOrder.email.toLowerCase() });
    if (user) return user;
  }

  // 3. Fetch customer from Medusa admin API, then find by email
  if (medusaOrder.customer_id) {
    try {
      const customerRes = await fetch(`${MEDUSA_URL}/admin/customers/${medusaOrder.customer_id}`, {
        headers: { Authorization: `Bearer ${MEDUSA_ADMIN_TOKEN}` },
      });
      if (customerRes.ok) {
        const { customer } = await customerRes.json() as any;
        if (customer?.email) {
          const user = await User.findOne({ email: customer.email.toLowerCase() });
          if (user) {
            // Save medusaCustomerId for future lookups
            if (!user.medusaCustomerId) {
              user.medusaCustomerId = medusaOrder.customer_id;
              await user.save();
            }
            return user;
          }
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to fetch Medusa customer for fallback lookup');
    }
  }

  // 4. By metadata.pawtagUserId (written to cart during checkout)
  if (medusaOrder.metadata?.pawtagUserId) {
    const user = await User.findById(medusaOrder.metadata.pawtagUserId);
    if (user) return user;
  }

  // 5. By metadata.pawtagUserEmail (written to cart during checkout)
  if (medusaOrder.metadata?.pawtagUserEmail) {
    const user = await User.findOne({ email: medusaOrder.metadata.pawtagUserEmail.toLowerCase() });
    if (user) return user;
  }

  return null;
}

/**
 * Core order creation logic — shared by API endpoint and webhook handler.
 *
 * Flow:
 * 1. Fetch full order from Medusa API
 * 2. Find PawTag user (5-level fallback chain)
 * 3. Check idempotency (order already exists?)
 * 4. Create PawTag Order + Invoice + Access Token
 * 5. Send emails in parallel (invoice, order confirmation, admin alert)
 * 6. Record activity + notifications (fire-and-forget)
 * 7. Return { order, invoice, invoiceUrl, isNew }
 */
export async function createOrderFromMedusa(medusaOrderId: string): Promise<CreateOrderResult> {
  // 1. Fetch full order from Medusa
  const response = await fetch(`${MEDUSA_URL}/store/orders/${medusaOrderId}`, {
    headers: { 'x-publishable-api-key': MEDUSA_PUBLISHABLE_KEY },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Medusa order: ${response.status}`);
  }

  const { order: medusaOrder } = await response.json() as any;

  // 2. Find PawTag user
  const pawtagUser = await findPawTagUser(medusaOrder);
  if (!pawtagUser) {
    throw new Error(`PawTag user not found for Medusa order ${medusaOrderId}`);
  }

  // 3. Check idempotency
  const existingOrder = await Order.findOne({
    $or: [
      { 'payment.transactionId': medusaOrderId },
      { notes: `Medusa Order: ${medusaOrderId}` },
    ],
  });

  if (existingOrder) {
    // Order already exists — fetch its invoice and return
    const existingInvoice = await Invoice.findOne({ orderId: existingOrder._id });
    const invoiceUrl = existingInvoice
      ? `${FRONTEND_URL}/invoice/${generateSecureToken()}?admin=1` // Token may be expired, but URL format is correct
      : '';
    logger.info({ orderNumber: existingOrder.orderNumber }, 'Order already exists (idempotent)');
    return { order: existingOrder, invoice: existingInvoice, invoiceUrl, isNew: false };
  }

  // 4. Generate PawTag order number atomically
  const counter = await Order.db!.collection('counters').findOneAndUpdate(
    { _id: 'orderNumber' as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  const orderNumber = `PT-${String(counter?.value?.seq || 1).padStart(6, '0')}`;

  // Map Medusa items to PawTag items
  const items = (medusaOrder.items || []).map((item: any) => ({
    productId: item.product_id || item.metadata?.pawtagProductId || '',
    productName: item.title || item.name,
    quantity: item.quantity,
    unitPrice: item.unit_price || 0,
    totalPrice: (item.unit_price || 0) * item.quantity,
  }));

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
    } : { line1: '', city: '', state: '', zip: '', country: 'NZ' },
    referredByCode: medusaOrder.metadata?.referralCode || undefined,
    notes: `Medusa Order: ${medusaOrderId}`,
  });

  logger.info({ orderNumber, medusaOrderId }, 'Created PawTag order');

  // Record order placed activity
  await recordOrderActivity(order._id, 'order_placed', 'Order placed', 'customer');

  // Process subscriptions (non-blocking, best-effort)
  try {
    await processSubscriptions(order, pawtagUser, medusaOrder);
  } catch (err) {
    logger.error({ err, orderNumber }, 'Subscription processing error');
  }

  // Create Invoice
  let invoice: any = null;
  let invoiceUrl = '';
  try {
    const invCounter = await Invoice.db!.collection('counters').findOneAndUpdate(
      { _id: 'invoiceNumber' as any },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    const invoiceNumber = `INV-${String(invCounter?.value?.seq || 1).padStart(6, '0')}`;

    // Check for subscription billing period
    let subscriptionId: any = undefined;
    let billingPeriod: { start: Date; end: Date } | undefined = undefined;
    const sub = await Subscription.findOne({ userId: pawtagUser._id, orderId: order._id });
    if (sub) {
      subscriptionId = sub._id;
      if (sub.currentPeriodStart && sub.currentPeriodEnd) {
        billingPeriod = { start: sub.currentPeriodStart, end: sub.currentPeriodEnd };
      }
    }

    invoice = await Invoice.create({
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

    // Generate secure access token
    const secureToken = generateSecureToken();
    const tokenHash = hashToken(secureToken);
    await InvoiceAccessToken.create({
      invoiceId: invoice._id,
      userId: pawtagUser._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      verifiedAt: new Date(),
    });
    invoiceUrl = `${FRONTEND_URL}/invoice/${secureToken}?admin=1`;

    logger.info({ invoiceNumber, orderNumber }, 'Invoice created');
  } catch (err) {
    logger.error({ err, orderNumber }, 'Failed to create invoice');
  }

  // 5. Send emails in PARALLEL (non-blocking, best-effort)
  const emailPromises: Promise<any>[] = [];

  // Invoice email
  if (invoice && invoiceUrl) {
    emailPromises.push(
      generateInvoiceHtml(invoice._id.toString())
        .then((html) => sendInvoiceEmail(pawtagUser.email, pawtagUser.fullName, invoice.invoiceNumber, html, invoiceUrl, invoice.amount))
        .catch((err) => logger.error({ err, orderNumber }, 'Invoice email error')),
    );
  }

  // Order confirmation email
  emailPromises.push(
    sendOrderConfirmation({
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
    }).catch((err) => logger.error({ err, orderNumber }, 'Order confirmation email error')),
  );

  // Admin notification email
  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (adminEmail) {
    emailPromises.push(
      sendMail(
        adminEmail,
        `New PawTag order: ${order.orderNumber}`,
        `<h2>New Order Received</h2>
         <p><strong>Order:</strong> ${order.orderNumber}</p>
         <p><strong>Customer:</strong> ${pawtagUser.fullName || 'Unknown'} (${pawtagUser.email})</p>
         <p><strong>Amount:</strong> $${order.payment.amount.toFixed(2)} NZD</p>
         <p><strong>Medusa Order:</strong> ${medusaOrderId}</p>`,
      ).catch((err) => logger.error({ err }, 'Admin notification email error')),
    );
  }

  // Wait for all emails to complete (but don't block order creation on failure)
  await Promise.allSettled(emailPromises);
  logger.info({ orderNumber }, 'Emails sent');

  // 6. Record activity + notifications (fire-and-forget, non-critical)
  // Admin in-app notification
  Notification.create({
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
      customerEmail: pawtagUser.email,
    },
    priority: 'high',
    channel: 'alert',
  }).catch(() => {});

  // Customer in-app notification
  Notification.create({
    userId: pawtagUser._id,
    type: 'order',
    title: 'Order Confirmed',
    message: `Your order ${order.orderNumber} has been confirmed and paid.`,
    read: false,
  }).catch(() => {});

  // Push notification
  sendPushToUser(
    pawtagUser._id.toString(),
    'Order Confirmed',
    `Your order ${order.orderNumber} has been confirmed.`,
  ).catch(() => {});

  // Process referral rewards (non-blocking)
  if (order.referredByCode) {
    import('../services/referral.service').then(({ createReferralOnOrder, completeReferralRewards }) => {
      createReferralOnOrder(order.referredByCode!, pawtagUser._id.toString(), order.referredByCode!, order._id.toString())
        .then(() => completeReferralRewards(order._id.toString()))
        .catch((err) => logger.error({ err, orderNumber }, 'Referral processing error'));
    }).catch(() => {});
  }

  return { order, invoice, invoiceUrl, isNew: true };
}

/**
 * Process subscriptions for subscription products.
 * Fetches product metadata from Medusa and creates subscriptions.
 */
async function processSubscriptions(order: any, user: any, medusaOrder: any): Promise<void> {
  for (const item of order.items) {
    const medusaItem = (medusaOrder.items || []).find((mi: any) =>
      mi.product_id === item.productId || mi.title === item.productName,
    );
    if (!medusaItem?.product_id) continue;

    let productMetadata: any = null;
    try {
      const response = await fetch(`${MEDUSA_URL}/store/products/${medusaItem.product_id}`, {
        headers: { 'x-publishable-api-key': MEDUSA_PUBLISHABLE_KEY },
      });
      if (response.ok) {
        const { product } = await response.json() as any;
        productMetadata = product?.metadata;
      }
    } catch {
      // Non-critical
    }

    if (!productMetadata?.isSubscription || !productMetadata?.subscriptionConfig) continue;

    const { createSubscription } = await import('./subscription.service');
    const userTags = await (await import('@pawtag/db')).Tag.find({ ownerId: user._id, deletedAt: null });
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
          break;
        } catch (err) {
          logger.error({ err, orderNumber: order.orderNumber }, 'Failed to create subscription');
        }
      }
    }
  }
}

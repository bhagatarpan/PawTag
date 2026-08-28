/**
 * @module Order Creation Service
 * @description PawTag-native order creation service.
 *
 * Creates orders from confirmed payments. Replaces the Medusa-based
 * `createOrderFromMedusa()` with a direct, simpler flow.
 *
 * Flow:
 * 1. Receive order data from checkout service (already validated)
 * 2. Generate atomic order number
 * 3. Create Order record
 * 4. Create Invoice
 * 5. Send emails (non-blocking)
 * 6. Record activity + notifications
 *
 * Idempotent: Same paymentIntentId = same order (no duplicates)
 *
 * @example
 * ```typescript
 * import { createPawTagOrder } from '../services/order-creation.service';
 * const result = await createPawTagOrder({ userId, items, totals, paymentIntentId });
 * ```
 */

import { Order, Invoice, InvoiceAccessToken, User, Notification, Tag } from '@pawtag/db';
import { DuplicateOrderError } from '../commerce/errors';
import { sendOrderConfirmation, sendInvoiceEmail, sendMail } from './email.service';
import { generateInvoiceHtml } from './invoice-html.service';
import { sendPushToUser } from './push-notification.service';
import { generateSecureToken, hashToken } from './auth.service';
import { recordOrderActivity } from '../lib/order-activity';
import logger from '../lib/logger';

/**
 * Order item for creation.
 */
export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  customizationTotal?: number;
  customisation?: boolean;
}

/**
 * Order creation parameters.
 */
export interface CreateOrderParams {
  /** User ID */
  userId: string;

  /** Order items */
  items: OrderItem[];

  /** Subtotal (items only) */
  subtotal: number;

  /** Discount amount */
  discount: number;

  /** Shipping cost */
  shipping: number;

  /** Tax amount */
  tax: number;

  /** Grand total */
  total: number;

  /** Currency code */
  currency: string;

  /** Stripe PaymentIntent ID */
  paymentIntentId: string;

  /** Shipping address */
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
  };

  /** Referral code */
  referralCode?: string;

  /** Promo code used */
  promoCode?: string;
}

/**
 * Order creation result.
 */
export interface CreateOrderResult {
  order: any;
  invoice: any;
  invoiceUrl: string;
}

/**
 * Create a PawTag order from confirmed payment data.
 *
 * @param params - Order creation parameters
 * @returns Created order and invoice
 */
export async function createPawTagOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const {
    userId,
    items,
    subtotal,
    discount,
    shipping,
    tax,
    total,
    currency,
    paymentIntentId,
    shippingAddress,
    referralCode,
    promoCode,
  } = params;

  // 1. Idempotency check — prevent duplicate orders for same payment
  const existingOrder = await Order.findOne({
    'payment.stripePaymentIntentId': paymentIntentId,
  });

  if (existingOrder) {
    const existingInvoice = await Invoice.findOne({ orderId: existingOrder._id });
    const invoiceUrl = existingInvoice
      ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invoice/${generateSecureToken()}`
      : '';

    logger.info({ orderNumber: existingOrder.orderNumber, paymentIntentId }, 'Order already exists (idempotent)');
    return { order: existingOrder, invoice: existingInvoice, invoiceUrl };
  }

  // 2. Generate atomic order number
  const counter = await Order.db!.collection('counters').findOneAndUpdate(
    { _id: 'orderNumber' as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  const orderNumber = `PT-${String(counter?.value?.seq || 1).padStart(6, '0')}`;

  // 3. Create Order
  const order = await Order.create({
    orderNumber,
    userId,
    items: items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: (item.unitPrice + (item.customizationTotal || 0)) * item.quantity,
    })),
    status: 'paid',
    payment: {
      method: 'card',
      status: 'completed',
      transactionId: paymentIntentId,
      stripePaymentIntentId: paymentIntentId,
      amount: total,
      currency: currency.toUpperCase(),
      paidAt: new Date(),
    },
    shippingAddress: shippingAddress || { line1: '', city: '', state: '', zip: '', country: 'NZ' },
    referredByCode: referralCode,
    notes: `Stripe PaymentIntent: ${paymentIntentId}`,
  });

  // 4. Record activity
  await recordOrderActivity(order._id, 'order_placed', 'Order placed and paid', 'customer');

  // 5. Create Invoice
  const invCounter = await Invoice.db!.collection('counters').findOneAndUpdate(
    { _id: 'invoiceNumber' as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  const invoiceNumber = `INV-${String(invCounter?.value?.seq || 1).padStart(6, '0')}`;

  const invoice = await Invoice.create({
    orderId: order._id,
    userId,
    invoiceNumber,
    amount: total,
    currency: currency.toUpperCase(),
    status: 'paid',
    paymentMethod: 'card',
    paidAt: new Date(),
  });

  // 6. Generate secure invoice access token
  const secureToken = generateSecureToken();
  const tokenHash = hashToken(secureToken);
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

  await InvoiceAccessToken.create({
    invoiceId: invoice._id,
    userId,
    tokenHash,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    verifiedAt: new Date(),
  });

  const invoiceUrl = `${FRONTEND_URL}/invoice/${secureToken}?admin=1`;

  // 7. Create tags if product is a tag product
  for (const item of items) {
    try {
      const product = await import('@pawtag/db').then((m) => m.Product.findById(item.productId).lean());
      if (product?.isTagProduct) {
        const { generateTagId } = await import('../lib/tag-id');
        for (let i = 0; i < item.quantity; i++) {
          const tagId = await generateTagId();
          await Tag.create({
            tagId,
            tagType: 'qr',
            orderId: order._id,
            status: 'inactive',
            subscriptionStatus: 'none',
          });
          logger.info({ tagId, orderNumber }, 'Auto-created tag');
        }
      }
    } catch (err) {
      logger.error({ err, orderNumber }, 'Tag creation error');
    }
  }

  // 8. Send emails (non-blocking)
  const user = await User.findById(userId).lean();
  const emailPromises: Promise<any>[] = [];

  if (user?.email) {
    emailPromises.push(
      sendOrderConfirmation({
        to: user.email,
        customerName: user.fullName || 'Customer',
        orderNumber,
        total,
        items: items.map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        shippingAddress: shippingAddress || { line1: '', city: '', state: '', zip: '' },
      }).catch((err) => logger.error({ err, orderNumber }, 'Order confirmation email error')),
    );

    emailPromises.push(
      generateInvoiceHtml(invoice._id.toString())
        .then((html) => sendInvoiceEmail(user.email, user.fullName || 'Customer', invoiceNumber, html, invoiceUrl, total))
        .catch((err) => logger.error({ err, orderNumber }, 'Invoice email error')),
    );

    const adminEmail = process.env.ADMIN_ALERT_EMAIL;
    if (adminEmail) {
      emailPromises.push(
        sendMail(
          adminEmail,
          `New PawTag order: ${orderNumber}`,
          `<h2>New Order Received</h2>
           <p><strong>Order:</strong> ${orderNumber}</p>
           <p><strong>Customer:</strong> ${user.fullName || 'Unknown'} (${user.email})</p>
           <p><strong>Amount:</strong> $${total.toFixed(2)} NZD</p>`,
        ).catch((err) => logger.error({ err }, 'Admin notification email error')),
      );
    }
  }

  await Promise.allSettled(emailPromises);

  // 9. Fire-and-forget notifications
  if (user) {
    Notification.create({
      userId,
      audience: 'admin',
      type: 'new_order',
      title: 'New order received',
      message: `Order ${orderNumber} — $${total.toFixed(2)} NZD`,
      data: { orderId: order._id.toString(), orderNumber, amount: total },
      priority: 'high',
      channel: 'alert',
    }).catch(() => {});

    Notification.create({
      userId,
      type: 'order',
      title: 'Order Confirmed',
      message: `Your order ${orderNumber} has been confirmed.`,
      read: false,
    }).catch(() => {});

    sendPushToUser(userId, 'Order Confirmed', `Your order ${orderNumber} has been confirmed.`).catch(() => {});
  }

  // 10. Process referral rewards (non-blocking)
  if (referralCode) {
    import('./referral.service').then(({ createReferralOnOrder, completeReferralRewards }) => {
      createReferralOnOrder(referralCode, userId, referralCode, order._id.toString())
        .then(() => completeReferralRewards(order._id.toString()))
        .catch((err) => logger.error({ err, orderNumber }, 'Referral processing error'));
    }).catch(() => {});
  }

  logger.info({ orderNumber, total, userId }, 'Order created successfully');

  return { order, invoice, invoiceUrl };
}

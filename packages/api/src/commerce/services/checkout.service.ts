/**
 * @module Checkout Service
 * @description Orchestrates the checkout flow for PawTag Commerce.
 *
 * This is the central coordinator for the entire purchase process:
 * 1. Validate cart contents (server-side)
 * 2. Create Stripe PaymentIntent
 * 3. Store PendingOrder (for recovery)
 * 4. Confirm payment succeeded
 * 5. Create Order + Invoice
 * 6. Send notifications
 *
 * Critical design decisions:
 * - Payment is validated server-side via Stripe API (never trust frontend)
 * - PendingOrder ensures recovery if browser closes
 * - Idempotency: same PaymentIntent = same Order (no duplicates)
 * - Atomic order number generation
 * - Emails are non-blocking (fire-and-forget)
 *
 * Usage:
 * ```typescript
 * import { checkoutService } from '../commerce/services/checkout.service';
 * const result = await checkoutService.createPaymentIntent(userId, cartId);
 * // ... frontend confirms payment ...
 * const order = await checkoutService.confirmCheckout(userId, paymentIntentId);
 * ```
 */

import { PendingOrder, Order, Invoice, InvoiceAccessToken, Cart, User, PaymentTransaction, type IPendingOrderDocument } from '@pawtag/db';
import { NotFoundError } from '../../lib/app-errors';
import { InvalidCartError, CheckoutExpiredError, DuplicateOrderError, PaymentFailedError, PriceMismatchError } from '../errors';
import { stripePaymentProvider } from '../providers/stripe';
import { inventoryService } from './inventory.service';
import { pricingService } from './pricing.service';
import { cartService } from './cart.service';
import { getSetting, getNumberSetting } from '../config';
import { logPaymentEvent, logOrderEvent } from '../audit';
import { generateSecureToken, hashToken } from '../../services/auth.service';
import { sendOrderConfirmation, sendInvoiceEmail, sendMail } from '../../services/email.service';
import { generateInvoiceHtml } from '../../services/invoice-html.service';
import { sendPushToUser } from '../../services/push-notification.service';
import logger from '../../lib/logger';

/** Checkout result from creating payment intent */
export interface CheckoutPaymentIntent {
  /** PendingOrder ID */
  pendingOrderId: string;

  /** Stripe PaymentIntent ID */
  paymentIntentId: string;

  /** Client secret for frontend Stripe Elements */
  clientSecret: string;

  /** Amount to charge */
  amount: number;

  /** Currency */
  currency: string;
}

/** Final checkout result after payment confirmation */
export interface CheckoutResult {
  /** Created order */
  order: any;

  /** Created invoice */
  invoice: any;

  /** Invoice access URL */
  invoiceUrl: string;

  /** Whether this was a new order (false if idempotent) */
  isNew: boolean;
}

/**
 * Checkout service for PawTag Commerce.
 */
export class CheckoutService {
  /**
   * Create a payment intent and pending order for checkout.
   *
   * This is called when the customer proceeds to payment.
   * It validates the cart, calculates totals, creates a Stripe PaymentIntent,
   * and stores a PendingOrder for recovery.
   *
   * @param userId - User ID
   * @returns Payment intent details for frontend
   */
  async createPaymentIntent(userId: string): Promise<CheckoutPaymentIntent> {
    // 1. Get and validate cart
    const cart = await Cart.findOne({ userId, status: 'active' });
    if (!cart || !cart.items.length) {
      throw new InvalidCartError('Your cart is empty');
    }

    // 2. Validate stock for all items
    for (const item of cart.items) {
      const canFulfill = await inventoryService.canFulfill(String(item.productId), item.quantity);
      if (!canFulfill) {
        throw new InvalidCartError(`${item.productName} is no longer available in the requested quantity`);
      }
    }

    // 3. Calculate totals (server-side)
    const totals = await cartService.calculateTotals(userId);

    // 4. Get user info for Stripe
    const user = await User.findById(userId).lean();
    if (!user) throw new NotFoundError('User');

    // 5. Generate order number for PendingOrder
    const orderNumber = await this.generateOrderNumber();

    // 6. Create Stripe PaymentIntent
    const paymentIntent = await stripePaymentProvider.createPaymentIntent({
      amount: totals.total,
      currency: totals.currency,
      orderId: orderNumber,
      customerEmail: user.email,
      customerName: user.fullName,
      metadata: {
        userId,
        orderNumber,
      },
    });

    // 7. Create PendingOrder
    const ttlMinutes = await getNumberSetting('commerce.checkout.pendingOrderTtlMinutes');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);

    const pendingOrder = await PendingOrder.create({
      userId,
      items: cart.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        unitPrice: item.unitPrice,
        customizationTotal: item.customizationTotal,
        quantity: item.quantity,
        image: item.image,
        customisation: item.customisation,
      })),
      subtotal: totals.subtotal,
      discount: totals.discount,
      promoCode: cart.promoCode,
      shipping: totals.shipping,
      shippingMethodId: cart.shippingMethodId,
      shippingMethodName: cart.shippingMethodName,
      tax: totals.tax,
      total: totals.total,
      currency: totals.currency,
      stripePaymentIntentId: paymentIntent.id,
      stripeClientSecret: paymentIntent.clientSecret,
      status: 'pending',
      referralCode: cart.promoCode,
      expiresAt,
      lastAccessedAt: new Date(),
    });

    // 8. Reserve stock for all items
    for (const item of cart.items) {
      await inventoryService.reserve({
        productId: String(item.productId),
        quantity: item.quantity,
        orderId: String(pendingOrder._id),
      });
    }

    logger.info({
      userId,
      pendingOrderId: pendingOrder._id,
      paymentIntentId: paymentIntent.id,
      total: totals.total,
    }, 'Checkout payment intent created');

    return {
      pendingOrderId: String(pendingOrder._id),
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.clientSecret,
      amount: totals.total,
      currency: totals.currency,
    };
  }

  /**
   * Confirm checkout after payment succeeds.
   *
   * Called by the frontend after stripe.confirmPayment() succeeds.
   * Validates payment, creates Order + Invoice, sends notifications.
   *
   * @param userId - User ID
   * @param paymentIntentId - Stripe PaymentIntent ID
   * @returns Checkout result with order and invoice
   */
  async confirmCheckout(userId: string, paymentIntentId: string): Promise<CheckoutResult> {
    logger.info({ userId, paymentIntentId }, 'Checkout confirm started');

    // 1. Find PendingOrder — try exact match first
    let pending = await PendingOrder.findOne({
      stripePaymentIntentId: paymentIntentId,
      userId,
    });

    // Fallback: find by paymentIntentId alone (userId may have changed after token refresh)
    if (!pending) {
      pending = await PendingOrder.findOne({ stripePaymentIntentId: paymentIntentId });
      if (pending) {
        logger.warn({ pendingUserId: String(pending.userId), requestUserId: userId }, 'PendingOrder found with different userId — token may have refreshed');
      }
    }

    if (!pending) {
      // Check if it was already converted
      const anyPending = await PendingOrder.findOne({ stripePaymentIntentId: paymentIntentId });
      if (anyPending) {
        logger.error({ status: anyPending.status, userId: String(anyPending.userId) }, 'PendingOrder exists but with wrong status or userId');
        if (anyPending.status === 'converted' && anyPending.convertedOrderId) {
          const existingOrder = await Order.findById(anyPending.convertedOrderId);
          if (existingOrder) {
            const invoice = await Invoice.findOne({ orderId: existingOrder._id });
            const invoiceUrl = invoice ? await this.getInvoiceUrl(invoice._id.toString(), userId) : '';
            return { order: existingOrder, invoice, invoiceUrl, isNew: false };
          }
        }
      }
      logger.error({ userId, paymentIntentId }, 'PendingOrder not found');
      throw new NotFoundError('Pending order');
    }
    logger.info({ pendingId: pending._id, status: pending.status, expiresAt: pending.expiresAt }, 'PendingOrder found');

    // 2. Check if already converted (idempotent)
    if (pending.status === 'converted' && pending.convertedOrderId) {
      const existingOrder = await Order.findById(pending.convertedOrderId);
      if (existingOrder) {
        const invoice = await Invoice.findOne({ orderId: existingOrder._id });
        const invoiceUrl = invoice ? await this.getInvoiceUrl(invoice._id.toString(), userId) : '';
        return { order: existingOrder, invoice, invoiceUrl, isNew: false };
      }
    }

    // 3. Check expiry
    if (pending.expiresAt < new Date()) {
      throw new CheckoutExpiredError('This checkout has expired. Please try again.');
    }

    // 4. Validate payment via Stripe API (server-side)
    const payment = await stripePaymentProvider.retrievePaymentIntent(paymentIntentId);
    logger.info({ paymentStatus: payment.status, paymentId: payment.id }, 'Stripe payment status');
    if (payment.status !== 'succeeded' && payment.status !== 'requires_capture') {
      logger.error({ paymentStatus: payment.status, paymentIntentId }, 'Payment not in expected state');
      throw new PaymentFailedError(`Payment status is ${payment.status}`);
    }

    // 5. Generate order number atomically
    const orderNumber = await this.generateOrderNumber();

    // 6. Create Order
    const order = await Order.create({
      orderNumber,
      userId,
      items: pending.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: (item.unitPrice + item.customizationTotal) * item.quantity,
      })),
      status: 'paid',
      payment: {
        method: 'card',
        status: 'completed',
        transactionId: paymentIntentId,
        stripePaymentIntentId: paymentIntentId,
        amount: pending.total,
        currency: pending.currency,
        paidAt: new Date(),
      },
      shippingAddress: pending.shippingAddress,
      referredByCode: pending.referralCode,
      notes: `Stripe PaymentIntent: ${paymentIntentId}`,
    });

    // 7. Record activity
    const activityEntry = {
      type: 'order_placed',
      message: 'Order placed and paid',
      timestamp: new Date(),
      actor: 'customer' as const,
    };
    await Order.updateOne({ _id: order._id }, { $push: { activity: activityEntry } });

    // 7b. Record payment transaction for audit trail
    await PaymentTransaction.create({
      orderId: order._id,
      orderNumber: order.orderNumber,
      type: 'payment',
      status: 'succeeded',
      amount: pending.total,
      currency: pending.currency,
      provider: 'stripe',
      providerTransactionId: paymentIntentId,
      initiatedBy: 'customer',
    });

    // 8. Confirm stock (deduct actual inventory)
    for (const item of pending.items) {
      await inventoryService.confirmSale(String(item.productId), item.quantity, orderNumber);
    }

    // 9. Create Invoice
    const invoice = await this.createInvoice(order, userId, pending.total);

    // 10. Mark PendingOrder as converted
    pending.status = 'converted';
    pending.convertedOrderId = order._id;
    pending.convertedAt = new Date();
    await pending.save();

    // 11. Clear cart
    await cartService.markConverted(userId);

    // 12. Generate invoice URL
    const invoiceUrl = await this.getInvoiceUrl(invoice._id.toString(), userId);

    // 13. Fire-and-forget: emails, notifications, referrals
    this.sendPostCheckoutNotifications(order, invoice, invoiceUrl, userId).catch((err) => {
      logger.error({ err, orderNumber }, 'Post-checkout notification error');
    });

    // 14. Audit log
    await logOrderEvent('created', {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      amount: pending.total,
      currency: pending.currency,
    });

    logger.info({ orderNumber, userId, total: pending.total }, 'Checkout confirmed');

    return { order, invoice, invoiceUrl, isNew: true };
  }

  /**
   * Create an invoice for a confirmed order.
   */
  private async createInvoice(order: any, userId: string, amount: number): Promise<any> {
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
      amount,
      currency: order.payment.currency || 'NZD',
      status: 'paid',
      paymentMethod: order.payment.method,
      paidAt: order.payment.paidAt || new Date(),
    });

    // Create secure access token
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

    return invoice;
  }

  /**
   * Get invoice URL for a given invoice.
   */
  private async getInvoiceUrl(invoiceId: string, userId: string): Promise<string> {
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const secureToken = generateSecureToken();
    const tokenHash = hashToken(secureToken);

    await InvoiceAccessToken.create({
      invoiceId,
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      verifiedAt: new Date(),
    });

    return `${FRONTEND_URL}/invoice/${secureToken}?admin=1`;
  }

  /**
   * Send post-checkout notifications (non-blocking).
   */
  private async sendPostCheckoutNotifications(
    order: any,
    invoice: any,
    invoiceUrl: string,
    userId: string,
  ): Promise<void> {
    const user = await User.findById(userId).lean();
    if (!user) return;

    const emailPromises: Promise<any>[] = [];

    // Order confirmation email
    emailPromises.push(
      sendOrderConfirmation({
        to: user.email,
        customerName: user.fullName,
        orderNumber: order.orderNumber,
        total: order.payment.amount,
        items: order.items.map((i: any) => ({
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        shippingAddress: order.shippingAddress,
      }).catch((err) => logger.error({ err }, 'Order confirmation email error')),
    );

    // Invoice email
    if (invoice) {
      emailPromises.push(
        generateInvoiceHtml(invoice._id.toString())
          .then((html) => sendInvoiceEmail(user.email, user.fullName, invoice.invoiceNumber, html, invoiceUrl, invoice.amount))
          .catch((err) => logger.error({ err }, 'Invoice email error')),
      );
    }

    // Admin notification
    const adminEmail = process.env.ADMIN_ALERT_EMAIL;
    if (adminEmail) {
      emailPromises.push(
        sendMail(
          adminEmail,
          `New PawTag order: ${order.orderNumber}`,
          `<h2>New Order Received</h2>
           <p><strong>Order:</strong> ${order.orderNumber}</p>
           <p><strong>Customer:</strong> ${user.fullName || 'Unknown'} (${user.email})</p>
           <p><strong>Amount:</strong> $${order.payment.amount.toFixed(2)} NZD</p>`,
        ).catch((err) => logger.error({ err }, 'Admin notification email error')),
      );
    }

    await Promise.allSettled(emailPromises);

    // Push notification
    sendPushToUser(userId, 'Order Confirmed', `Your order ${order.orderNumber} has been confirmed.`).catch(() => {});
  }

  /**
   * Generate atomic order number.
   */
  private async generateOrderNumber(): Promise<string> {
    const prefix = await getSetting('commerce.orders.numberPrefix');
    const length = await getNumberSetting('commerce.orders.numberLength');
    const counter = await Order.db!.collection('counters').findOneAndUpdate(
      { _id: 'orderNumber' as any },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    return `${prefix}-${String(counter?.value?.seq || 1).padStart(length, '0')}`;
  }
}

/** Singleton instance */
export const checkoutService = new CheckoutService();

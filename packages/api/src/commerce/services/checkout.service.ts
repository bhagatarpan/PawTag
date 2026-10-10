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

import { PendingOrder, Order, Invoice, InvoiceAccessToken, Cart, User, PaymentTransaction, Product } from '@pawtag/db';
import crypto from 'crypto';
import { NotFoundError } from '../../lib/app-errors';
import { InvalidCartError, CheckoutExpiredError, PaymentFailedError } from '../errors';
import { stripePaymentProvider } from '../providers/stripe';
import { inventoryService } from './inventory.service';

import { cartService } from './cart.service';
import { getSetting, getNumberSetting, getBooleanSetting } from '../config';
import { roundToCents } from '@pawtag/shared';

import { membershipEntitlementService } from '../../services/membership-entitlement.service';
import { logOrderEvent } from '../audit';
import { generateSecureToken, hashToken } from '../../services/auth.service';
import { sendOrderConfirmation, sendInvoiceEmail, sendMail } from '../../services/email.service';
import { generateInvoiceHtml } from '../../services/invoice-html.service';
import { sendPushToUser } from '../../services/push-notification.service';
import { formatCreatedBy, formatCreatedByDescription } from '../../lib/actor';
import logger from '../../lib/logger';

/** Checkout result from creating payment intent */
export interface CheckoutPaymentIntent {
  /** PendingOrder ID */
  pendingOrderId: string;

  /** Stripe PaymentIntent ID (or synthetic zero-total id) */
  paymentIntentId: string;

  /** Client secret for frontend Stripe Elements */
  clientSecret: string;

  /** Amount to charge (server-authoritative quote total) */
  amount: number;

  /** Currency */
  currency: string;

  /** Server quote revision for stale detection */
  quoteRevision?: string;

  /** Quote expiry */
  quoteExpiresAt?: Date;

  /** True when total is 0 and no Stripe charge is required */
  isZeroTotal?: boolean;
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
  async createPaymentIntent(userId: string, shippingAddress?: { line1: string; line2?: string; city: string; state: string; zip: string; country?: string }, autoRenew?: boolean | Record<string, boolean>, pawRewardsRedemption?: number): Promise<CheckoutPaymentIntent> {
    // 1. Get and validate cart
    const cart = await Cart.findOne({ userId, status: 'active' });
    logger.info({ userId, cartFound: !!cart, itemCount: cart?.items?.length || 0 }, 'Payment intent cart lookup');
    if (!cart || !cart.items.length) {
      // Debug: check if any cart exists for this user
      const anyCart = await Cart.findOne({ userId });
      logger.error({ userId, anyCartFound: !!anyCart, anyCartStatus: anyCart?.status, anyCartItems: anyCart?.items?.length || 0 }, 'Cart empty or missing');
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

    // 3b. Apply membership-based free shipping if eligible
    // Uses the entitlement registry — works for ALL tiers (Gold, Platinum, Black)
    const freeShippingThreshold = await membershipEntitlementService.getValue<number>(userId, 'free_shipping_threshold');
    if (freeShippingThreshold !== null && freeShippingThreshold >= 0 && totals.subtotal >= freeShippingThreshold) {
      totals.shipping = 0;
      // Recalculate total consistently with cart.service: subtract accessoryDiscount,
      // only add tax when tax-exclusive (tax is already in prices when inclusive)
      const { nzGstProvider } = await import('../providers/simple-gst');
      const taxInclusiveFreeShip = await nzGstProvider.isInclusive();
      totals.total = roundToCents(
        totals.subtotal - (totals.discount || 0) - (totals.accessoryDiscount || 0) + 0 + (taxInclusiveFreeShip ? 0 : (totals.tax || 0)),
      );
      logger.info({ userId, freeShippingThreshold, subtotal: totals.subtotal }, 'Membership free shipping applied at checkout');
    }

    // 3c. PawRewards requested amount is applied atomically after PendingOrder
    // is created (see reserveRewards below). Do not trust client totals.
    const requestedRewards = (pawRewardsRedemption ?? 0);

    // 4. Get user info for Stripe
    const user = await User.findById(userId).lean();
    if (!user) throw new NotFoundError('User');

    // 4b. Ensure Stripe Customer exists (for saving payment method for future renewals)
    let stripeCustomerId = user.stripeCustomerId;
    const { isFakeMode } = await import('../payment-mode');
    const fakeMode = isFakeMode();

    if (!stripeCustomerId && !fakeMode) {
      try {
        const { getStripeClient } = await import('../../lib/stripe-client');
        const stripe = getStripeClient();
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.fullName || undefined,
          metadata: { userId: userId.toString(), source: 'pawtag-checkout' },
        });
        stripeCustomerId = customer.id;
        await User.findByIdAndUpdate(userId, { stripeCustomerId: customer.id });
        logger.info({ userId, stripeCustomerId: customer.id }, 'Created Stripe customer at checkout');
      } catch (err) {
        logger.error({ err, userId }, 'Failed to create Stripe customer — checkout will proceed without saved payment method');
      }
    }

    // 5. Generate order number for PendingOrder
    const orderNumber = await this.generateOrderNumber();

    // Build authoritative server quote (client monetary fields are never trusted)
    const quote = await this.buildCheckoutQuote(userId, {
      requestedRewards,
      shippingAddress,
      shippingMethodId: cart.shippingMethodId,
    });

    // Zero-total orders: no Stripe PaymentIntent — explicit paid-zero path via synthetic PI id
    let paymentIntent: { id: string; clientSecret: string };
    if (quote.total <= 0) {
      paymentIntent = {
        id: `pi_zero_${orderNumber}`,
        clientSecret: `pi_zero_${orderNumber}_secret`,
      };
      logger.info({ userId, orderNumber, total: quote.total }, 'Zero-total checkout — skipping Stripe PaymentIntent');
    } else {
      paymentIntent = await stripePaymentProvider.createPaymentIntent({
        amount: quote.total,
        currency: quote.currency,
        orderId: orderNumber,
        customerEmail: user.email,
        customerName: user.fullName,
        stripeCustomerId: stripeCustomerId || undefined,
        metadata: {
          userId,
          orderNumber,
        },
      });
    }

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
        customisationTexts: item.customisationTexts || [],
      })),
      subtotal: roundToCents(quote.subtotal),
      discount: roundToCents(quote.discount),
      promoCode: cart.promoCode,
      shipping: roundToCents(quote.shipping),
      shippingMethodId: quote.shippingMethodId || cart.shippingMethodId,
      shippingMethodName: quote.shippingMethodName || cart.shippingMethodName,
      tax: roundToCents(quote.tax),
      total: roundToCents(quote.total),
      currency: quote.currency,
      stripePaymentIntentId: paymentIntent.id,
      stripeClientSecret: paymentIntent.clientSecret,
      shippingAddress: shippingAddress || undefined,
      status: 'pending',
      referralCode: cart.promoCode,
      autoRenew: typeof autoRenew === 'boolean' ? autoRenew : (autoRenew !== undefined ? true : true),
      pawRewardsRedemption: 0,
      pawRewardsReserved: false,
      autoRenewMap: typeof autoRenew === 'object' && autoRenew !== null ? autoRenew : undefined,
      expiresAt,
      lastAccessedAt: new Date(),
      quoteRevision: quote.quoteRevision,
      quoteExpiresAt: quote.expiresAt,
    } as any);

    // Atomic PawRewards reservation keyed to PendingOrder
    if (requestedRewards > 0) {
      try {
        const { reserveRewards } = await import('../../services/loyalty/pawrewards.service');
        const reservation = await reserveRewards(
          userId,
          requestedRewards,
          String(pendingOrder._id),
          expiresAt,
        );
        const reservedRewards = reservation.reserved;
        if (reservedRewards > 0) {
          const rewardsDiscount = Math.min(reservedRewards, quote.total);
          pendingOrder.pawRewardsRedemption = reservedRewards;
          pendingOrder.pawRewardsReserved = true;
          // quote.total already has rewardsToApply subtracted (via buildCheckoutQuote discount).
          // Do NOT subtract again — that would double-count the rewards discount.
          pendingOrder.total = quote.total;
          pendingOrder.discount = (pendingOrder.discount || 0) + reservedRewards;
          await pendingOrder.save();
          logger.info(
            { userId, pendingOrderId: pendingOrder._id, reservedRewards, rewardsDiscount, newTotal: pendingOrder.total },
            'PawRewards reserved atomically for checkout',
          );
        }
      } catch (err) {
        logger.error({ err, userId, pendingOrderId: pendingOrder._id }, 'PawRewards reservation failed — cleaning up pending order');
        await PendingOrder.findByIdAndDelete(pendingOrder._id);
        throw new InvalidCartError('Could not reserve PawRewards for this checkout');
      }
    }

    // 8. Reserve stock for all items (with compensation on failure)
    const reservationResult = await inventoryService.reserveAll(
      cart.items.map((item) => ({
        productId: String(item.productId),
        quantity: item.quantity,
      })),
      String(pendingOrder._id),
    );

    if (!reservationResult.success) {
      // Reservation failed and was compensated — clean up pending order + rewards hold
      if (pendingOrder.pawRewardsReserved && pendingOrder.pawRewardsRedemption) {
        const { releaseRewardsReservation } = await import('../../services/loyalty/pawrewards.service');
        await releaseRewardsReservation(userId, pendingOrder.pawRewardsRedemption, String(pendingOrder._id), String(pendingOrder._id)).catch(() => {});
      }
      await PendingOrder.findByIdAndDelete(pendingOrder._id);
      throw new InvalidCartError(`Could not reserve stock: ${reservationResult.error}`);
    }

    logger.info({
      userId,
      pendingOrderId: pendingOrder._id,
      paymentIntentId: paymentIntent.id,
      total: pendingOrder.total,
      quoteRevision: (pendingOrder as any).quoteRevision,
    }, 'Checkout payment intent created');

    return {
      pendingOrderId: String(pendingOrder._id),
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.clientSecret,
      amount: pendingOrder.total,
      currency: pendingOrder.currency,
      quoteRevision: (pendingOrder as any).quoteRevision,
      quoteExpiresAt: (pendingOrder as any).quoteExpiresAt,
      isZeroTotal: pendingOrder.total <= 0,
    };
  }

  /**
   * Build an authoritative checkout quote from server state.
   * Client-submitted monetary values are ignored.
   */
  async buildCheckoutQuote(
    userId: string,
    opts: {
      requestedRewards?: number;
      shippingAddress?: { line1: string; line2?: string; city: string; state: string; zip: string; country?: string };
      shippingMethodId?: string;
    } = {},
  ): Promise<import('@pawtag/shared').CheckoutQuote> {
    const totals = await cartService.calculateTotals(userId);

    // Membership free shipping
    const freeShippingThreshold = await membershipEntitlementService.getValue<number>(userId, 'free_shipping_threshold');
    let shipping = totals.shipping;
    if (freeShippingThreshold !== null && freeShippingThreshold >= 0 && totals.subtotal >= freeShippingThreshold) {
      shipping = 0;
    }

    // Resolve shipping method authoritatively by stable id when present
    let shippingMethodId = opts.shippingMethodId;
    let shippingMethodName: string | undefined;
    if (shippingMethodId) {
      const { ShippingMethod } = await import('@pawtag/db');
      const method = await ShippingMethod.findById(shippingMethodId).lean();
      if (method && method.isActive) {
        shipping = method.rate;
        shippingMethodName = method.name;
      }
    }

    // Rewards: clamp to available unreserved balance (actual hold happens later)
    const requestedRewards = opts.requestedRewards || 0;
    let rewardsToApply = 0;
    if (requestedRewards > 0) {
      const { User: UserModel } = await import('@pawtag/db');
      const currentUser = await UserModel.findById(userId).select('pawRewardsBalance pawRewardsReserved').lean();
      const available = Math.max(
        0,
        (currentUser?.pawRewardsBalance || 0) - (currentUser?.pawRewardsReserved || 0),
      );
      rewardsToApply = Math.min(requestedRewards, available);
    }

    // Include accessory discount in the total (cart computes it; checkout must not drop it)
    const accessoryDiscount = totals.accessoryDiscount || 0;
    const discount = (totals.discount || 0) + rewardsToApply;
    const tax = totals.tax || 0;
    const subtotal = totals.subtotal;

    // Determine tax-inclusive from the GST provider (same source as cart.service)
    const { nzGstProvider } = await import('../providers/simple-gst');
    const taxInclusive = await nzGstProvider.isInclusive();

    // Total formula must match cart.service.calculateTotals:
    // tax-inclusive: tax is already in prices — do NOT add it again
    // tax-exclusive: tax is added on top
    const total = Math.max(0, roundToCents(subtotal - discount - accessoryDiscount + shipping + (taxInclusive ? 0 : tax)));

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const quoteRevision = crypto.createHash('sha256')
      .update(JSON.stringify({ userId, subtotal, discount, accessoryDiscount, shipping, tax, total, rewardsToApply, shippingMethodId, at: now.toISOString() }))
      .digest('hex')
      .slice(0, 16);

    return {
      userId,
      currency: totals.currency || 'NZD',
      subtotal,
      discount,
      rewardsDiscount: rewardsToApply,
      shipping,
      shippingMethodId,
      shippingMethodName,
      tax,
      total,
      quoteRevision,
      quotedAt: now,
      expiresAt,
      isZeroTotal: total <= 0,
    };
  }

  /**
   * Public quote endpoint helper — recalculates from authoritative state.
   */
  async getCheckoutQuote(
    userId: string,
    opts: { requestedRewards?: number; shippingMethodId?: string } = {},
  ): Promise<import('@pawtag/shared').CheckoutQuote> {
    return this.buildCheckoutQuote(userId, opts);
  }

  /**
   * Confirm checkout after payment succeeds.
   *
   * Called by the frontend after stripe.confirmPayment() succeeds.
   * Validates payment, creates Order + Invoice, sends notifications.
   *
   * @param userId - User ID
   * @param paymentIntentId - Stripe PaymentIntent ID
   * @param portal - Source portal (default: 'customer-web')
   * @returns Checkout result with order and invoice
   */
  async confirmCheckout(userId: string, paymentIntentId: string, portal: string = 'customer-web'): Promise<CheckoutResult> {
    const correlationId = crypto.randomUUID();
    logger.info({ userId, paymentIntentId, correlationId }, 'Checkout confirm started');

    // 1. Find PendingOrder — MUST match both paymentIntentId AND userId (ownership enforced)
    const pending = await PendingOrder.findOne({
      stripePaymentIntentId: paymentIntentId,
      userId,
    });

    if (!pending) {
      // Check if it was already converted — but still require ownership
      const anyPending = await PendingOrder.findOne({ stripePaymentIntentId: paymentIntentId });
      if (anyPending) {
        // Ownership check: only the PendingOrder owner can retrieve it
        if (String(anyPending.userId) !== userId) {
          logger.warn({ pendingUserId: String(anyPending.userId), requestUserId: userId }, 'Unauthorized checkout attempt — userId mismatch');
          throw new NotFoundError('Pending order');
        }
        logger.error({ status: anyPending.status, userId: String(anyPending.userId) }, 'PendingOrder exists but with wrong status');
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
    // Zero-total checkouts use a synthetic PI id and skip Stripe retrieval.
    const isZeroTotalPayment = paymentIntentId.startsWith('pi_zero_');
    let payment: { cardBrand?: string; cardLast4?: string; status?: string } | null = null;
    if (isZeroTotalPayment) {
      if (pending.total > 0) {
        throw new PaymentFailedError('Zero-total payment id used for non-zero pending order');
      }
      logger.info({ paymentIntentId, pendingId: pending._id }, 'Zero-total checkout confirmed without Stripe');
    } else {
      payment = await stripePaymentProvider.retrievePaymentIntent(paymentIntentId);
      logger.info({ paymentStatus: payment.status, paymentId: paymentIntentId }, 'Stripe payment status');
      if (payment.status !== 'succeeded' && payment.status !== 'requires_capture') {
        logger.error({ paymentStatus: payment.status, paymentIntentId }, 'Payment not in expected state');
        throw new PaymentFailedError(`Payment status is ${payment.status}`);
      }
    }

    // 5. Check if order already exists for this payment (idempotent — previous attempt may have partially succeeded)
    const existingOrder = await Order.findOne({ 'payment.stripePaymentIntentId': paymentIntentId });
    if (existingOrder) {
      logger.info({ orderId: existingOrder._id, orderNumber: existingOrder.orderNumber }, 'Order already exists for this payment');
      const invoice = await Invoice.findOne({ orderId: existingOrder._id });
      const invoiceUrl = invoice ? await this.getInvoiceUrl(invoice._id.toString(), userId) : '';

      // Mark pending as converted if not already
      if (pending.status !== 'converted') {
        pending.status = 'converted';
        pending.convertedOrderId = existingOrder._id;
        pending.convertedAt = new Date();
        await pending.save();
      }

      return { order: existingOrder, invoice, invoiceUrl, isNew: false };
    }

    // 6-7. Generate order number and create Order (retry on duplicate key)
    const creator = await User.findById(userId).select('fullName email').lean();
    const createdBy = formatCreatedBy(creator?.fullName || 'Unknown User', 'Customer');
    const createdByDescription = formatCreatedByDescription(portal, creator?.fullName || 'Unknown User');

    let order: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const orderNumber = await this.generateOrderNumber();
        order = await Order.create({
          orderNumber,
          userId,
          items: pending.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: roundToCents(item.unitPrice),
            totalPrice: roundToCents((item.unitPrice + item.customizationTotal) * item.quantity),
            customizationTotal: roundToCents(item.customizationTotal),
            customisationTexts: item.customisationTexts || [],
          })),
          subtotal: roundToCents(pending.subtotal),
          shippingCost: roundToCents(pending.shipping),
          tax: roundToCents(pending.tax),
          discount: pending.discount > 0 ? { percent: 0, amount: roundToCents(pending.discount), reason: pending.promoCode || '' } : undefined,
          status: 'paid',
          completionStatus: 'pending',
          completionCorrelationId: correlationId,
          payment: {
            method: 'card',
            status: 'completed',
            transactionId: paymentIntentId,
            stripePaymentIntentId: paymentIntentId,
            cardBrand: (payment as any)?.cardBrand,
            cardLast4: (payment as any)?.cardLast4,
            amount: roundToCents(pending.total),
            currency: pending.currency,
            paidAt: new Date(),
          },
          shippingAddress: pending.shippingAddress,
          referredByCode: pending.referralCode,
          autoRenew: pending.autoRenew !== false,
          autoRenewMap: pending.autoRenewMap,
          notes: (payment as any)?.cardBrand
            ? `Paid with ${(payment as any).cardBrand.charAt(0).toUpperCase() + (payment as any).cardBrand.slice(1).toLowerCase()}${(payment as any).cardLast4 ? ` ••••${(payment as any).cardLast4}` : ''} — Stripe PaymentIntent: ${paymentIntentId}`
            : isZeroTotalPayment
              ? `Zero-total checkout — Stripe PaymentIntent: ${paymentIntentId}`
              : `Stripe PaymentIntent: ${paymentIntentId}`,
          createdBy,
          createdByType: 'Customer',
          createdByPortal: portal,
          createdByDescription,
          createdByEmail: creator?.email || null,
        });
        break; // success
      } catch (err: any) {
        if (err?.code === 11000) {
          // Duplicate key — determine which index was violated
          const keyPattern = err?.keyPattern || {};
          if (keyPattern['payment.stripePaymentIntentId']) {
            // Another concurrent request already created an order for this PaymentIntent.
            // Fetch the existing order and return it idempotently.
            logger.warn({ attempt, paymentIntentId }, 'Order duplicate on stripePaymentIntentId — returning existing order');
            const existingOrder = await Order.findOne({ 'payment.stripePaymentIntentId': paymentIntentId });
            if (existingOrder) {
              const existingInvoice = await Invoice.findOne({ orderId: existingOrder._id });
              const existingInvoiceUrl = existingInvoice ? await this.getInvoiceUrl(existingInvoice._id.toString(), userId) : '';
              return { order: existingOrder, invoice: existingInvoice, invoiceUrl: existingInvoiceUrl, isNew: false };
            }
          }
          // Order number duplicate — retry with a new number
          if (attempt < 2) {
            logger.warn({ attempt, paymentIntentId }, 'Order number duplicate, retrying');
            continue;
          }
        }
        throw err;
      }
    }

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
      amount: roundToCents(pending.total),
      providerTransactionId: paymentIntentId,
      initiatedBy: 'customer',
      cardBrand: order.payment?.cardBrand,
      cardLast4: order.payment?.cardLast4,
    });

    // 8-10. Post-payment completion steps with error tracking
    // Each step is tracked individually so failures are queryable and retryable.
    const completionErrors: Array<{ step: string; error: string; productId?: string; timestamp: Date }> = [];

    // 8. Confirm stock (deduct actual inventory) — fail-loud on atomic transition miss
    try {
      for (const item of pending.items) {
        await inventoryService.confirmSale(String(item.productId), item.quantity, order.orderNumber);
      }
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      logger.error({ err, orderId: order._id, correlationId }, 'Completion step failed: inventory confirmation');
      completionErrors.push({ step: 'inventory_confirmation', error: errorMsg, timestamp: new Date() });
    }

    // 8a. Increment promo code usage exactly once per order (idempotent)
    if (pending.promoCode) {
      try {
        const { PromoCode, PromoUsage } = await import('@pawtag/db');
        const code = pending.promoCode.toUpperCase();
        // Durable unique guard — retries must not increment twice
        const usage = await PromoUsage.findOneAndUpdate(
          { code, orderId: order._id },
          {
            $setOnInsert: {
              code,
              orderId: order._id,
              orderNumber: order.orderNumber,
              userId: order.userId,
            },
          },
          { upsert: true, new: false },
        );

        if (!usage) {
          // First commit for this order — increment usage with limit guard
          const promo = await PromoCode.findOne({ code });
          if (promo) {
            const limitFilter: Record<string, unknown> = { code };
            if (promo.usageLimit && promo.usageLimit > 0) {
              limitFilter.usageCount = { $lt: promo.usageLimit };
            }
            const updated = await PromoCode.findOneAndUpdate(
              limitFilter,
              { $inc: { usageCount: 1 } },
              { new: true },
            );
            if (!updated && promo.usageLimit && promo.usageCount >= promo.usageLimit) {
              logger.warn({ orderId: order._id, promoCode: code, usageLimit: promo.usageLimit }, 'Promo usage limit reached at finalization');
            } else {
              logger.info({ orderId: order._id, promoCode: code }, 'Promo usage incremented');
            }
          }
        } else {
          logger.info({ orderId: order._id, promoCode: code }, 'Promo usage already committed for this order');
        }
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        logger.error({ err, orderId: order._id, correlationId }, 'Completion step failed: promo usage increment');
        completionErrors.push({ step: 'promo_usage_increment', error: errorMsg, timestamp: new Date() });
      }
    }

    // 8a2. Commit PawRewards reservation (idempotent per PendingOrder)
    if (pending.pawRewardsRedemption && pending.pawRewardsRedemption > 0) {
      try {
        const { commitRewardsReservation } = await import('../../services/loyalty/pawrewards.service');
        await commitRewardsReservation(
          userId,
          pending.pawRewardsRedemption,
          order.orderNumber,
          String(pending._id),
        );
        logger.info({ orderId: order._id, amount: pending.pawRewardsRedemption }, 'PawRewards reservation committed');
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        logger.error({ err, orderId: order._id, correlationId }, 'Completion step failed: PawRewards commit');
        completionErrors.push({ step: 'pawrewards_commit', error: errorMsg, timestamp: new Date() });
      }
    }

    // 8a3. Award Guardian Points for purchase
    try {
      const { awardPurchasePoints } = await import('../../services/loyalty/points-earning.service');
      const pointsResult = await awardPurchasePoints(userId, pending.total, order._id.toString());
      logger.info({ orderId: order._id, pointsAwarded: pointsResult.pointsAwarded, totalPoints: pointsResult.totalPoints }, 'Guardian Points awarded for purchase');
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      logger.error({ err, orderId: order._id, correlationId }, 'Completion step failed: Guardian Points award');
      completionErrors.push({ step: 'guardian_points_award', error: errorMsg, timestamp: new Date() });
    }

    // 8b. Tag creation DEFERRED to fulfillment time (HYBRID 2 model)
    // Tags are now created when warehouse staff assigns Tag ID during fulfillment
    // This ensures Active Period starts when customer receives the tag, not at order time
    // See: admin-fulfilments.ts assign-tag endpoint

    // 8c. Create Digital Product Entitlements
    try {
      const { DigitalProduct: DigitalProductModel, DigitalEntitlement } = await import('@pawtag/db');
      
      for (const item of pending.items) {
        try {
          const product = await Product.findById(item.productId).lean();
          if (!product || product.productType !== 'digital') continue;

          // Find the digital product configuration
          const digitalProduct = await DigitalProductModel.findOne({ productId: item.productId });
          if (!digitalProduct) continue;

          // Calculate access expiry
          let accessExpiresAt: Date | undefined;
          if (digitalProduct.accessType === 'time_limited' && digitalProduct.accessDurationDays) {
            accessExpiresAt = new Date();
            accessExpiresAt.setDate(accessExpiresAt.getDate() + digitalProduct.accessDurationDays);
          }

          // Create entitlement
          await DigitalEntitlement.create({
            userId,
            digitalProductId: digitalProduct._id,
            orderId: order._id,
            grantedAt: new Date(),
            accessExpiresAt,
            downloadCount: 0,
            downloadLimit: digitalProduct.downloadLimit || 0,
            isActive: true,
          });

          logger.info({ digitalProductId: digitalProduct._id, orderId: order.orderNumber, productId: item.productId, correlationId }, 'Digital product entitlement created');
        } catch (itemErr: any) {
          const errorMsg = itemErr?.message || String(itemErr);
          logger.error({ err: itemErr, orderId: order._id, productId: item.productId, correlationId }, 'Digital entitlement creation failed for item');
          completionErrors.push({ step: 'digital_entitlement_creation', error: errorMsg, productId: String(item.productId), timestamp: new Date() });
        }
      }
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      logger.error({ err, orderId: order._id, correlationId }, 'Completion step failed: digital entitlement creation');
      completionErrors.push({ step: 'digital_entitlement_creation', error: errorMsg, timestamp: new Date() });
    }

    // 8d. Auto-create Fulfilment (and optionally Tag) if enabled
    try {
      const autoCreateFulfilment = await getBooleanSetting('commerce.fulfilment.autoCreateFulfilment');
      const autoCreateTag = await getBooleanSetting('commerce.fulfilment.autoCreateTag');

      if (autoCreateFulfilment) {
        const { Fulfilment } = await import('@pawtag/db');

        // Map order items to fulfilment items
        const fulfilmentItems = order.items.map((item: any) => ({
          orderItemId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          pickedQuantity: 0,
          packedQuantity: 0,
        }));

        const fulfilment = await Fulfilment.create({
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: 'pending',
          items: fulfilmentItems,
          notes: autoCreateTag ? 'Auto-created — Tag ID will be auto-generated' : 'Auto-created — Tag to be assigned manually',
        });

        logger.info({ fulfilmentId: fulfilment._id, orderId: order._id, orderNumber: order.orderNumber, correlationId }, 'Auto-created fulfilment');

        // Auto-create Tag if full automation mode is enabled
        if (autoCreateTag) {
          const { Tag } = await import('@pawtag/db');
          const { generateTagId } = await import('../../lib/tag-id');

          // Create a tag for each physical/tag product in the order
          for (const item of order.items) {
            const product = await Product.findById(item.productId).lean();
            if (!product || product.productType !== 'physical') continue;

            // Calculate active period and warranty from product config
            const activePeriodMonths = product.activePeriodMonths || 3;
            const warrantyMonths = product.warrantyMonths || 12;
            const activePeriodEndsAt = new Date();
            activePeriodEndsAt.setMonth(activePeriodEndsAt.getMonth() + activePeriodMonths);
            const warrantyEndsAt = new Date();
            warrantyEndsAt.setMonth(warrantyEndsAt.getMonth() + warrantyMonths);

            // Create one tag per quantity ordered
            for (let i = 0; i < item.quantity; i++) {
              const tagIdStr = await generateTagId();
              await Tag.create({
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

              logger.info({ tagId: tagIdStr, orderId: order._id, orderNumber: order.orderNumber, productName: product.name, correlationId }, 'Auto-created tag');
            }
          }
        }

        // Send admin/warehouse notification email
        try {
          const adminEmail = process.env.ADMIN_ALERT_EMAIL;
          if (adminEmail) {
            const { sendMail } = await import('../../services/email.service');
            const { renderFulfilmentAlertEmail } = await import('../../services/email/templates/fulfilment-alert');

            const itemList = order.items
              .map((item: any) => `${item.productName} × ${item.quantity}`)
              .join(', ');

            const customerUser = await User.findById(userId).select('fullName email').lean();
            const customerName = (customerUser as any)?.fullName || 'Unknown';
            const customerEmail = (customerUser as any)?.email || 'Unknown';

            await sendMail(
              adminEmail,
              `New fulfilment ready: ${order.orderNumber}`,
              renderFulfilmentAlertEmail({
                orderNumber: order.orderNumber,
                customerName,
                customerEmail,
                items: itemList,
                total: order.payment.amount,
                fulfilmentId: String(fulfilment._id),
                autoTagCreated: autoCreateTag,
              }),
            ).catch(() => {});
          }
        } catch (emailErr) {
          logger.error({ err: emailErr, orderId: order._id }, 'Failed to send fulfilment alert email');
        }
      }
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      logger.error({ err, orderId: order._id, correlationId }, 'Completion step failed: fulfilment creation');
      completionErrors.push({ step: 'fulfilment_creation', error: errorMsg, timestamp: new Date() });
    }

    // 9. Create Invoice
    let invoice: any;
    try {
      invoice = await this.createInvoice(order, userId, pending.total);
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      logger.error({ err, orderId: order._id, correlationId }, 'Completion step failed: invoice creation');
      completionErrors.push({ step: 'invoice_creation', error: errorMsg, timestamp: new Date() });
    }

    // 10. Mark PendingOrder as converted
    pending.status = 'converted';
    pending.convertedOrderId = order._id;
    pending.convertedAt = new Date();
    await pending.save();

    // 11. Clear cart
    try {
      await cartService.markConverted(userId);
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      logger.error({ err, orderId: order._id, correlationId }, 'Completion step failed: cart clearing');
      completionErrors.push({ step: 'cart_clearing', error: errorMsg, timestamp: new Date() });
    }

    // Update order completion status based on errors
    const completionStatus = completionErrors.length > 0 ? 'repair_required' : 'complete';
    await Order.findByIdAndUpdate(order._id, {
      completionStatus,
      ...(completionErrors.length > 0 ? { completionErrors } : {}),
    });

    if (completionErrors.length > 0) {
      logger.warn({
        orderId: order._id,
        orderNumber: order.orderNumber,
        correlationId,
        failedSteps: completionErrors.map(e => e.step),
      }, 'Checkout completed with repair-required steps');
    } else {
      logger.info({ orderId: order._id, orderNumber: order.orderNumber, correlationId }, 'Checkout completed — all steps succeeded');
    }

    // 12. Generate invoice URL
    const invoiceUrl = invoice ? await this.getInvoiceUrl(invoice._id.toString(), userId) : '';

    // 13. Fire-and-forget: emails, notifications, referrals
    this.sendPostCheckoutNotifications(order, invoice, invoiceUrl, userId).catch((err) => {
      logger.error({ err, orderNumber: order.orderNumber, correlationId }, 'Post-checkout notification error');
    });

    // 14. Audit log
    await logOrderEvent('created', {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      amount: pending.total,
      currency: pending.currency,
    });

    logger.info({ orderNumber: order.orderNumber, userId, total: pending.total, correlationId, completionStatus }, 'Checkout confirmed');

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
      amount: roundToCents(amount),
      currency: order.payment.currency || 'NZD',
      status: 'paid',
      paymentMethod: order.payment.method,
      paidAt: order.payment.paidAt || new Date(),
    });

    // Create secure access token
    const secureToken = generateSecureToken();
    const tokenHash = hashToken(secureToken);
    const _FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

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
          customizationTotal: i.customizationTotal,
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
    // MongoDB driver v5 returns { value: { seq: N } } on returnDocument: 'after'
    const seq = (counter as any)?.value?.seq ?? 1;
    return `${prefix}-${String(seq).padStart(length, '0')}`;
  }
}

/** Singleton instance */
export const checkoutService = new CheckoutService();

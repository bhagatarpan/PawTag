/**
 * @module Stripe Webhook Handler
 * @description Production-grade Stripe webhook handler for PawTag Commerce.
 *
 * CRITICAL: This handler verifies webhook signatures to prevent spoofed events.
 * The previous implementation had signature verification stubbed — this is a
 * security vulnerability that this handler fixes.
 *
 * Handled events:
 * - payment_intent.succeeded — Confirm order payment
 * - payment_intent.payment_failed — Mark order as failed
 * - invoice.payment_succeeded — Subscription renewal
 * - invoice.payment_failed — Dunning notification
 * - customer.subscription.deleted — Cancel subscription
 *
 * Idempotency:
 * - WebhookEvent model with unique {source, eventId} index
 * - Duplicate events are detected and skipped
 * - Failed events are retried with exponential backoff
 *
 * Usage:
 * ```typescript
 * // Mount with raw body parser for signature verification
 * app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
 * app.use('/api/webhooks/stripe', stripeWebhookHandler);
 * ```
 */

import { Router, Request, Response } from 'express';
import { Order, Invoice, Subscription, Tag, User, Notification, WebhookEvent, PendingOrder, PaymentTransaction, UserMembership, MembershipTier } from '@pawtag/db';
import { stripePaymentProvider } from '../commerce/providers/stripe';
import { checkoutService } from '../commerce/services/checkout.service';
import { isFakeMode } from '../commerce/payment-mode';
import { logPaymentEvent } from '../commerce/audit';

import { activateMembership } from '../services/membership.service';
import {
  syncMembershipFromStripeSubscriptionUpdated,
  syncTagSubscriptionFromStripeSubscriptionUpdated,
} from '../services/billing-cancel-sync.service';
import { sendSubscriptionRenewalEmail } from '../services/email.service';
import logger from '../lib/logger';

const router = Router();

/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook endpoint. Expects raw body for signature verification.
 *
 * IMPORTANT: The Express route MUST use express.raw() middleware:
 *   app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
 *
 * This is because Stripe signature verification requires the raw body.
 */
router.post('/', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];

  // ─── Fake mode ────────────────────────────────────────────
  // Fake mode is ONLY allowed in development/test. In production, the startup
  // validation should have already rejected fake payment configuration.
  // This guard is a safety net in case startup validation is bypassed.
  if (isFakeMode()) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('Stripe webhook received in production with fake payment mode — this should never happen');
      res.status(500).json({ success: false, error: 'Payment system misconfigured' });
      return;
    }
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    logger.info({ eventType: event.type }, 'Received fake mode Stripe webhook');

    await handleEvent(event.type, event.data?.object);
    res.json({ received: true });
    return;
  }

  // ─── Production: Verify signature ────────────────────────
  if (!sig) {
    logger.warn('Stripe webhook received without signature');
    res.status(400).json({ success: false, error: 'Missing stripe-signature header' });
    return;
  }

  // Verify the payload is a Buffer (raw body)
  if (!Buffer.isBuffer(req.body)) {
    logger.error('Stripe webhook body is not a Buffer — raw body middleware missing');
    res.status(500).json({ success: false, error: 'Server configuration error' });
    return;
  }

  try {
    // Verify signature and parse event
    const event = await stripePaymentProvider.verifyWebhookSignature(req.body, sig as string);

    // Check idempotency
    const existing = await WebhookEvent.findOne({
      source: 'stripe',
      eventId: event.id,
    });

    if (existing?.status === 'completed') {
      logger.info({ eventId: event.id, type: event.type }, 'Stripe webhook already processed (idempotent)');
      res.json({ received: true });
      return;
    }

    // Store event for idempotency
    if (!existing) {
      try {
        await WebhookEvent.create({
          source: 'stripe',
          event: event.type,
          eventId: event.id,
          payload: event.data,
          status: 'processing',
        });
      } catch (err: any) {
        // Duplicate key error = race condition, another worker is processing
        if (err.code === 11000) {
          logger.info({ eventId: event.id }, 'Stripe webhook event already being processed');
          res.json({ received: true });
          return;
        }
        throw err;
      }
    }

    // Process event
    await handleEvent(event.type, event.data);

    // Mark as completed
    await WebhookEvent.findOneAndUpdate(
      { source: 'stripe', eventId: event.id },
      { status: 'completed', processedAt: new Date() },
    );

    logger.info({ eventId: event.id, type: event.type }, 'Stripe webhook processed successfully');
    res.json({ received: true });
  } catch (err: any) {
    logger.error({ err, eventType: (req.body as any)?.type }, 'Stripe webhook error');

    // Body is a raw Buffer after signature verification failure/processing error.
    // Parse only to recover event identity for durable retry records — never process unverified events.
    let eventId: string | undefined;
    let eventType: string | undefined;
    try {
      const raw = Buffer.isBuffer(req.body)
        ? JSON.parse(req.body.toString('utf8'))
        : req.body;
      eventId = typeof raw?.id === 'string' ? raw.id : undefined;
      eventType = typeof raw?.type === 'string' ? raw.type : undefined;
    } catch {
      // Leave identity undefined if body is not parseable JSON
    }

    if (eventId) {
      await WebhookEvent.findOneAndUpdate(
        { source: 'stripe', eventId },
        {
          status: 'failed',
          event: eventType || 'unknown',
          lastError: err.message,
          $inc: { attempts: 1 },
          nextRetryAt: new Date(Date.now() + 60_000),
          $setOnInsert: {
            payload: {},
          },
        },
        { upsert: true },
      ).catch(() => {});
    }

    // Invalid signature / processing failure must not look like success
    res.status(400).json({ success: false, error: err.message || 'Webhook processing failed' });
  }
});

/**
 * Route event to the appropriate handler.
 */
async function handleEvent(type: string, data: any): Promise<void> {
  switch (type) {
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(data);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(data);
      break;
    case 'charge.refunded':
      await handleChargeRefunded(data);
      break;
    case 'refund.created':
      await handleRefundCreated(data);
      break;
    case 'refund.updated':
      await handleRefundUpdated(data);
      break;
    case 'charge.refund.updated':
      await handleRefundUpdated(data);
      break;
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(data);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(data);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(data);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(data);
      break;
    default:
      logger.info({ type }, 'Unhandled Stripe event type');
  }
}

/**
 * Handle payment_intent.succeeded.
 *
 * If order already exists (created via checkout/confirm), this is a no-op.
 * If order doesn't exist (browser closed, frontend failed), create it now.
 */
async function handlePaymentIntentSucceeded(paymentIntent: any): Promise<void> {
  const paymentIntentId = paymentIntent.id;
  if (!paymentIntentId) return;

  // Check if order already exists for this payment intent
  const existingOrder = await Order.findOne({
    $or: [
      { 'payment.stripePaymentIntentId': paymentIntentId },
      { 'payment.transactionId': paymentIntentId },
    ],
  });

  if (existingOrder) {
    logger.info({ paymentIntentId, orderNumber: existingOrder.orderNumber }, 'Order already exists for payment intent');
    return;
  }

  // Try to create order from PendingOrder
  try {
    const pending = await PendingOrder.findOne({
      stripePaymentIntentId: paymentIntentId,
      status: { $in: ['pending', 'paid'] },
    });

    if (pending && pending.status !== 'converted') {
      await checkoutService.confirmCheckout(String(pending.userId), paymentIntentId);
      logger.info({ paymentIntentId, userId: pending.userId }, 'Order created from webhook (recovery)');
    }
  } catch (err) {
    logger.error({ err, paymentIntentId }, 'Failed to create order from webhook');
  }
}

/**
 * Handle payment_intent.payment_failed.
 */
async function handlePaymentIntentFailed(paymentIntent: any): Promise<void> {
  const paymentIntentId = paymentIntent.id;
  if (!paymentIntentId) return;

  const order = await Order.findOne({ 'payment.stripePaymentIntentId': paymentIntentId });
  if (!order) return;

  if (order.status !== 'pending_payment' && order.status !== 'pending') return;

  order.status = 'cancelled';
  order.payment.status = 'failed';
  order.cancellationReason = paymentIntent.last_payment_error?.message || 'Payment failed';
  await order.save();

  await logPaymentEvent('failed', {
    paymentIntentId,
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    amount: order.payment.amount,
    error: paymentIntent.last_payment_error?.message,
  });

  logger.info({ paymentIntentId, orderNumber: order.orderNumber }, 'Order cancelled due to payment failure');
}

/**
 * Handle invoice.payment_succeeded for memberships (renewal + proration).
 */
async function handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
  if (!invoice?.subscription) return;

  // Try tag-based Subscription first (existing behavior)
  const subscription = await Subscription.findOne({ stripeSubscriptionId: invoice.subscription });

  if (!subscription) {
    // Try membership-tier subscription (UserMembership model)
    try {
      const membership = await UserMembership.findOne({ stripeSubscriptionId: invoice.subscription });

      if (membership && membership.status === 'pending_payment') {
        // Initial membership activation
        await activateMembership(membership._id.toString());
        logger.info({ membershipId: membership._id, stripeSubscriptionId: invoice.subscription }, 'Membership activated via webhook (invoice.payment_succeeded)');
      } else if (membership && membership.status === 'active') {
        // Invoice on an already-active membership.
        // This handles BOTH proration invoices (tier change) AND renewal invoices.
        await handleMembershipInvoice(membership, invoice);
      }
    } catch (err) {
      logger.error({ err, stripeSubscriptionId: invoice.subscription }, 'Failed to process membership invoice from webhook');
    }
    return;
  }

  // Idempotency: skip if we already created an invoice for this Stripe invoice
  if (invoice.id) {
    const existingInvoice = await Invoice.findOne({ stripeInvoiceId: invoice.id });
    if (existingInvoice) {
      logger.info({ stripeInvoiceId: invoice.id }, 'Invoice already processed — skipping');
      return;
    }
  }

  // Update subscription state
  subscription.status = 'active';
  subscription.lastPaymentDate = new Date();
  subscription.lastPaymentAmount = (invoice.amount_paid || 0) / 100;
  subscription.currentPeriodStart = new Date((invoice.period_start || Date.now() / 1000) * 1000);
  subscription.currentPeriodEnd = new Date((invoice.period_end || Date.now() / 1000) * 1000);
  subscription.paymentRetryCount = 0;
  subscription.nextPaymentAttemptAt = undefined;
  await subscription.save();

  // Update tag status
  if (subscription.tagId) {
    await Tag.findByIdAndUpdate(subscription.tagId, { subscriptionStatus: 'active' });
  }

  // Create PawTag Invoice for reconciliation
  const count = await Invoice.countDocuments();
  await Invoice.create({
    subscriptionId: subscription._id,
    userId: subscription.userId,
    invoiceNumber: `INV-${String(count + 1).padStart(6, '0')}`,
    amount: (invoice.amount_paid || 0) / 100,
    currency: (invoice.currency || 'nzd').toUpperCase(),
    status: 'paid',
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: invoice.payment_intent,
    billingPeriod: {
      start: new Date((invoice.period_start || Date.now() / 1000) * 1000),
      end: new Date((invoice.period_end || Date.now() / 1000) * 1000),
    },
    paidAt: new Date(),
  });

  // Send renewal confirmation email (fire-and-forget)
  try {
    const user = await User.findById(subscription.userId).select('email fullName').lean();
    if (user?.email) {
      const amountPaid = (invoice.amount_paid || 0) / 100;
      const billingStart = new Date((invoice.period_start || Date.now() / 1000) * 1000);
      const billingEnd = new Date((invoice.period_end || Date.now() / 1000) * 1000);
      await sendSubscriptionRenewalEmail(
        user.email,
        user.fullName || 'Customer',
        (subscription.tagId as any)?.tagId || 'N/A',
        subscription.planName,
        amountPaid,
        billingStart,
        billingEnd,
      );
      logger.info({ subscriptionId: subscription._id, email: user.email }, 'Renewal confirmation email sent');
    }
  } catch (emailErr) {
    logger.error({ err: emailErr, subscriptionId: subscription._id }, 'Failed to send renewal confirmation email');
  }

  logger.info({ subscriptionId: subscription._id, stripeInvoiceId: invoice.id }, 'Subscription renewed via Stripe');
}

/**
 * Handle a membership invoice — both proration (tier change) and renewal.
 *
 * For proration invoices (billing_reason: 'subscription_update'):
 *   Creates the INVM- invoice and sends email.
 *   changeTier may have already done this — stripeInvoiceId idempotency prevents duplicates.
 *
 * For renewal invoices (billing_reason: 'subscription_cycle'):
 *   Creates the INVM- invoice, extends currentPeriodStart/End by 1 year,
 *   resets dunning state, and sends renewal confirmation.
 *   This is critical: without period advancement, checkExpiredMemberships
 *   would expire the membership even though Stripe charged successfully.
 */
async function handleMembershipInvoice(membership: any, stripeInvoice: any): Promise<void> {
  if (!stripeInvoice?.id) return;

  // Idempotency: skip if invoice already exists for this Stripe invoice
  const existingInvoice = await Invoice.findOne({ stripeInvoiceId: stripeInvoice.id });
  if (existingInvoice) {
    logger.info({ membershipId: membership._id, stripeInvoiceId: stripeInvoice.id }, 'Membership invoice already recorded — skipping');
    return;
  }

  const amountPaid = (stripeInvoice.amount_paid || 0) / 100;
  const billingReason = stripeInvoice.billing_reason || 'subscription_update';
  const isRenewal = billingReason === 'subscription_cycle';

  // For renewal invoices, we must advance the period even if amountPaid is 0
  // (e.g. full credit applied). For proration, only create invoice if positive.
  if (!isRenewal && amountPaid <= 0) return;

  const currency = (stripeInvoice.currency || 'nzd').toUpperCase();

  // Determine billing period from Stripe invoice
  const stripePeriodStart = stripeInvoice.period_start ? new Date(stripeInvoice.period_start * 1000) : membership.currentPeriodStart || new Date();
  const stripePeriodEnd = stripeInvoice.period_end ? new Date(stripeInvoice.period_end * 1000) : undefined;

  // Generate invoice number using the same atomic counter as activateMembership
  const counter = await UserMembership.db!.collection('counters').findOneAndUpdate(
    { _id: 'membershipInvoiceNumber' as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  const invoiceNumber = `INVM-${String((counter as any)?.value?.seq || 1).padStart(6, '0')}`;

  const pawtagInvoice = await Invoice.create({
    userId: membership.userId,
    userMembershipId: membership._id,
    invoiceNumber,
    amount: amountPaid,
    currency,
    status: 'paid',
    stripeInvoiceId: stripeInvoice.id,
    stripeSubscriptionId: membership.stripeSubscriptionId,
    billingPeriod: {
      start: isRenewal ? stripePeriodStart : (membership.currentPeriodStart || stripePeriodStart),
      end: isRenewal ? (stripePeriodEnd || membership.currentPeriodEnd) : (membership.currentPeriodEnd || stripePeriodEnd),
    },
    paidAt: new Date(),
  });

  logger.info({
    membershipId: membership._id,
    invoiceId: pawtagInvoice._id,
    invoiceNumber,
    amountPaid,
    billingReason,
    isRenewal,
    stripeInvoiceId: stripeInvoice.id,
  }, `Membership ${isRenewal ? 'renewal' : 'proration'} invoice created via webhook`);

  // For renewal invoices: advance the membership period and reset dunning state
  if (isRenewal && stripePeriodEnd) {
    const previousPeriodEnd = membership.currentPeriodEnd;
    membership.currentPeriodStart = stripePeriodStart;
    membership.currentPeriodEnd = stripePeriodEnd;
    membership.dunningStatus = 'active';
    membership.dunningRetryCount = 0;
    membership.dunningLastAttemptAt = undefined;
    await membership.save();

    logger.info({
      membershipId: membership._id,
      previousPeriodEnd,
      newPeriodEnd: stripePeriodEnd,
    }, 'Membership renewal period advanced via webhook');

    // Send renewal confirmation email (distinct from proration invoice email)
    try {
      const { User } = await import('@pawtag/db');
      const user = await User.findById(membership.userId).select('email fullName').lean();
      if (user?.email) {
        const { renderMembershipRenewalReminderEmail } = await import('../services/email/templates/membership-renewal-reminder');
        const tier = await MembershipTier.findById(membership.tierId).lean();
        const html = renderMembershipRenewalReminderEmail({
          customerName: user.fullName || 'there',
          tierName: tier?.displayName || 'Membership',
          renewalDate: stripePeriodEnd.toLocaleDateString('en-NZ', { dateStyle: 'full' }),
          price: membership.price,
          dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
        });
        const { sendMail } = await import('../services/email.service');
        await sendMail(user.email, `Your ${tier?.name || 'Membership'} Has Been Renewed`, html)
          .catch((err: any) => logger.error({ err, membershipId: membership._id }, 'Failed to send renewal confirmation email'));
      }
    } catch (err) {
      logger.error({ err, membershipId: membership._id }, 'Failed to send renewal confirmation email');
    }
  }

  // Send invoice email for all membership invoices (fire-and-forget with logged errors)
  if (amountPaid > 0) {
    try {
      const { generateInvoiceHtml } = await import('../services/invoice-html.service');
      const { sendInvoiceEmail } = await import('../services/email.service');
      const { generateSecureToken, hashToken } = await import('../services/auth.service');
      const { InvoiceAccessToken, User } = await import('@pawtag/db');

      const user = await User.findById(membership.userId).select('email fullName').lean();
      if (user?.email) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const secureToken = generateSecureToken();
        const tokenHash = hashToken(secureToken);
        await InvoiceAccessToken.create({
          invoiceId: pawtagInvoice._id,
          userId: membership.userId,
          tokenHash,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          verifiedAt: new Date(),
        });
        const invoiceUrl = `${frontendUrl}/account/invoices/${invoiceNumber}?token=${secureToken}`;

        const invoiceHtml = await generateInvoiceHtml(pawtagInvoice._id.toString());
        await sendInvoiceEmail(user.email, user.fullName, invoiceNumber, invoiceHtml, invoiceUrl, amountPaid)
          .catch((err: any) => logger.error({ err, invoiceId: pawtagInvoice._id }, 'Failed to send membership invoice email'));
      }
    } catch (err) {
      logger.error({ err, membershipId: membership._id }, 'Failed to send membership invoice email');
    }
  }
}

/**
 * Handle invoice.payment_failed (dunning).
 */
async function handleInvoicePaymentFailed(invoice: any): Promise<void> {
  if (!invoice?.subscription) return;

  // Try tag-based Subscription first (existing behavior)
  const subscription = await Subscription.findOne({ stripeSubscriptionId: invoice.subscription });

  if (!subscription) {
    // Try membership-tier subscription (UserMembership model)
    try {
      const membership = await UserMembership.findOne({ stripeSubscriptionId: invoice.subscription });
      if (membership && membership.status === 'active') {
        await handleMembershipPaymentFailure(membership, invoice);
      }
    } catch (err) {
      logger.error({ err, stripeSubscriptionId: invoice.subscription }, 'Failed to process membership payment failure from webhook');
    }
    return;
  }

  // Idempotency: skip if we already created a failed invoice for this Stripe invoice
  if (invoice.id) {
    const existingInvoice = await Invoice.findOne({ stripeInvoiceId: invoice.id });
    if (existingInvoice) {
      logger.info({ stripeInvoiceId: invoice.id }, 'Failed invoice already processed — skipping');
      return;
    }
  }

  // Create a failed invoice record
  const count = await Invoice.countDocuments();
  await Invoice.create({
    subscriptionId: subscription._id,
    userId: subscription.userId,
    invoiceNumber: `INV-${String(count + 1).padStart(6, '0')}`,
    amount: (invoice.amount_due || 0) / 100,
    currency: (invoice.currency || 'nzd').toUpperCase(),
    status: 'failed',
    stripeInvoiceId: invoice.id,
    billingPeriod: {
      start: new Date((invoice.period_start || Date.now() / 1000) * 1000),
      end: new Date((invoice.period_end || Date.now() / 1000) * 1000),
    },
  });

  // Trigger dunning flow via subscription service
  try {
    const { handlePaymentFailure } = await import('../services/subscription.service');
    await handlePaymentFailure(subscription._id.toString());
  } catch (err) {
    logger.error({ err, subscriptionId: subscription._id }, 'Failed to trigger dunning from webhook');
  }

  // Also send notification
  const user = await User.findById(subscription.userId);
  if (user) {
    await Notification.create({
      userId: user._id,
      audience: 'customer',
      type: 'subscription_expiring',
      title: 'Payment Failed',
      message: `Your subscription payment of $${(invoice.amount_due / 100).toFixed(2)} failed.`,
      data: { subscriptionId: subscription._id.toString() },
      priority: 'high',
      channel: 'alert',
    });
  }

  logger.info({ subscriptionId: subscription._id, stripeInvoiceId: invoice.id }, 'Subscription payment failed — dunning initiated');
}

/**
 * Handle membership payment failure (renewal charge failed).
 *
 * Records the failure, updates dunning state, notifies the customer,
 * and alerts the CSR. The membership is NOT expired here — Stripe will
 * retry automatically. Expiry happens only after the grace period ends.
 */
async function handleMembershipPaymentFailure(membership: any, stripeInvoice: any): Promise<void> {
  if (!stripeInvoice?.id) return;

  // Idempotency: skip if we already recorded this failure
  if (stripeInvoice.id) {
    const existingInvoice = await Invoice.findOne({ stripeInvoiceId: stripeInvoice.id });
    if (existingInvoice) {
      logger.info({ membershipId: membership._id, stripeInvoiceId: stripeInvoice.id }, 'Membership payment failure already recorded — skipping');
      return;
    }
  }

  const amountDue = (stripeInvoice.amount_due || 0) / 100;
  const currency = (stripeInvoice.currency || 'nzd').toUpperCase();

  // Record failed invoice
  const counter = await UserMembership.db!.collection('counters').findOneAndUpdate(
    { _id: 'membershipInvoiceNumber' as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  const invoiceNumber = `INVM-${String((counter as any)?.value?.seq || 1).padStart(6, '0')}`;

  await Invoice.create({
    userId: membership.userId,
    userMembershipId: membership._id,
    invoiceNumber,
    amount: amountDue,
    currency,
    status: 'failed',
    stripeInvoiceId: stripeInvoice.id,
    stripeSubscriptionId: membership.stripeSubscriptionId,
    billingPeriod: {
      start: membership.currentPeriodStart || new Date(),
      end: membership.currentPeriodEnd || new Date(),
    },
  });

  // Update dunning state
  membership.dunningStatus = 'past_due';
  membership.dunningRetryCount = (membership.dunningRetryCount || 0) + 1;
  membership.dunningLastAttemptAt = new Date();
  await membership.save();

  logger.warn({
    membershipId: membership._id,
    stripeInvoiceId: stripeInvoice.id,
    amountDue,
    retryCount: membership.dunningRetryCount,
  }, 'Membership renewal payment failed');

  // Notify customer
  try {
    const user = await User.findById(membership.userId).select('email fullName').lean();
    if (user?.email) {
      const tier = await MembershipTier.findById(membership.tierId).lean();
      const { sendMail } = await import('../services/email.service');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      const html = `
        <p>Hi ${user.fullName || 'there'},</p>
        <p>We couldn't renew your <strong>${tier?.displayName || 'Membership'}</strong> membership.
        The payment of $${amountDue.toFixed(2)} failed.</p>
        <p>Please update your payment method to keep your membership active.
        Your benefits will remain active until ${membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'the end of your billing period'}.</p>
        <p><a href="${frontendUrl}/account/membership">Update Payment Method</a></p>
      `;
      await sendMail(user.email, `Action Required: Update Your ${tier?.name || 'Membership'} Payment Method`, html)
        .catch((err: any) => logger.error({ err, membershipId: membership._id }, 'Failed to send payment failure email'));
    }
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, 'Failed to send membership payment failure notification');
  }

  // In-app notification for customer
  try {
    await Notification.create({
      userId: membership.userId,
      audience: 'customer',
      type: 'membership_payment_failed',
      title: 'Payment Failed — Action Required',
      message: `We couldn't renew your membership. Please update your payment method. Benefits remain active until ${membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'medium' }) || 'period end'}.`,
      data: { membershipId: membership._id.toString() },
      priority: 'high',
      channel: 'alert',
    });
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, 'Failed to create membership payment failure notification');
  }

  // Alert CSR/admin
  try {
    const adminAlertEmail = process.env.ADMIN_ALERT_EMAIL;
    if (adminAlertEmail) {
      const { sendMail } = await import('../services/email.service');
      const user = await User.findById(membership.userId).select('email fullName').lean();
      const tier = await MembershipTier.findById(membership.tierId).lean();
      const html = `
        <p><strong>Membership Payment Failure Alert</strong></p>
        <p>Customer: ${user?.fullName || 'Unknown'} (${user?.email || 'Unknown'})</p>
        <p>Tier: ${tier?.displayName || 'Unknown'}</p>
        <p>Amount: $${amountDue.toFixed(2)} ${currency}</p>
        <p>Retry count: ${membership.dunningRetryCount}</p>
        <p>Benefits until: ${membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A'}</p>
      `;
      await sendMail(adminAlertEmail, `Membership Payment Failure: ${user?.email || membership.userId}`, html)
        .catch((err: any) => logger.error({ err, membershipId: membership._id }, 'Failed to send CSR alert email'));
    }
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, 'Failed to send CSR alert for membership payment failure');
  }
}

/**
 * Handle customer.subscription.updated.
 * Delegates cancel_at_period_end + status sync to billing-cancel-sync service.
 */
async function handleSubscriptionUpdated(stripeSubscription: any): Promise<void> {
  if (!stripeSubscription?.id) return;

  const snapshot = {
    id: String(stripeSubscription.id),
    status: String(stripeSubscription.status || ''),
    cancel_at_period_end: Boolean(stripeSubscription.cancel_at_period_end),
  };

  try {
    const tagResult = await syncTagSubscriptionFromStripeSubscriptionUpdated(snapshot);
    if (tagResult.handled) return;

    await syncMembershipFromStripeSubscriptionUpdated(snapshot);
  } catch (err) {
    logger.error(
      { err, stripeSubscriptionId: snapshot.id },
      'Failed to process customer.subscription.updated webhook',
    );
  }
}

/**
 * Handle customer.subscription.deleted.
 *
 * Handles BOTH tag-based Subscriptions AND membership (UserMembership) records.
 * This is critical: when a customer cancels via Stripe Billing Portal, or when
 * a cancel_at_period_end subscription reaches its end, Stripe fires this event.
 * PawTag must sync its local state accordingly.
 */
async function handleSubscriptionDeleted(subscription: any): Promise<void> {
  // Try tag-based Subscription first (existing behavior)
  const sub = await Subscription.findOne({ stripeSubscriptionId: subscription.id });

  if (!sub) {
    // Try membership-tier subscription (UserMembership model)
    try {
      const membership = await UserMembership.findOne({ stripeSubscriptionId: subscription.id });
      if (membership && (membership.status === 'active' || membership.status === 'cancelled')) {
        // Only update if not already expired
        if (membership.status === 'active') {
          membership.status = 'cancelled';
          membership.cancelledAt = membership.cancelledAt || new Date();
          membership.cancellationReason = membership.cancellationReason || 'Cancelled via Stripe';
          membership.autoRenew = false;
          await membership.save();

          logger.info({ membershipId: membership._id }, 'Membership cancelled via Stripe (customer.subscription.deleted)');

          // Audit
          try {
            const { auditService } = await import('../services/audit');
            await auditService.log({
              actorType: 'SYSTEM',
              actorId: 'stripe-webhook',
              actorUsername: 'stripe-webhook',
              sourceIp: 'stripe',
              userAgent: 'stripe-webhook',
              applicationName: 'pawtag-api',
              applicationVersion: '1.0.0',
              apiVersion: 'v1',
              environment: process.env.NODE_ENV || 'development',
            }, {
              action: 'membership_cancelled_via_stripe',
              eventType: 'membership.cancelled',
              eventCategory: 'FINANCIAL',
              operationType: 'UPDATE',
              resourceType: 'UserMembership',
              resourceId: membership._id.toString(),
              subjectUserId: membership.userId?.toString(),
              outcome: 'SUCCESS',
              severity: 'HIGH',
              metadata: {
                userId: membership.userId?.toString(),
                cancellationReason: 'Cancelled via Stripe',
                cancelledAt: membership.cancelledAt,
              },
            });
          } catch (err) {
            logger.error({ err, membershipId: membership._id }, 'Failed to audit membership cancellation from webhook');
          }
        }
      }
    } catch (err) {
      logger.error({ err, stripeSubscriptionId: subscription.id }, 'Failed to process membership deletion from webhook');
    }
    return;
  }

  sub.status = 'cancelled';
  sub.autoRenew = false;
  sub.cancelledAt = new Date();
  sub.cancellationReason = 'Cancelled via Stripe';
  sub.cancelledBy = 'System (Stripe)';
  sub.cancelledByType = 'System';
  sub.cancelledByPortal = 'system';
  sub.cancelledByDescription = `${sub.planName} is Cancelled via System (Stripe) by System (Stripe)`;
  await sub.save();

  // Send cancellation email
  try {
    const user = await User.findById(sub.userId).select('fullName email').lean();
    if (user?.email) {
      const { sendMail } = await import('../services/email.service');
      const { renderCancellationEmail } = await import('../services/email/templates/cancellation');
      const html = renderCancellationEmail({
        name: user.fullName || 'there',
        planName: sub.planName || 'Subscription',
        cancelledAt: new Date().toLocaleDateString('en-NZ', { dateStyle: 'full' }),
        currentPeriodEnd: sub.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'current period',
      });
      await sendMail(user.email, `Your ${sub.planName} subscription has been cancelled`, html).catch(() => {});
    }
  } catch (err) {
    logger.error({ err }, 'Failed to send cancellation email from webhook');
  }

  // Log audit event
  try {
    const { auditService } = await import('../services/audit');
    await auditService.log({
      actorType: 'SYSTEM',
      actorId: 'stripe-webhook',
      actorUsername: 'stripe-webhook',
      sourceIp: 'stripe',
      userAgent: 'stripe-webhook',
      applicationName: 'pawtag-api',
      applicationVersion: '1.0.0',
      apiVersion: 'v1',
      environment: process.env.NODE_ENV || 'development',
    }, {
      action: 'subscription_cancelled',
      eventType: 'subscription_cancellation',
      eventCategory: 'FINANCIAL',
      operationType: 'UPDATE',
      resourceType: 'Subscription',
      resourceId: sub._id.toString(),
      outcome: 'SUCCESS',
      severity: 'HIGH',
      metadata: {
        userId: sub.userId?.toString(),
        planType: sub.planType,
        planName: sub.planName,
        cancellationReason: 'Cancelled via Stripe',
        cancelledAt: sub.cancelledAt,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to audit subscription cancellation from webhook');
  }

  logger.info({ subscriptionId: sub._id }, 'Subscription cancelled via Stripe');
}

/**
 * Handle refund.created.
 *
 * Triggered when a refund is first initiated (status: 'pending').
 * Updates Order and PaymentTransaction with refund ID.
 */
async function handleRefundCreated(refund: any): Promise<void> {
  if (!refund?.id) return;

  const paymentIntentId = refund.payment_intent;
  if (!paymentIntentId) return;

  const order = await Order.findOne({
    $or: [
      { 'payment.stripePaymentIntentId': paymentIntentId },
      { 'payment.transactionId': paymentIntentId },
    ],
  });
  if (!order) {
    logger.warn({ refundId: refund.id, paymentIntentId }, 'Refund webhook: order not found');
    return;
  }

  order.refundId = refund.id;
  order.refundStatus = 'pending';
  order.refundLastSyncedAt = new Date();
  if (refund.arn) {
    order.refundArn = refund.arn;
  }
  if (refund.arrival_date) {
    order.refundExpectedArrival = new Date(refund.arrival_date * 1000);
  }
  await order.save();

  // Update PaymentTransaction
  await PaymentTransaction.findOneAndUpdate(
    { providerTransactionId: refund.id, type: 'refund' },
    {
      providerStatus: refund.status || 'pending',
      lastSyncedAt: new Date(),
      ...(refund.arn ? { arn: refund.arn } : {}),
      ...(refund.arrival_date ? { expectedArrival: new Date(refund.arrival_date * 1000) } : {}),
    },
  );

  logger.info({
    refundId: refund.id,
    orderNumber: order.orderNumber,
    status: refund.status,
  }, 'Refund created webhook processed');
}

/**
 * Handle refund.updated (and charge.refund.updated).
 *
 * Triggered when a refund status changes:
 * - 'succeeded' — funds returned to customer (final state)
 * - 'failed' — refund could not be processed
 * - 'pending' — still being processed
 * - 'canceled' — refund was canceled
 */
async function handleRefundUpdated(refund: any): Promise<void> {
  if (!refund?.id) return;

  const paymentIntentId = refund.payment_intent;
  if (!paymentIntentId) return;

  const order = await Order.findOne({
    $or: [
      { 'payment.stripePaymentIntentId': paymentIntentId },
      { 'payment.transactionId': paymentIntentId },
    ],
  });
  if (!order) {
    logger.warn({ refundId: refund.id, paymentIntentId }, 'Refund updated webhook: order not found');
    return;
  }

  const newStatus = refund.status as 'pending' | 'succeeded' | 'failed' | 'canceled';
  const previousStatus = order.refundStatus;
  const refundArn = refund.arn as string | undefined;
  const expectedArrival = refund.arrival_date
    ? new Date(refund.arrival_date * 1000)
    : undefined;

  // Update order
  order.refundId = refund.id;
  order.refundStatus = newStatus;
  order.refundLastSyncedAt = new Date();
  if (refundArn) {
    order.refundArn = refundArn;
  }
  if (expectedArrival) {
    order.refundExpectedArrival = expectedArrival;
  }
  if (newStatus === 'succeeded') {
    order.refundSettledAt = new Date();
  }
  if (newStatus === 'failed') {
    order.refundFailureReason = refund.failure_reason || 'Unknown failure';
  }
  await order.save();

  // Update PaymentTransaction
  await PaymentTransaction.findOneAndUpdate(
    { providerTransactionId: refund.id, type: 'refund' },
    {
      providerStatus: newStatus,
      lastSyncedAt: new Date(),
      refundedAt: newStatus === 'succeeded' ? new Date() : undefined,
      failureReason: newStatus === 'failed' ? refund.failure_reason : undefined,
      ...(refundArn ? { arn: refundArn } : {}),
      ...(expectedArrival ? { expectedArrival } : {}),
    },
  );

  const arnLabel = refundArn ? ` ARN: ${refundArn}` : newStatus === 'succeeded' ? ' (ARN pending)' : '';
  const failureLabel = newStatus === 'failed' ? ` (${refund.failure_reason || 'unknown failure'})` : '';

  // Record activity log
  await Order.updateOne(
    { _id: order._id },
    {
      $push: {
        activity: {
          type: `refund_${newStatus}`,
          message: `Refund ${newStatus}: ${refund.id}${arnLabel}${failureLabel}`,
          timestamp: new Date(),
          actor: 'webhook',
          metadata: {
            refundId: refund.id,
            previousStatus,
            newStatus,
            amount: (refund.amount || 0) / 100,
            failureReason: refund.failure_reason,
            arn: refundArn,
            expectedArrival: expectedArrival?.toISOString(),
          },
        },
      },
    },
  );

  logger.info({
    refundId: refund.id,
    orderNumber: order.orderNumber,
    previousStatus,
    newStatus,
  }, 'Refund updated webhook processed');

  // Trigger customer + admin notifications
  try {
    const { notifyRefundUpdate } = await import('../services/orderNotification.service');
    await notifyRefundUpdate(order, refund, newStatus);
  } catch (err) {
    logger.error({ err, refundId: refund.id }, 'Failed to send refund update notification');
  }

  // Schedule auto-retry for failed refunds
  if (newStatus === 'failed') {
    try {
      const { onRefundFailed } = await import('../commerce/services/refund-retry.service');
      await onRefundFailed(String(order._id), refund.id);
    } catch (err) {
      logger.error({ err, refundId: refund.id }, 'Failed to schedule refund retry');
    }
  }
}

/**
 * Handle charge.refunded.
 *
 * Triggered when a charge is fully refunded. Sets refundSettledAt.
 */
async function handleChargeRefunded(charge: any): Promise<void> {
  if (!charge?.payment_intent) return;

  const order = await Order.findOne({
    $or: [
      { 'payment.stripePaymentIntentId': charge.payment_intent },
      { 'payment.transactionId': charge.payment_intent },
    ],
  });
  if (!order) return;

  // Set final settlement
  order.refundStatus = 'succeeded';
  order.refundSettledAt = new Date();
  order.refundLastSyncedAt = new Date();
  await order.save();

  logger.info({
    chargeId: charge.id,
    orderNumber: order.orderNumber,
    amountRefunded: (charge.amount_refunded || 0) / 100,
  }, 'Charge fully refunded');
}

export {
  handleEvent as handleStripeWebhookEvent,
  handleSubscriptionUpdated as handleStripeSubscriptionUpdated,
  handleSubscriptionDeleted as handleStripeSubscriptionDeleted,
};

export default router;

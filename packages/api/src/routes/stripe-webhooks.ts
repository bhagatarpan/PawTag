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
import { Order, Invoice, InvoiceAccessToken, Subscription, Tag, User, Notification, WebhookEvent, PendingOrder, PaymentTransaction } from '@pawtag/db';
import { stripePaymentProvider } from '../commerce/providers/stripe';
import { checkoutService } from '../commerce/services/checkout.service';
import { logPaymentEvent, logOrderEvent } from '../commerce/audit';
import { logCommerceEvent } from '../commerce/audit';
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

  // ─── Demo mode ────────────────────────────────────────────
  // Demo mode is ONLY allowed in development/test. In production, the startup
  // validation should have already rejected missing/demo Stripe configuration.
  // This guard is a safety net in case startup validation is bypassed.
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_demo_key') {
    if (process.env.NODE_ENV === 'production') {
      logger.error('Stripe webhook received in production with demo configuration — this should never happen');
      res.status(500).json({ success: false, error: 'Payment system misconfigured' });
      return;
    }
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    logger.info({ eventType: event.type }, 'Received demo Stripe webhook');

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

    // Mark as failed for retry
    const bodyAny = req.body as any;
    if (bodyAny?.id) {
      await WebhookEvent.findOneAndUpdate(
        { source: 'stripe', eventId: bodyAny.id },
        {
          status: 'failed',
          lastError: err.message,
          $inc: { attempts: 1 },
          nextRetryAt: new Date(Date.now() + 60_000), // Retry in 60s
        },
      ).catch(() => {});
    }

    res.status(400).json({ error: err.message });
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
 * Handle invoice.payment_succeeded (subscription renewal).
 */
async function handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
  if (!invoice?.subscription) return;

  const subscription = await Subscription.findOne({ stripeSubscriptionId: invoice.subscription });
  if (!subscription) return;

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

  logger.info({ subscriptionId: subscription._id, stripeInvoiceId: invoice.id }, 'Subscription renewed via Stripe');
}

/**
 * Handle invoice.payment_failed (dunning).
 */
async function handleInvoicePaymentFailed(invoice: any): Promise<void> {
  if (!invoice?.subscription) return;

  const subscription = await Subscription.findOne({ stripeSubscriptionId: invoice.subscription });
  if (!subscription) return;

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
 * Handle customer.subscription.updated.
 * Sync Stripe subscription status changes to PawTag.
 */
async function handleSubscriptionUpdated(stripeSubscription: any): Promise<void> {
  if (!stripeSubscription?.id) return;

  const sub = await Subscription.findOne({ stripeSubscriptionId: stripeSubscription.id });
  if (!sub) return;

  const oldStatus = sub.status;

  // Map Stripe status to PawTag status
  const statusMap: Record<string, string> = {
    active: 'active',
    past_due: 'active', // Keep active but dunning handles retry
    trialing: 'active',
    canceled: 'cancelled',
    unpaid: 'grace_period',
    incomplete_expired: 'expired',
  };

  const newStatus = statusMap[stripeSubscription.status] || sub.status;
  if (newStatus !== oldStatus) {
    sub.status = newStatus as any;

    if (newStatus === 'cancelled') {
      sub.autoRenew = false;
      sub.cancelledAt = new Date();
      sub.cancellationReason = 'Updated via Stripe';
      sub.cancelledBy = 'System (Stripe)';
      sub.cancelledByType = 'System';
      sub.cancelledByPortal = 'system';
    }

    await sub.save();

    logger.info({
      subscriptionId: sub._id,
      oldStatus,
      newStatus,
      stripeStatus: stripeSubscription.status,
    }, 'Subscription status synced from Stripe');
  }
}

/**
 * Handle customer.subscription.deleted.
 */
async function handleSubscriptionDeleted(subscription: any): Promise<void> {
  const sub = await Subscription.findOne({ stripeSubscriptionId: subscription.id });
  if (!sub) return;

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
  await order.save();

  // Update PaymentTransaction
  await PaymentTransaction.findOneAndUpdate(
    { providerTransactionId: refund.id, type: 'refund' },
    {
      providerStatus: refund.status || 'pending',
      lastSyncedAt: new Date(),
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

  // Update order
  order.refundId = refund.id;
  order.refundStatus = newStatus;
  order.refundLastSyncedAt = new Date();
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
    },
  );

  // Record activity log
  await Order.updateOne(
    { _id: order._id },
    {
      $push: {
        activity: {
          type: `refund_${newStatus}`,
          message: `Refund ${newStatus}: ${refund.id}${newStatus === 'succeeded' ? ` (ARN pending)` : newStatus === 'failed' ? ` (${refund.failure_reason || 'unknown failure'})` : ''}`,
          timestamp: new Date(),
          actor: 'webhook',
          metadata: {
            refundId: refund.id,
            previousStatus,
            newStatus,
            amount: (refund.amount || 0) / 100,
            failureReason: refund.failure_reason,
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

export { handleEvent as handleStripeWebhookEvent };

export default router;

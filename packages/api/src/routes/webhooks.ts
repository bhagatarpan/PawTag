import { Router, Request, Response } from 'express';
import { Subscription, Invoice, Tag } from '@pawtag/db';

const router = Router();

router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];

  // Demo mode — accept test events
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_demo_key') {
    const event = req.body;
    console.log(`[Webhook] Received demo event: ${event.type || 'unknown'}`);

    if (event.type === 'invoice.payment_succeeded') {
      await handleInvoicePaymentSucceeded(event.data?.object);
    } else if (event.type === 'invoice.payment_failed') {
      await handleInvoicePaymentFailed(event.data?.object);
    } else if (event.type === 'customer.subscription.deleted') {
      await handleSubscriptionDeleted(event.data?.object);
    }

    res.json({ received: true });
    return;
  }

  // Real Stripe verification would go here
  // For now, process the event directly
  try {
    const event = req.body;

    switch (event.type) {
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data?.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data?.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data?.object);
        break;
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('[Webhook] Error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

async function handleInvoicePaymentSucceeded(invoice: any) {
  if (!invoice?.subscription) return;

  const subscription = await Subscription.findOne({
    stripeSubscriptionId: invoice.subscription,
  });

  if (!subscription) {
    console.log('[Webhook] Subscription not found for stripe ID:', invoice.subscription);
    return;
  }

  subscription.status = 'active';
  subscription.lastPaymentDate = new Date();
  subscription.lastPaymentAmount = invoice.amount_paid / 100;
  subscription.currentPeriodStart = new Date(invoice.period_start * 1000);
  subscription.currentPeriodEnd = new Date(invoice.period_end * 1000);
  subscription.reminderStates = {
    reminder30dSent: false,
    reminder7dSent: false,
    reminder1dSent: false,
    graceWeeklySentCount: 0,
  };

  await subscription.save();

  await Tag.findByIdAndUpdate(subscription.tagId, { subscriptionStatus: 'active' });

  // Create invoice record
  const count = await Invoice.countDocuments();
  await Invoice.create({
    subscriptionId: subscription._id,
    userId: subscription.userId,
    invoiceNumber: `INV-${String(count + 1).padStart(6, '0')}`,
    amount: invoice.amount_paid / 100,
    currency: invoice.currency?.toUpperCase() || 'NZD',
    status: 'paid',
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: invoice.payment_intent,
    billingPeriod: {
      start: new Date(invoice.period_start * 1000),
      end: new Date(invoice.period_end * 1000),
    },
    paidAt: new Date(),
    dueDate: new Date(invoice.period_end * 1000),
  });

  console.log(`[Webhook] Invoice paid for subscription ${subscription._id}`);
}

async function handleInvoicePaymentFailed(invoice: any) {
  if (!invoice?.subscription) return;

  const subscription = await Subscription.findOne({
    stripeSubscriptionId: invoice.subscription,
  });

  if (!subscription) return;

  const count = await Invoice.countDocuments();
  await Invoice.create({
    subscriptionId: subscription._id,
    userId: subscription.userId,
    invoiceNumber: `INV-${String(count + 1).padStart(6, '0')}`,
    amount: invoice.amount_due / 100,
    currency: invoice.currency?.toUpperCase() || 'NZD',
    status: 'failed',
    stripeInvoiceId: invoice.id,
    billingPeriod: {
      start: new Date(invoice.period_start * 1000),
      end: new Date(invoice.period_end * 1000),
    },
    dueDate: new Date(),
  });

  console.log(`[Webhook] Invoice payment failed for subscription ${subscription._id}`);
}

async function handleSubscriptionDeleted(subscription: any) {
  const sub = await Subscription.findOne({
    stripeSubscriptionId: subscription.id,
  });

  if (!sub) return;

  sub.status = 'cancelled';
  sub.cancelledAt = new Date();
  sub.cancellationReason = 'Cancelled via Stripe';
  await sub.save();

  console.log(`[Webhook] Subscription ${sub._id} cancelled via Stripe`);
}

export default router;

import { Router, Request, Response } from 'express';
import { Subscription, Invoice, Tag, Order, User, Product, Cart, Notification } from '@pawtag/db';

const router = Router();

router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];

  // Demo mode — accept test events
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_demo_key') {
    const event = req.body;
    console.log(`[Webhook] Received demo event: ${event.type || 'unknown'}`);

    if (event.type === 'payment_intent.succeeded') {
      await handlePaymentIntentSucceeded(event.data?.object);
    } else if (event.type === 'payment_intent.payment_failed') {
      await handlePaymentIntentFailed(event.data?.object);
    } else if (event.type === 'invoice.payment_succeeded') {
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
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data?.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data?.object);
        break;
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

async function handlePaymentIntentSucceeded(paymentIntent: any) {
  const orderNumber = paymentIntent.metadata?.orderNumber;
  if (!orderNumber) {
    console.log('[Webhook] No orderNumber in payment_intent metadata');
    return;
  }

  const order = await Order.findOne({ orderNumber });
  if (!order) {
    console.log('[Webhook] Order not found:', orderNumber);
    return;
  }

  // Only update if still in pending_payment status
  if (order.status !== 'pending_payment') {
    console.log(`[Webhook] Order ${orderNumber} already in status: ${order.status}`);
    return;
  }

  // Mark order as paid
  order.status = 'paid';
  order.payment.status = 'completed';
  order.payment.paidAt = new Date();
  await order.save();

  console.log(`[Webhook] Order ${orderNumber} marked as paid`);

  // Get user info for emails
  const user = await User.findById(order.userId);

  // Create subscriptions for tag products
  try {
    const { createSubscription } = await import('../services/subscription.service');
    const { sendSubscriptionWelcomeEmail } = await import('../services/email.service');

    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (product && product.isSubscription && product.subscriptionConfig) {
        const userTags = await Tag.find({ ownerId: order.userId, deletedAt: null });

        for (const tag of userTags) {
          if (tag.subscriptionStatus === 'none' || !tag.subscriptionId) {
            const subscription = await createSubscription({
              userId: order.userId.toString(),
              tagId: tag._id.toString(),
              orderId: order._id.toString(),
              planType: product.subscriptionConfig.type || 'annual',
              planId: product._id.toString(),
              price: product.price,
            });

            sendSubscriptionWelcomeEmail(
              user?.email || '',
              user?.fullName || 'Customer',
              tag.tagId,
              subscription.planName,
              subscription.freePeriodEndsAt || new Date(),
            ).catch((err: any) => console.error('Subscription email error:', err));

            break;
          }
        }
      }
    }
  } catch (subError) {
    console.error('Subscription creation error:', subError);
  }

  // Process referral rewards
  if (order.referredByCode) {
    try {
      const { createReferralOnOrder, completeReferralRewards } = await import('../services/referral.service');
      await createReferralOnOrder(order.referredByCode, order.userId.toString(), order.referredByCode, order._id.toString());
      await completeReferralRewards(order._id.toString());
    } catch (refError) {
      console.error('Referral processing error:', refError);
    }
  }

  // Admin notification (idempotent — skip if already notified for this PaymentIntent)
  try {
    const existingAdminNotif = await Notification.findOne({
      audience: 'admin',
      'data.paymentIntentId': paymentIntent.id,
    });
    if (!existingAdminNotif) {
      const adminNotif = await Notification.create({
        userId: order.userId,
        audience: 'admin',
        type: 'new_order',
        title: 'New order received',
        message: `Order ${orderNumber} — $${order.payment.amount.toFixed(2)} NZD`,
        data: {
          orderId: order._id.toString(),
          orderNumber,
          amount: order.payment.amount,
          paymentIntentId: paymentIntent.id,
          customerName: user?.fullName || 'Unknown',
          customerEmail: user?.email || 'Unknown',
        },
        priority: 'high',
        channel: 'alert',
      });

      // Send admin email
      const adminEmail = process.env.ADMIN_ALERT_EMAIL;
      if (adminEmail) {
        try {
          const { sendMail } = await import('../services/email.service');
          await sendMail(
            adminEmail,
            `New PawTag order: ${orderNumber}`,
            `<h2>New Order Received</h2>
             <p><strong>Order:</strong> ${orderNumber}</p>
             <p><strong>Customer:</strong> ${user?.fullName || 'Unknown'} (${user?.email || 'Unknown'})</p>
             <p><strong>Amount:</strong> $${order.payment.amount.toFixed(2)} NZD</p>
             <p><strong>Payment ID:</strong> ${paymentIntent.id}</p>`,
          );
        } catch (emailErr) {
          console.error('Admin notification email error:', emailErr);
        }
      }
      console.log(`[Webhook] Admin notification created for order ${orderNumber}`);
    } else {
      console.log(`[Webhook] Admin notification already exists for PaymentIntent ${paymentIntent.id}`);
    }
  } catch (adminError) {
    console.error('Admin notification error:', adminError);
  }

  // Send order confirmation email
  try {
    const { sendOrderConfirmation } = await import('../services/email.service');
    await sendOrderConfirmation({
      to: user?.email || '',
      customerName: user?.fullName || 'Customer',
      orderNumber,
      items: order.items.map((item: any) => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        variantName: item.variantName,
        petName: item.petName,
      })),
      subtotal: order.payment.amount,
      total: order.payment.amount,
      shippingAddress: {
        line1: order.shippingAddress.line1,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        zip: order.shippingAddress.zip,
      },
    });
    console.log(`[Webhook] Confirmation email sent for order ${orderNumber}`);
  } catch (emailError) {
    console.error('Email send error:', emailError);
  }
}

async function handlePaymentIntentFailed(paymentIntent: any) {
  const orderNumber = paymentIntent.metadata?.orderNumber;
  if (!orderNumber) return;

  const order = await Order.findOne({ orderNumber });
  if (!order) return;

  // Only update if still in pending_payment status
  if (order.status !== 'pending_payment') return;

  // Mark order as cancelled
  order.status = 'cancelled';
  order.payment.status = 'failed';
  await order.save();

  console.log(`[Webhook] Order ${orderNumber} cancelled due to payment failure`);

  // Restore stock
  for (const item of order.items) {
    const product = await Product.findById(item.productId);
    if (product) {
      if (item.variantName && product.variants?.length) {
        const variant = product.variants.find((v: any) => v.name === item.variantName);
        if (variant) variant.stock += item.quantity;
      } else {
        product.stock += item.quantity;
      }
      await product.save();
    }
  }

  console.log(`[Webhook] Stock restored for order ${orderNumber}`);
}

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

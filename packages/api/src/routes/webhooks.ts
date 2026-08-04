import { Router, Request, Response } from 'express';
import { Subscription, Invoice, InvoiceAccessToken, Tag, Order, User, Product, Cart, Notification, AuditLog } from '@pawtag/db';
import { notifyCustomerOfStatusChange } from '../services/orderNotification.service';
import { sendOrderConfirmation, sendInvoiceEmail, sendMail } from '../services/email.service';
import { generateInvoiceHtml } from '../services/invoice-html.service';
import { generateSecureToken, hashToken } from '../services/auth.service';

function generateTagId(): string {
  const digits = Math.floor(100000 + Math.random() * 900000).toString();
  return `PT-${digits}`;
}

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

  // Auto-create tags for tag products
  try {
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (product && product.isTagProduct) {
        for (let i = 0; i < item.quantity; i++) {
          const tagId = generateTagId();
          await Tag.create({
            tagId,
            tagType: 'qr',
            orderId: order._id,
            status: 'inactive',
            subscriptionStatus: 'none',
          });
          console.log(`[Webhook] Auto-created tag ${tagId} for order ${orderNumber}`);
        }
      }
    }
  } catch (tagError) {
    console.error('Tag auto-creation error:', tagError);
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

  // Send customer order confirmation + invoice email (centralized notification)
  try {
    // 1. Send Order Confirmation email
    const customerName = user?.fullName || 'Customer';
    const customerEmail = user?.email;
    if (customerEmail) {
      await sendOrderConfirmation({
        to: customerEmail,
        customerName,
        orderNumber: order.orderNumber,
        items: order.items.map((item: any) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          variantName: item.variantName,
          petName: item.petName,
        })),
        subtotal: order.payment.amount - (order.discount?.amount || 0),
        discount: order.discount,
        total: order.payment.amount,
        shippingAddress: order.shippingAddress || { line1: '', city: '', state: '', zip: '' },
      });
      console.log(`[Webhook] Order confirmation email sent for ${orderNumber}`);
    }

    // 2. Create Invoice record for ALL paid orders
    const invoiceCount = await Invoice.countDocuments();
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(6, '0')}`;

    // Find the subscription ID if this order has subscription products
    let subscriptionId: any = undefined;
    let billingPeriod: { start: Date; end: Date } | undefined = undefined;
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (product?.isSubscription && product.subscriptionConfig) {
        const sub = await Subscription.findOne({ userId: order.userId, orderId: order._id });
        if (sub) {
          subscriptionId = sub._id;
          if (sub.currentPeriodStart && sub.currentPeriodEnd) {
            billingPeriod = { start: sub.currentPeriodStart, end: sub.currentPeriodEnd };
          }
          break;
        }
      }
    }

    const invoice = await Invoice.create({
      ...(subscriptionId ? { subscriptionId } : {}),
      orderId: order._id,
      userId: order.userId,
      invoiceNumber,
      amount: order.payment.amount,
      currency: order.payment.currency || 'NZD',
      status: 'paid',
      paymentMethod: order.payment.method,
      paidAt: order.payment.paidAt || new Date(),
      ...(billingPeriod ? { billingPeriod } : {}),
    });
    console.log(`[Webhook] Invoice ${invoiceNumber} created for order ${orderNumber}`);

    // 3. Generate secure access token for invoice (pre-verified, no OTP)
    const secureToken = generateSecureToken();
    const tokenHash = hashToken(secureToken);

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    await InvoiceAccessToken.create({
      invoiceId: invoice._id,
      userId: order.userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours for email links
      verifiedAt: new Date(), // Pre-verified — no OTP needed
    });

    const invoiceUrl = `${FRONTEND_URL}/invoice/${secureToken}?admin=1`;

    // 4. Send Invoice email
    if (customerEmail) {
      const invoiceHtml = await generateInvoiceHtml(invoice._id.toString());
      await sendInvoiceEmail(customerEmail, customerName, invoiceNumber, invoiceHtml, invoiceUrl, invoice.amount);
      console.log(`[Webhook] Invoice email sent for ${orderNumber}`);
    }

    // 5. Log Notification records (customer in-app history)
    await Notification.create({
      userId: order.userId,
      audience: 'customer',
      type: 'order_update',
      title: 'Order confirmed',
      message: `Your order ${orderNumber} has been confirmed. Invoice ${invoiceNumber} is ready.`,
      data: {
        orderId: order._id.toString(),
        orderNumber,
        invoiceId: invoice._id.toString(),
        invoiceNumber,
        status: 'paid',
        invoiceUrl,
      },
      priority: 'normal',
      channel: 'info',
    });

    // 6. Audit log both email sends
    const clientInfo = { ipAddress: 'system', userAgent: 'webhook' };
    await AuditLog.create({
      userId: order.userId,
      action: 'order_confirmation_sent',
      entity: 'Order',
      entityId: order._id.toString(),
      changes: { orderNumber, emailSentTo: customerEmail },
      ...clientInfo,
    });
    await AuditLog.create({
      userId: order.userId,
      action: 'invoice_sent',
      entity: 'Invoice',
      entityId: invoice._id.toString(),
      changes: { invoiceNumber, emailSentTo: customerEmail, invoiceUrl },
      ...clientInfo,
    });

    console.log(`[Webhook] Customer notifications and audit logs created for order ${orderNumber}`);
  } catch (notifError) {
    console.error('Customer notification error:', notifError);
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
  order.cancellationReason = 'Payment failed';
  await order.save();

  console.log(`[Webhook] Order ${orderNumber} cancelled due to payment failure`);

  // Notify customer
  try {
    await notifyCustomerOfStatusChange(order, 'cancelled', { reason: 'Payment failed' });
    console.log(`[Webhook] Customer notified of payment failure for order ${orderNumber}`);
  } catch (notifError) {
    console.error('Customer notification error:', notifError);
  }

  // Restore stock
  try {
    const { restoreOrderStock } = await import('../services/inventory.service');
    await restoreOrderStock(order.items);
    console.log(`[Webhook] Stock restored for order ${orderNumber}`);
  } catch (err) {
    console.error('Stock restoration error:', err);
  }
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

  // Look up user to send dunning notification
  const user = await User.findById(subscription.userId);
  if (user) {
    const customerName = user.fullName || 'there';
    const amount = (invoice.amount_due / 100).toFixed(2);

    // In-app notification
    await Notification.create({
      userId: user._id,
      audience: 'customer',
      type: 'subscription_expiring',
      title: 'Payment Failed',
      message: `Your subscription payment of $${amount} failed. Please update your payment method to avoid service interruption.`,
      data: { subscriptionId: subscription._id.toString(), invoiceNumber: `INV-${String(count + 1).padStart(6, '0')}` },
      priority: 'high',
      channel: 'alert',
    });

    // Dunning email
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#dc2626;">⚠️ Payment Failed</h2>
        <p>Hi ${customerName},</p>
        <p>We were unable to process your subscription payment of <strong>$${amount}</strong>.</p>
        <p>To avoid service interruption, please update your payment method by visiting your account dashboard.</p>
        <p style="margin-top:24px;">
          <a href="${process.env.APP_URL || 'http://localhost:3002'}/subscriptions" style="display:inline-block;background:#14b8a6;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Update Payment Method</a>
        </p>
        <p style="color:#6b7280;font-size:13px;margin-top:24px;">If you believe this is an error, please contact our support team.</p>
      </div>`;

    try {
      await sendMail(user.email, '[PawTag] Action Required — Subscription Payment Failed', html);
    } catch (err) {
      console.error('Dunning email error:', err);
    }

    // Admin notification
    const adminUser = await User.findOne({ role: 'admin' }).select('_id').lean();
    if (adminUser) {
      await Notification.create({
        userId: adminUser._id,
        audience: 'admin',
        type: 'system',
        title: 'Subscription Payment Failed',
        message: `${user.fullName || user.email}'s subscription payment of $${amount} failed.`,
        data: { subscriptionId: subscription._id.toString(), userId: user._id.toString() },
        priority: 'normal',
        channel: 'alert',
      });
    }
  }

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

import { Subscription, Tag, Invoice, User, Notification, Product } from '@pawtag/db';
import { sendMail } from './email.service';

const GRACE_PERIOD_WEEKS = 4;
const FREE_PERIOD_MONTHS = 12;
const REMINDER_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function startSubscriptionService() {
  setInterval(async () => {
    try {
      await runSubscriptionChecks();
    } catch (error) {
      console.error('[SubscriptionService] Error:', error);
    }
  }, REMINDER_CHECK_INTERVAL_MS);

  console.log('[SubscriptionService] Started — checks every hour for subscription lifecycle events');
}

export async function createSubscription(data: {
  userId: string;
  tagId: string;
  orderId?: string;
  planType?: 'annual' | 'monthly' | 'free';
  planId?: string;
  price?: number;
}) {
  const now = new Date();
  const planType = data.planType || 'annual';
  const price = data.price ?? (planType === 'annual' ? 0.99 : planType === 'monthly' ? 1.99 : 0);

  const planNames: Record<string, string> = {
    annual: 'PawTag Annual',
    monthly: 'PawTag Monthly',
    free: 'PawTag Free',
  };

  const freePeriodEndsAt = new Date(now);
  freePeriodEndsAt.setMonth(freePeriodEndsAt.getMonth() + FREE_PERIOD_MONTHS);

  const currentPeriodEnd = new Date(freePeriodEndsAt);

  const subscription = await Subscription.create({
    userId: data.userId,
    tagId: data.tagId,
    orderId: data.orderId,
    planId: data.planId,
    planName: planNames[planType],
    planType,
    status: 'active',
    price,
    currency: 'NZD',
    startDate: now,
    freePeriodEndsAt,
    currentPeriodStart: now,
    currentPeriodEnd,
    autoRenew: true,
    renewalMethod: planType === 'monthly' ? 'monthly' : 'annual',
    totalScans: 0,
    reminderStates: {
      reminder30dSent: false,
      reminder7dSent: false,
      reminder1dSent: false,
      graceWeeklySentCount: 0,
    },
  });

  await Tag.findByIdAndUpdate(data.tagId, {
    subscriptionStatus: 'active',
    subscriptionId: subscription._id,
    activatedAt: now,
  });

  return subscription;
}

export async function renewSubscription(subscriptionId: string, paymentMethod?: string) {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw new Error('Subscription not found');

  const now = new Date();
  const newPeriodEnd = new Date(subscription.currentPeriodEnd);

  if (subscription.renewalMethod === 'annual') {
    newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
  } else {
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
  }

  const wasInGrace = subscription.status === 'grace_period';
  const wasExpired = subscription.status === 'expired';

  subscription.status = 'active';
  subscription.currentPeriodStart = subscription.currentPeriodEnd;
  subscription.currentPeriodEnd = newPeriodEnd;
  subscription.lastPaymentDate = now;
  subscription.lastPaymentAmount = subscription.price;
  subscription.nextPaymentDate = newPeriodEnd;
  subscription.autoRenew = true;
  subscription.reminderStates = {
    reminder30dSent: false,
    reminder7dSent: false,
    reminder1dSent: false,
    graceWeeklySentCount: 0,
  };

  if (wasInGrace || wasExpired) {
    subscription.gracePeriodEndsAt = undefined;
  }

  await subscription.save();

  await Tag.findByIdAndUpdate(subscription.tagId, {
    subscriptionStatus: 'active',
  });

  // Create invoice
  await createInvoice({
    subscriptionId: subscription._id.toString(),
    userId: subscription.userId.toString(),
    amount: subscription.price,
    billingPeriodStart: subscription.currentPeriodStart,
    billingPeriodEnd: newPeriodEnd,
    status: 'paid',
    paymentMethod,
  });

  return subscription;
}

export async function cancelSubscription(subscriptionId: string, reason?: string) {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw new Error('Subscription not found');

  // Cancellation: continues until end of billing period
  subscription.autoRenew = false;
  subscription.cancelledAt = new Date();
  subscription.cancellationReason = reason;

  await subscription.save();
  return subscription;
}

export async function processAutoRenewals() {
  const now = new Date();
  const subsToRenew = await Subscription.find({
    status: 'active',
    autoRenew: true,
    currentPeriodEnd: { $lte: now },
    deletedAt: null,
  });

  for (const sub of subsToRenew) {
    try {
      if (sub.currentPeriodEnd > now) continue;

      const newPeriodEnd = new Date(sub.currentPeriodEnd);
      if (sub.renewalMethod === 'annual') {
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
      } else {
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
      }

      sub.currentPeriodStart = sub.currentPeriodEnd;
      sub.currentPeriodEnd = newPeriodEnd;
      sub.lastPaymentDate = now;
      sub.lastPaymentAmount = sub.price;
      sub.nextPaymentDate = newPeriodEnd;
      sub.reminderStates = {
        reminder30dSent: false,
        reminder7dSent: false,
        reminder1dSent: false,
        graceWeeklySentCount: 0,
      };

      await sub.save();

      await createInvoice({
        subscriptionId: sub._id.toString(),
        userId: sub.userId.toString(),
        amount: sub.price,
        billingPeriodStart: sub.currentPeriodStart,
        billingPeriodEnd: newPeriodEnd,
        status: 'paid',
      });

      console.log(`[SubscriptionService] Auto-renewed subscription ${sub._id}`);
    } catch (error) {
      console.error(`[SubscriptionService] Failed to auto-renew ${sub._id}:`, error);
    }
  }
}

export async function checkExpiringSubscriptions() {
  const now = new Date();

  // 30 days before free period or billing period ends
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in1Day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

  // Find active subscriptions expiring within 30 days
  const expiringSubs = await Subscription.find({
    status: 'active',
    currentPeriodEnd: { $lte: in30Days, $gt: now },
    deletedAt: null,
  }).populate('userId', 'fullName email').populate('tagId', 'tagId');

  for (const sub of expiringSubs) {
    const user = sub.userId as any;
    const tag = sub.tagId as any;
    if (!user) continue;

    const daysUntilExpiry = Math.ceil(
      (sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const reminderStates = sub.reminderStates || { graceWeeklySentCount: 0 };

    if (daysUntilExpiry <= 1 && !reminderStates.reminder1dSent) {
      await sendReminderEmail(user.email, user.fullName, tag?.tagId || 'Unknown', daysUntilExpiry, '1-day');
      reminderStates.reminder1dSent = true;
    } else if (daysUntilExpiry <= 7 && !reminderStates.reminder7dSent) {
      await sendReminderEmail(user.email, user.fullName, tag?.tagId || 'Unknown', daysUntilExpiry, '7-day');
      reminderStates.reminder7dSent = true;
    } else if (daysUntilExpiry <= 30 && !reminderStates.reminder30dSent) {
      await sendReminderEmail(user.email, user.fullName, tag?.tagId || 'Unknown', daysUntilExpiry, '30-day');
      reminderStates.reminder30dSent = true;
    }

    sub.reminderStates = reminderStates;
    await sub.save();
  }
}

export async function checkExpiredSubscriptions() {
  const now = new Date();

  // Active subs whose period has ended → move to grace period
  const expiredSubs = await Subscription.find({
    status: 'active',
    currentPeriodEnd: { $lte: now },
    autoRenew: false,
    deletedAt: null,
  });

  for (const sub of expiredSubs) {
    sub.status = 'grace_period';
    const graceEnd = new Date(now);
    graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_WEEKS * 7);
    sub.gracePeriodEndsAt = graceEnd;
    sub.reminderStates = {
      reminder30dSent: true,
      reminder7dSent: true,
      reminder1dSent: true,
      graceWeeklySentCount: 0,
    };
    await sub.save();

    await Tag.findByIdAndUpdate(sub.tagId, { subscriptionStatus: 'grace_period' });

    console.log(`[SubscriptionService] Subscription ${sub._id} moved to grace period until ${graceEnd}`);
  }
}

export async function checkGracePeriodExpiry() {
  const now = new Date();

  // Grace period expired → inactive
  const graceExpired = await Subscription.find({
    status: 'grace_period',
    gracePeriodEndsAt: { $lte: now },
    deletedAt: null,
  });

  for (const sub of graceExpired) {
    sub.status = 'expired';
    await sub.save();

    await Tag.findByIdAndUpdate(sub.tagId, {
      subscriptionStatus: 'inactive',
    });

    console.log(`[SubscriptionService] Subscription ${sub._id} expired — tag deactivated`);
  }
}

export async function sendGracePeriodReminders() {
  const now = new Date();
  const graceSubs = await Subscription.find({
    status: 'grace_period',
    deletedAt: null,
  }).populate('userId', 'fullName email').populate('tagId', 'tagId');

  for (const sub of graceSubs) {
    const user = sub.userId as any;
    const tag = sub.tagId as any;
    if (!user || !sub.gracePeriodEndsAt) continue;

    const daysLeft = Math.ceil(
      (sub.gracePeriodEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysLeft <= 0) continue;

    const reminderStates = sub.reminderStates || { graceWeeklySentCount: 0 };
    const lastReminder = reminderStates.lastGraceReminderAt;

    // Send weekly reminder
    const shouldSend = !lastReminder ||
      (now.getTime() - new Date(lastReminder).getTime()) >= 7 * 24 * 60 * 60 * 1000;

    if (shouldSend) {
      await sendGraceReminderEmail(user.email, user.fullName, tag?.tagId || 'Unknown', daysLeft);
      reminderStates.graceWeeklySentCount = (reminderStates.graceWeeklySentCount || 0) + 1;
      reminderStates.lastGraceReminderAt = now;
      sub.reminderStates = reminderStates;
      await sub.save();
    }
  }
}

async function createInvoice(data: {
  subscriptionId: string;
  userId: string;
  amount: number;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  paymentMethod?: string;
}) {
  const count = await Invoice.countDocuments();
  const invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`;

  return Invoice.create({
    subscriptionId: data.subscriptionId,
    userId: data.userId,
    invoiceNumber,
    amount: data.amount,
    currency: 'NZD',
    status: data.status,
    billingPeriod: {
      start: data.billingPeriodStart,
      end: data.billingPeriodEnd,
    },
    paymentMethod: data.paymentMethod,
    paidAt: data.status === 'paid' ? new Date() : undefined,
    dueDate: data.billingPeriodEnd,
  });
}

async function runSubscriptionChecks() {
  console.log('[SubscriptionService] Running subscription checks...');

  await checkExpiringSubscriptions();
  await checkExpiredSubscriptions();
  await checkGracePeriodExpiry();
  await sendGracePeriodReminders();
  await processAutoRenewals();

  console.log('[SubscriptionService] Subscription checks complete');
}

async function sendReminderEmail(to: string, name: string, tagId: string, daysLeft: number, type: '30-day' | '7-day' | '1-day') {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const renewUrl = `${frontendUrl}/account/subscriptions`;

  const subjects: Record<string, string> = {
    '30-day': `Your PawTag subscription expires in ${daysLeft} days`,
    '7-day': `Important: Your PawTag subscription expires in ${daysLeft} days`,
    '1-day': `URGENT: Your PawTag subscription expires tomorrow!`,
  };

  const subject = subjects[type] || `PawTag subscription expiring soon`;
  const msg = `Your PawTag subscription for tag ${tagId} will expire in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Renew now to keep your pet protected.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0d9488, #14b8a6); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; font-size: 24px; margin: 0;">PawTag</h1>
      </div>
      <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb;">
        <h2 style="color: #111827; font-size: 20px;">Hi ${name},</h2>
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">${msg}</p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px;">Tag ID</p>
          <p style="color: #111827; font-size: 16px; font-weight: 600; font-family: monospace; margin: 0;">${tagId}</p>
        </div>
        <a href="${renewUrl}" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">Renew Now</a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">If you don't renew, your tag will stop working after the grace period.</p>
      </div>
      <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 11px;">
        PawTag — Reuniting lost pets with their families
      </div>
    </div>`;

  await sendMail(to, subject, html);
}

async function sendGraceReminderEmail(to: string, name: string, tagId: string, daysLeft: number) {
  const renewUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/subscriptions`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #f59e0b, #f97316); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; font-size: 24px; margin: 0;">PawTag</h1>
      </div>
      <div style="background: #fffbeb; padding: 32px; border: 1px solid #fde68a;">
        <h2 style="color: #111827; font-size: 20px;">Hi ${name},</h2>
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">
          Your PawTag subscription for <strong>${tagId}</strong> is in the grace period.
          You have <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong> remaining before your tag becomes inactive.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7;">
          During this time, your tag is still working. Renew now to restore full protection.
        </p>
        <a href="${renewUrl}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">Renew Now</a>
      </div>
      <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 11px;">
        PawTag — Reuniting lost pets with their families
      </div>
    </div>`;

  await sendMail(to, `Grace period: ${daysLeft} days left to renew — PawTag`, html);
}

export async function changeSubscriptionPlan(subscriptionId: string, newPlanType: 'annual' | 'monthly') {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw new Error('Subscription not found');
  if (subscription.status !== 'active') throw new Error('Can only change plan for active subscriptions');

  const prices: Record<string, number> = { annual: 0.99, monthly: 1.99 };
  const planNames: Record<string, string> = { annual: 'PawTag Annual', monthly: 'PawTag Monthly' };

  subscription.planType = newPlanType;
  subscription.planName = planNames[newPlanType];
  subscription.price = prices[newPlanType];
  subscription.renewalMethod = newPlanType;

  await subscription.save();
  return subscription;
}

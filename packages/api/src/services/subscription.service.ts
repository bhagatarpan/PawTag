import { Subscription, Tag, Invoice, User, Notification, Product, TagExpiryNotification, Setting } from '@pawtag/db';
import { sendMail } from './email.service';
import { createAndDeliverNotification } from './notification-delivery.service';
import { auditService, type AuditContext } from './audit';

const GRACE_PERIOD_WEEKS = 4;
const FREE_PERIOD_MONTHS = 12;
const REMINDER_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function auditJobEvent(
  input: Parameters<typeof auditService.log>[1],
  overrides: Partial<AuditContext> = {},
): Promise<void> {
  // Fire and forget
  const logAudit = async () => {
    try {
      await auditService.log({
        actorType: 'SCHEDULED_JOB',
        actorId: 'subscriptionService',
        actorUsername: 'subscription-service-job',
        sourceIp: 'system',
        userAgent: 'scheduled-job',
        applicationName: 'pawtag-api',
        applicationVersion: '1.0.0',
        apiVersion: 'v1',
        environment: process.env.NODE_ENV || 'development',
        ...overrides,
      }, input);
    } catch (err) {
      console.error('[Audit] Failed to log job event:', err);
    }
  };
  logAudit();
}

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

  await auditJobEvent({
    action: 'subscription_created',
    eventType: 'subscription_create',
    eventCategory: 'FINANCIAL',
    operationType: 'CREATE',
    resourceType: 'Subscription',
    resourceId: subscription._id.toString(),
    outcome: 'SUCCESS',
    severity: 'HIGH',
    metadata: {
      userId: data.userId,
      tagId: data.tagId,
      orderId: data.orderId,
      planType,
      planName: planNames[planType],
      price,
      currency: 'NZD',
      freePeriodEndsAt,
      currentPeriodEnd,
      autoRenew: true,
    },
  });

  return subscription;
}

export async function renewSubscription(subscriptionId: string, paymentMethod?: string) {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw new Error('Subscription not found');

  const oldStatus = subscription.status;
  const oldPeriodEnd = subscription.currentPeriodEnd;
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

  await auditJobEvent({
    action: 'subscription_renewed',
    eventType: 'subscription_renewal',
    eventCategory: 'FINANCIAL',
    operationType: 'UPDATE',
    resourceType: 'Subscription',
    resourceId: subscription._id.toString(),
    outcome: 'SUCCESS',
    severity: 'HIGH',
    metadata: {
      userId: subscription.userId.toString(),
      tagId: subscription.tagId?.toString(),
      oldStatus,
      newStatus: 'active',
      wasInGrace,
      wasExpired,
      oldPeriodEnd,
      newPeriodEnd,
      price: subscription.price,
      currency: 'NZD',
      paymentMethod,
      planType: subscription.planType,
      planName: subscription.planName,
    },
  });

  return subscription;
}

export async function cancelSubscription(subscriptionId: string, reason?: string) {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw new Error('Subscription not found');

  const oldStatus = subscription.status;
  const userId = subscription.userId instanceof Object ? subscription.userId.toString() : String(subscription.userId);
  const tagId = subscription.tagId instanceof Object ? subscription.tagId.toString() : String(subscription.tagId);
  subscription.autoRenew = false;
  subscription.cancelledAt = new Date();
  subscription.cancellationReason = reason;

  await subscription.save();

  await auditJobEvent({
    action: 'subscription_cancelled',
    eventType: 'subscription_cancellation',
    eventCategory: 'FINANCIAL',
    operationType: 'UPDATE',
    resourceType: 'Subscription',
    resourceId: subscription._id.toString(),
    outcome: 'SUCCESS',
    severity: 'HIGH',
    metadata: {
      userId,
      tagId,
      oldStatus,
      newStatus: 'cancelled',
      cancellationReason: reason,
      cancelledAt: subscription.cancelledAt,
      planType: subscription.planType,
      planName: subscription.planName,
    },
  });

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

      const oldStatus = sub.status;
      const oldPeriodEnd = sub.currentPeriodEnd;
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

      const invoice = await createInvoice({
        subscriptionId: sub._id.toString(),
        userId: sub.userId.toString(),
        amount: sub.price,
        billingPeriodStart: sub.currentPeriodStart,
        billingPeriodEnd: newPeriodEnd,
        status: 'paid',
      });

      console.log(`[SubscriptionService] Auto-renewed subscription ${sub._id}`);

      await auditJobEvent({
        action: 'subscription_auto_renewal',
        eventType: 'subscription.auto_renewed',
        eventCategory: 'FINANCIAL',
        operationType: 'UPDATE',
        resourceType: 'Subscription',
        resourceId: sub._id.toString(),
        outcome: 'SUCCESS',
        severity: 'HIGH',
        beforeState: {
          status: oldStatus,
          autoRenew: sub.autoRenew,
          currentPeriodEnd: oldPeriodEnd,
        },
        afterState: {
          status: 'active',
          autoRenew: sub.autoRenew,
          currentPeriodEnd: newPeriodEnd,
        },
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
          amount: sub.price,
          currency: 'NZD',
          userId: sub.userId.toString(),
          tagId: sub.tagId?.toString(),
          planType: sub.planType,
          planName: sub.planName,
        },
      });
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

  if (expiringSubs.length > 0) {
    await auditJobEvent({
      action: 'expiring_subscriptions_check',
      eventType: 'scheduled_expiring_check',
      eventCategory: 'SYSTEM',
      operationType: 'READ',
      resourceType: 'Subscription',
      resourceId: 'multiple',
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: {
        checkedCount: expiringSubs.length,
        remindersSent: expiringSubs.filter(s => {
          const days = Math.ceil((s.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return (days <= 1 && !s.reminderStates?.reminder1dSent) ||
                 (days <= 7 && !s.reminderStates?.reminder7dSent) ||
                 (days <= 30 && !s.reminderStates?.reminder30dSent);
        }).length,
      },
    });
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
    const oldStatus = sub.status;
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

  if (expiredSubs.length > 0) {
    await auditJobEvent({
      action: 'subscriptions_expired_to_grace',
      eventType: 'scheduled_expired_to_grace',
      eventCategory: 'FINANCIAL',
      operationType: 'UPDATE',
      resourceType: 'Subscription',
      resourceId: 'multiple',
      outcome: 'SUCCESS',
      severity: 'HIGH',
      metadata: {
        transitionedCount: expiredSubs.length,
        gracePeriodWeeks: GRACE_PERIOD_WEEKS,
        subscriptions: expiredSubs.map(s => ({
          subscriptionId: s._id.toString(),
          userId: s.userId.toString(),
          tagId: s.tagId?.toString(),
          planType: s.planType,
          graceEndsAt: s.gracePeriodEndsAt,
        })),
      },
    });
  }
}

export async function checkGracePeriodExpiry() {
  const now = new Date();

  // Grace period expired → subscription expired, tag shows "Subscription Expired"
  const graceExpired = await Subscription.find({
    status: 'grace_period',
    gracePeriodEndsAt: { $lte: now },
    deletedAt: null,
  });

  for (const sub of graceExpired) {
    const oldStatus = sub.status;
    sub.status = 'expired';
    await sub.save();

    await Tag.findByIdAndUpdate(sub.tagId, {
      subscriptionStatus: 'expired',
    });

    console.log(`[SubscriptionService] Subscription ${sub._id} expired — tag deactivated (Subscription Expired)`);
  }

  if (graceExpired.length > 0) {
    await auditJobEvent({
      action: 'grace_period_expired',
      eventType: 'scheduled_grace_expiry',
      eventCategory: 'FINANCIAL',
      operationType: 'UPDATE',
      resourceType: 'Subscription',
      resourceId: 'multiple',
      outcome: 'SUCCESS',
      severity: 'HIGH',
      metadata: {
        expiredCount: graceExpired.length,
        subscriptions: graceExpired.map(s => ({
          subscriptionId: s._id.toString(),
          userId: s.userId.toString(),
          tagId: s.tagId?.toString(),
          planType: s.planType,
          graceEndedAt: s.gracePeriodEndsAt,
        })),
      },
    });
  }
}

export async function sendGracePeriodReminders() {
  const now = new Date();
  const graceSubs = await Subscription.find({
    status: 'grace_period',
    deletedAt: null,
  }).populate('userId', 'fullName email').populate('tagId', 'tagId');

  let remindersSent = 0;
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
      remindersSent++;
    }
  }

  if (remindersSent > 0) {
    await auditJobEvent({
      action: 'grace_period_reminders_sent',
      eventType: 'scheduled_grace_reminders',
      eventCategory: 'SYSTEM',
      operationType: 'CREATE',
      resourceType: 'Notification',
      resourceId: 'multiple',
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: {
        remindersSent,
        totalGraceSubs: graceSubs.length,
      },
    });
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

async function resetExpiredSkipOtp() {
  const now = new Date();
  const result = await User.updateMany(
    { skipInvoiceOtp: true, skipInvoiceOtpExpiresAt: { $lte: now } },
    { $set: { skipInvoiceOtp: false }, $unset: { skipInvoiceOtpExpiresAt: 1 } },
  );
  if (result.modifiedCount > 0) {
    console.log(`[SubscriptionService] Auto-reset skipInvoiceOtp for ${result.modifiedCount} expired user(s)`);
  }
}

async function checkTagExpiryNotifications() {
  const daysBeforeSetting = await Setting.findOne({ key: 'notifications.tagExpiryDaysBefore' }).lean();
  const daysBefore = daysBeforeSetting ? parseInt(daysBeforeSetting.value, 10) : 30;
  if (isNaN(daysBefore) || daysBefore <= 0) return;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysBefore);

  const expiringSubs = await Subscription.find({
    status: 'active',
    currentPeriodEnd: { $lte: cutoffDate, $gt: new Date() },
  }).populate('tagId', 'tagId').populate('userId', 'fullName email');

  let notifiedCount = 0;
  for (const sub of expiringSubs) {
    const daysUntilExpiry = Math.ceil((new Date(sub.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    // Dedup: check if already notified today
    const existing = await TagExpiryNotification.findOne({
      subscriptionId: sub._id,
      notifiedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    if (existing) continue;

    const tag = sub.tagId as any;
    const user = sub.userId as any;

    await TagExpiryNotification.create({
      subscriptionId: sub._id,
      tagId: tag?._id,
      ownerId: user?._id,
      daysUntilExpiry,
    });

    // Notify admins
    const adminEmailsSetting = await Setting.findOne({ key: 'notifications.tagExpiryAdminEmails' }).lean();
    const adminEmails = adminEmailsSetting?.value
      ? adminEmailsSetting.value.split(',').map(e => e.trim()).filter(Boolean)
      : [];

    const admins = adminEmails.length > 0
      ? await User.find({ email: { $in: adminEmails } }).select('_id email fullName')
      : await User.find({ role: { $in: ['admin', 'super_admin'] } }).select('_id email fullName');

    for (const admin of admins) {
      await createAndDeliverNotification({
        userId: (admin as any)._id.toString(),
        type: 'tag_expiry_warning',
        title: `Tag Subscription Expiring in ${daysUntilExpiry} days`,
        message: `Tag ${(tag as any)?.tagId || 'Unknown'} owned by ${(user as any)?.fullName || 'Customer'} expires in ${daysUntilExpiry} days. Consider reaching out for renewal.`,
        data: { tagId: (tag as any)?.tagId, subscriptionId: sub._id.toString(), daysUntilExpiry },
        priority: daysUntilExpiry <= 7 ? 'high' : 'normal',
        actionUrl: `/subscriptions/${sub._id}`,
        channel: 'alert',
        sendPush: false,
        sendEmail: true,
        emailSubject: `PawTag Admin: Tag Expiring in ${daysUntilExpiry} days`,
      });
    }

    notifiedCount++;
  }

  if (notifiedCount > 0) {
    console.log(`[SubscriptionService] Created ${notifiedCount} tag expiry notification(s)`);
  }
}

async function runSubscriptionChecks() {
  console.log('[SubscriptionService] Running subscription checks...');

  await checkExpiringSubscriptions();
  await checkExpiredSubscriptions();
  await checkGracePeriodExpiry();
  await sendGracePeriodReminders();
  await processAutoRenewals();
  await resetExpiredSkipOtp();
  await checkTagExpiryNotifications();

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

  const oldPlanType = subscription.planType;
  const oldPlanName = subscription.planName;
  const oldPrice = subscription.price;

  subscription.planType = newPlanType;
  subscription.planName = planNames[newPlanType];
  subscription.price = prices[newPlanType];
  subscription.renewalMethod = newPlanType;

  await subscription.save();

  await auditJobEvent({
    action: 'subscription_plan_changed',
    eventType: 'subscription.plan_changed',
    eventCategory: 'UPDATE',
    operationType: 'UPDATE',
    resourceType: 'Subscription',
    resourceId: subscription._id.toString(),
    outcome: 'SUCCESS',
    severity: 'HIGH',
    beforeState: {
      planType: oldPlanType,
      planName: oldPlanName,
      price: oldPrice,
      status: subscription.status,
      autoRenew: subscription.autoRenew,
    },
    afterState: {
      planType: newPlanType,
      planName: planNames[newPlanType],
      price: prices[newPlanType],
      status: subscription.status,
      autoRenew: subscription.autoRenew,
    },
    metadata: {
      userId: subscription.userId?.toString?.(),
      tagId: subscription.tagId?.toString?.(),
      actorSource: 'customer-api',
    },
  }, { actorType: 'SERVICE' });

  return subscription;
}

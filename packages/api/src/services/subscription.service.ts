import { Subscription, Tag, Invoice, User, Notification, Product, TagExpiryNotification, Setting } from '@pawtag/db';
import { sendMail } from './email.service';
import { createAndDeliverNotification } from './notification-delivery.service';
import { renderSubscriptionReminderEmail, renderGracePeriodReminderEmail, renderPaymentFailureEmail, renderGracePeriodStartedEmail, renderGoldWelcomeEmail, renderPaymentRetrySuccessEmail } from './email/templates';
import { auditService, type AuditContext } from './audit';
import { incrementCounter, METRICS } from '../lib/metrics';
import logger from '../lib/logger';

const REMINDER_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Cache for settings to avoid hitting DB on every call
let settingsCache: Record<string, string> = {};
let settingsCacheTimestamp = 0;
const SETTINGS_CACHE_TTL = 60 * 1000; // 1 minute

async function loadSettings(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now - settingsCacheTimestamp < SETTINGS_CACHE_TTL && Object.keys(settingsCache).length > 0) {
    return settingsCache;
  }

  try {
    const settings = await Setting.find({
      key: {
        $in: [
          'commerce.subscriptions.annualPrice',
          'commerce.subscriptions.monthlyPrice',
          'commerce.subscriptions.freePeriodMonths',
          'commerce.subscriptions.gracePeriodWeeks',
          'commerce.subscriptions.autoRenewEnabled',
          'commerce.subscriptions.defaultAutoRenew',
          'commerce.subscriptions.maxRetries',
          'commerce.subscriptions.retryDelaysHours',
        ],
      },
    }).lean();

    settingsCache = {};
    for (const setting of settings) {
      settingsCache[setting.key] = setting.value;
    }
    settingsCacheTimestamp = now;
    return settingsCache;
  } catch (error) {
    logger.error({ err: error }, 'Failed to load subscription settings');
    // Return defaults if DB fails
    return {
      'commerce.subscriptions.annualPrice': '0.99',
      'commerce.subscriptions.monthlyPrice': '1.99',
      'commerce.subscriptions.freePeriodMonths': '12',
      'commerce.subscriptions.gracePeriodWeeks': '4',
      'commerce.subscriptions.autoRenewEnabled': 'true',
      'commerce.subscriptions.defaultAutoRenew': 'true',
      'commerce.subscriptions.maxRetries': '4',
      'commerce.subscriptions.retryDelaysHours': '[0,1,24,72]',
    };
  }
}

async function getSettingValue(key: string, defaultValue: string): Promise<string> {
  const settings = await loadSettings();
  return settings[key] || defaultValue;
}

async function getGracePeriodWeeks(): Promise<number> {
  const value = await getSettingValue('commerce.subscriptions.gracePeriodWeeks', '4');
  return parseInt(value, 10) || 4;
}

async function getFreePeriodMonths(): Promise<number> {
  const value = await getSettingValue('commerce.subscriptions.freePeriodMonths', '12');
  return parseInt(value, 10) || 12;
}

async function getAnnualPrice(): Promise<number> {
  const value = await getSettingValue('commerce.subscriptions.annualPrice', '0.99');
  return parseFloat(value) || 0.99;
}

async function getMonthlyPrice(): Promise<number> {
  const value = await getSettingValue('commerce.subscriptions.monthlyPrice', '1.99');
  return parseFloat(value) || 1.99;
}

async function getAutoRenewEnabled(): Promise<boolean> {
  const value = await getSettingValue('commerce.subscriptions.autoRenewEnabled', 'true');
  return value !== 'false';
}

async function getDefaultAutoRenew(): Promise<boolean> {
  const value = await getSettingValue('commerce.subscriptions.defaultAutoRenew', 'true');
  return value !== 'false';
}

async function getMaxRetries(): Promise<number> {
  const value = await getSettingValue('commerce.subscriptions.maxRetries', '4');
  return parseInt(value, 10) || 4;
}

async function getRetryDelays(): Promise<number[]> {
  const value = await getSettingValue('commerce.subscriptions.retryDelaysHours', '[0,1,24,72]');
  try {
    const hours = JSON.parse(value) as number[];
    return hours.map(h => h * 60 * 60 * 1000);
  } catch {
    return [0, 60 * 60 * 1000, 24 * 60 * 60 * 1000, 72 * 60 * 60 * 1000];
  }
}

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
      logger.error({ err }, '[Audit] Failed to log job event');
    }
  };
  logAudit();
}

export function startSubscriptionService() {
  setInterval(async () => {
    try {
      await runSubscriptionChecks();
      await processPaymentRetries();
    } catch (error) {
      logger.error({ err: error }, '[SubscriptionService] Error');
    }
  }, REMINDER_CHECK_INTERVAL_MS);

  logger.info('[SubscriptionService] Started — checks every hour for subscription lifecycle events and payment retries');
}

export async function createSubscription(data: {
  userId: string;
  tagId?: string;
  orderId?: string;
  planType?: 'annual' | 'monthly' | 'free' | 'gold';
  planId?: string;
  price?: number;
}) {
  const now = new Date();
  const planType = data.planType || 'annual';
  
  // Get prices from CMS settings
  const annualPrice = await getAnnualPrice();
  const monthlyPrice = await getMonthlyPrice();
  const price = data.price ?? (planType === 'annual' ? annualPrice : planType === 'monthly' ? monthlyPrice : 0);

  const planNames: Record<string, string> = {
    annual: 'PawTag Annual',
    monthly: 'PawTag Monthly',
    free: 'PawTag Free',
    gold: 'Gold Membership',
  };

  // Get free period from CMS settings
  const freePeriodMonths = await getFreePeriodMonths();
  const defaultAutoRenew = await getDefaultAutoRenew();
  const freePeriodEndsAt = new Date(now);
  freePeriodEndsAt.setMonth(freePeriodEndsAt.getMonth() + freePeriodMonths);

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
    autoRenew: defaultAutoRenew,
    renewalMethod: planType === 'monthly' ? 'monthly' : 'annual',
    totalScans: 0,
    reminderStates: {
      reminder30dSent: false,
      reminder7dSent: false,
      reminder1dSent: false,
      graceWeeklySentCount: 0,
    },
  });

  if (data.tagId) {
    await Tag.findByIdAndUpdate(data.tagId, {
      subscriptionStatus: 'active',
      subscriptionId: subscription._id,
      activatedAt: now,
    });
  }

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
      autoRenew: defaultAutoRenew,
    },
  });

  incrementCounter(METRICS.SUBSCRIPTION_CREATED_TOTAL, { planType });

  return subscription;
}

/**
 * Create a Gold membership subscription with Stripe billing.
 * Gold is a standalone digital membership — no physical Tag required.
 *
 * @param userId - The user purchasing Gold
 * @param price - The price charged (default: from CMS setting `guardian.goldPrice`)
 * @returns The created subscription document
 */
export async function createGoldSubscription(userId: string, price?: number) {
  const now = new Date();

  // Load Gold price from CMS settings
  const goldPriceSetting = await Setting.findOne({ key: 'guardian.goldPrice' }).lean();
  const goldPrice = price ?? parseFloat(goldPriceSetting?.value || '1.99');

  // Gold billing is monthly
  const currentPeriodEnd = new Date(now);
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

  // Get user info for Stripe customer creation
  const user = await User.findById(userId).select('fullName email stripeCustomerId').lean();
  if (!user) throw new Error('User not found');

  let stripeCustomerId = user.stripeCustomerId;
  let stripeSubscriptionId: string | undefined;
  let stripePaymentIntentId: string | undefined;

  // Determine if we're in demo mode (no real Stripe key)
  const isDemoMode = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_demo_key';

  if (!isDemoMode) {
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2024-06-20' as any,
      });

      // Create Stripe Customer if user doesn't have one
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.fullName || undefined,
          metadata: { userId: userId.toString(), source: 'pawtag-gold' },
        });
        stripeCustomerId = customer.id;

        // Store Stripe Customer ID on User
        await User.findByIdAndUpdate(userId, { stripeCustomerId: customer.id });
        logger.info({ userId, stripeCustomerId: customer.id }, '[Gold] Created Stripe customer');
      }

      // Create a Stripe Price for Gold membership
      const priceObj = await stripe.prices.create({
        unit_amount: Math.round(goldPrice * 100),
        currency: 'nzd',
        recurring: { interval: 'month' },
        product_data: {
          name: 'PawTag Gold Membership',
          metadata: { plan: 'gold' },
        },
        metadata: { userId: userId.toString(), plan: 'gold' },
      });

      // Create Stripe Subscription
      const stripeSubscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: priceObj.id }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        metadata: { userId: userId.toString(), plan: 'gold' },
        expand: ['latest_invoice.payment_intent'],
      });

      stripeSubscriptionId = stripeSubscription.id;

      // Extract PaymentIntent from the expanded latest_invoice
      const latestInvoice = stripeSubscription.latest_invoice as any;
      if (latestInvoice?.payment_intent) {
        stripePaymentIntentId = latestInvoice.payment_intent.id;
      }

      logger.info({
        userId,
        stripeCustomerId,
        stripeSubscriptionId,
        stripePaymentIntentId,
      }, '[Gold] Created Stripe subscription');
    } catch (err) {
      logger.error({ err, userId }, '[Gold] Stripe subscription creation failed — falling back to demo mode');
      // Fall back to demo mode on Stripe failure
      stripeCustomerId = undefined;
      stripeSubscriptionId = undefined;
    }
  }

  // Create PawTag subscription
  const subscription = await Subscription.create({
    userId,
    planName: 'Gold Membership',
    planType: 'gold',
    status: 'active',
    price: goldPrice,
    currency: 'NZD',
    startDate: now,
    currentPeriodStart: now,
    currentPeriodEnd,
    autoRenew: true,
    renewalMethod: 'monthly',
    stripeCustomerId: stripeCustomerId || undefined,
    stripeSubscriptionId: stripeSubscriptionId || undefined,
    totalScans: 0,
    reminderStates: {
      reminder30dSent: false,
      reminder7dSent: false,
      reminder1dSent: false,
      graceWeeklySentCount: 0,
    },
  });

  // Create Invoice in PawTag DB
  await createInvoice({
    subscriptionId: subscription._id.toString(),
    userId: userId,
    amount: goldPrice,
    billingPeriodStart: now,
    billingPeriodEnd: currentPeriodEnd,
    status: stripePaymentIntentId ? 'paid' : 'paid', // In demo mode, auto-mark as paid
    paymentMethod: stripePaymentIntentId ? 'stripe' : 'demo',
  });

  // Send Gold welcome email (fire-and-forget)
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const dashboardUrl = `${frontendUrl}/account/guardian`;
  sendGoldWelcomeEmail(user.email, user.fullName || 'there', goldPrice, dashboardUrl).catch((err) => {
    logger.error({ err, userId }, '[Gold] Failed to send welcome email');
  });

  await auditJobEvent({
    action: 'gold_subscription_created',
    eventType: 'subscription_create',
    eventCategory: 'FINANCIAL',
    operationType: 'CREATE',
    resourceType: 'Subscription',
    resourceId: subscription._id.toString(),
    outcome: 'SUCCESS',
    severity: 'HIGH',
    metadata: {
      userId,
      planType: 'gold',
      planName: 'Gold Membership',
      price: goldPrice,
      currency: 'NZD',
      stripeCustomerId: stripeCustomerId || 'demo',
      stripeSubscriptionId: stripeSubscriptionId || 'demo',
      stripePaymentIntentId: stripePaymentIntentId || 'demo',
      isDemoMode,
    },
  });

  incrementCounter(METRICS.SUBSCRIPTION_CREATED_TOTAL, { planType: 'gold' });

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

  incrementCounter(METRICS.SUBSCRIPTION_RENEWED_TOTAL, { planType: subscription.planType });

  return subscription;
}

export async function cancelSubscription(subscriptionId: string, reason?: string) {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw new Error('Subscription not found');

  // Prevent double-cancel
  if (subscription.cancelledAt) {
    throw new Error('Subscription is already cancelled');
  }

  const oldStatus = subscription.status;
  const userId = subscription.userId instanceof Object ? subscription.userId.toString() : String(subscription.userId);
  const tagId = subscription.tagId instanceof Object ? subscription.tagId.toString() : String(subscription.tagId);

  // Disable auto-renewal and record cancellation
  subscription.autoRenew = false;
  subscription.cancelledAt = new Date();
  subscription.cancellationReason = reason;

  // Cancel Stripe subscription if it exists
  if (subscription.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' as any });
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      logger.info({ subscriptionId: subscription._id, stripeSubscriptionId: subscription.stripeSubscriptionId }, 'Stripe subscription cancelled');
    } catch (stripeErr: any) {
      // Log but don't fail the PawTag cancellation — the local record is still updated
      logger.error({ err: stripeErr, subscriptionId: subscription._id }, 'Failed to cancel Stripe subscription — PawTag cancellation still recorded');
    }
  }

  await subscription.save();

  // Send cancellation confirmation email
  try {
    const user = await User.findById(userId).select('fullName email').lean();
    if (user?.email) {
      const { sendMail } = await import('./email.service');
      const { renderCancellationEmail } = await import('./email/templates/cancellation');
      const html = renderCancellationEmail({
        name: user.fullName || 'there',
        planName: subscription.planName || 'PawTag Subscription',
        cancelledAt: subscription.cancelledAt!.toLocaleDateString('en-NZ', { dateStyle: 'full' }),
        currentPeriodEnd: subscription.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'current billing period',
      });
      await sendMail(user.email, `Your ${subscription.planName || 'PawTag'} subscription has been cancelled`, html).catch(() => {});
    }
  } catch (emailErr) {
    logger.error({ err: emailErr, subscriptionId: subscription._id }, 'Failed to send cancellation email');
  }

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
      cancellationReason: reason,
      cancelledAt: subscription.cancelledAt,
      planType: subscription.planType,
      planName: subscription.planName,
      benefitsUntil: subscription.currentPeriodEnd,
    },
  });

  incrementCounter(METRICS.SUBSCRIPTION_CANCELLED_TOTAL, { planType: subscription.planType });

  return subscription;
}

export async function processAutoRenewals() {
  const autoRenewEnabled = await getAutoRenewEnabled();
  if (!autoRenewEnabled) {
    logger.info('[SubscriptionService] Auto-renew is disabled via CMS setting');
    return;
  }

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

      logger.info({ subscriptionId: sub._id }, '[SubscriptionService] Auto-renewed subscription');

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
      logger.error({ err: error, subscriptionId: sub._id }, '[SubscriptionService] Failed to auto-renew');
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

  // Get grace period from CMS settings
  const gracePeriodWeeks = await getGracePeriodWeeks();

  for (const sub of expiredSubs) {
    const oldStatus = sub.status;
    sub.status = 'grace_period';
    const graceEnd = new Date(now);
    graceEnd.setDate(graceEnd.getDate() + gracePeriodWeeks * 7);
    sub.gracePeriodEndsAt = graceEnd;
    sub.reminderStates = {
      reminder30dSent: true,
      reminder7dSent: true,
      reminder1dSent: true,
      graceWeeklySentCount: 0,
    };
    await sub.save();

    await Tag.findByIdAndUpdate(sub.tagId, { subscriptionStatus: 'grace_period' });

    logger.info({ subscriptionId: sub._id, graceEnd }, '[SubscriptionService] Subscription moved to grace period');
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
        gracePeriodWeeks,
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

    logger.info({ subscriptionId: sub._id }, '[SubscriptionService] Subscription expired — tag deactivated');
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
  status: 'paid' | 'pending' | 'failed' | 'refunded' | 'void' | 'uncollectible';
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
    logger.info({ modifiedCount: result.modifiedCount }, '[SubscriptionService] Auto-reset skipInvoiceOtp for expired users');
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
    logger.info({ notifiedCount }, '[SubscriptionService] Created tag expiry notifications');
  }
}

async function runSubscriptionChecks() {
  logger.info('[SubscriptionService] Running subscription checks');

  await checkExpiringSubscriptions();
  await checkExpiredSubscriptions();
  await checkGracePeriodExpiry();
  await sendGracePeriodReminders();
  await processAutoRenewals();
  await resetExpiredSkipOtp();
  await checkTagExpiryNotifications();

  logger.info('[SubscriptionService] Subscription checks complete');
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
  const html = renderSubscriptionReminderEmail({ name, tagId, daysLeft, type, renewUrl });

  await sendMail(to, subject, html);
}

async function sendGraceReminderEmail(to: string, name: string, tagId: string, daysLeft: number) {
  const renewUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/subscriptions`;
  const html = renderGracePeriodReminderEmail({ name, tagId, daysLeft, renewUrl });

  await sendMail(to, `Grace period: ${daysLeft} days left to renew — PawTag`, html);
}

export async function changeSubscriptionPlan(subscriptionId: string, newPlanType: 'annual' | 'monthly') {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw new Error('Subscription not found');
  if (subscription.status !== 'active') throw new Error('Can only change plan for active subscriptions');

  const annualPrice = await getAnnualPrice();
  const monthlyPrice = await getMonthlyPrice();
  const prices: Record<string, number> = { annual: annualPrice, monthly: monthlyPrice };
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

// Dunning/Retry Logic for Failed Payments
export async function handlePaymentFailure(subscriptionId: string, paymentMethod?: string) {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw new Error('Subscription not found');

  const now = new Date();
  
  // Calculate retry schedule from CMS settings
  const retryDelays = await getRetryDelays();
  const maxRetries = await getMaxRetries();
  const retryCount = (subscription as any).paymentRetryCount || 0;
  
  if (retryCount >= maxRetries) {
    // Max retries exceeded - move to grace period
    await moveSubscriptionToGracePeriod(subscription._id.toString());
    return;
  }

  // Update retry count and schedule
  (subscription as any).paymentRetryCount = retryCount + 1;
  (subscription as any).lastPaymentAttemptAt = now;
  (subscription as any).nextPaymentAttemptAt = new Date(now.getTime() + retryDelays[retryCount + 1]);
  
  await subscription.save();

  // Send payment failure email
  const user = await User.findById(subscription.userId).lean();
  if (user?.email) {
    await sendPaymentFailureEmail(
      user.email,
      user.fullName || 'Customer',
      subscription.tagId?.toString() || 'Unknown',
      retryCount + 1,
      retryDelays.length - retryCount - 1
    );
  }

  await auditJobEvent({
    action: 'subscription_payment_failed',
    eventType: 'subscription.payment_failed',
    eventCategory: 'FINANCIAL',
    operationType: 'UPDATE',
    resourceType: 'Subscription',
    resourceId: subscription._id.toString(),
    outcome: 'SUCCESS',
    severity: 'HIGH',
    metadata: {
      userId: subscription.userId.toString(),
      tagId: subscription.tagId?.toString(),
      retryCount: retryCount + 1,
      maxRetries,
      nextAttemptAt: (subscription as any).nextPaymentAttemptAt,
      paymentMethod,
    },
  }, { actorType: 'SERVICE' });

  incrementCounter(METRICS.SUBSCRIPTION_PAYMENT_FAILED_TOTAL);
}

async function moveSubscriptionToGracePeriod(subscriptionId: string) {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) return;

  const now = new Date();
  const gracePeriodWeeks = await getGracePeriodWeeks();
  const graceEnd = new Date(now);
  graceEnd.setDate(graceEnd.getDate() + gracePeriodWeeks * 7);

  subscription.status = 'grace_period';
  subscription.gracePeriodEndsAt = graceEnd;
  (subscription as any).paymentRetryCount = 0;
  (subscription as any).nextPaymentAttemptAt = undefined;
  
  await subscription.save();

  await Tag.findByIdAndUpdate(subscription.tagId, { subscriptionStatus: 'grace_period' });

  // Send grace period email
  const user = await User.findById(subscription.userId).lean();
  if (user?.email) {
    await sendGracePeriodEmail(
      user.email,
      user.fullName || 'Customer',
      subscription.tagId?.toString() || 'Unknown',
      gracePeriodWeeks
    );
  }

  await auditJobEvent({
    action: 'subscription_moved_to_grace',
    eventType: 'subscription.moved_to_grace',
    eventCategory: 'FINANCIAL',
    operationType: 'UPDATE',
    resourceType: 'Subscription',
    resourceId: subscription._id.toString(),
    outcome: 'SUCCESS',
    severity: 'HIGH',
    metadata: {
      userId: subscription.userId.toString(),
      tagId: subscription.tagId?.toString(),
      gracePeriodWeeks,
      graceEndsAt: graceEnd,
    },
  }, { actorType: 'SERVICE' });
}

async function sendPaymentFailureEmail(to: string, name: string, tagId: string, retryCount: number, retriesLeft: number) {
  const updatePaymentUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/subscriptions`;
  const html = renderPaymentFailureEmail({ name, tagId, retryCount, retriesLeft, updatePaymentUrl });

  await sendMail(to, `Payment failed for your PawTag subscription — Retry ${retryCount}`, html);
}

async function sendGracePeriodEmail(to: string, name: string, tagId: string, gracePeriodWeeks: number) {
  const renewUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/subscriptions`;
  const html = renderGracePeriodStartedEmail({ name, tagId, gracePeriodWeeks, renewUrl });

  await sendMail(to, `Grace period started for your PawTag subscription`, html);
}

export async function processPaymentRetries() {
  const now = new Date();
  const subscriptions = await Subscription.find({
    status: { $in: ['active', 'grace_period'] },
    'paymentRetryCount': { $gt: 0 },
    'nextPaymentAttemptAt': { $lte: now },
    deletedAt: null,
  });

  for (const subscription of subscriptions) {
    try {
      // Attempt to charge the payment method
      // In a real implementation, this would call Stripe to retry the payment
      const success = await attemptPaymentCharge(subscription);
      
      if (success) {
        // Payment succeeded - reset retry state
        (subscription as any).paymentRetryCount = 0;
        (subscription as any).lastPaymentAttemptAt = now;
        (subscription as any).nextPaymentAttemptAt = undefined;
        await subscription.save();
        
        // Create invoice for successful payment
        await createInvoice({
          subscriptionId: subscription._id.toString(),
          userId: subscription.userId.toString(),
          amount: subscription.price,
          billingPeriodStart: subscription.currentPeriodStart,
          billingPeriodEnd: subscription.currentPeriodEnd,
          status: 'paid',
          paymentMethod: 'retry',
        });

        // Send success email
        const user = await User.findById(subscription.userId).lean();
        if (user?.email) {
          await sendPaymentRetrySuccessEmail(
            user.email,
            user.fullName || 'Customer',
            subscription.tagId?.toString() || 'Unknown'
          );
        }

        await auditJobEvent({
          action: 'subscription_payment_retry_success',
          eventType: 'subscription.payment_retry_success',
          eventCategory: 'FINANCIAL',
          operationType: 'UPDATE',
          resourceType: 'Subscription',
          resourceId: subscription._id.toString(),
          outcome: 'SUCCESS',
          severity: 'HIGH',
          metadata: {
            userId: subscription.userId.toString(),
            tagId: subscription.tagId?.toString(),
            retryCount: (subscription as any).paymentRetryCount,
          },
        }, { actorType: 'SERVICE' });

        incrementCounter(METRICS.SUBSCRIPTION_PAYMENT_RETRIED_TOTAL, { outcome: 'success' });
      } else {
        // Payment failed - handle failure
        await handlePaymentFailure(subscription._id.toString(), 'retry');
      }
    } catch (error) {
      logger.error({ err: error, subscriptionId: subscription._id }, 'Error processing payment retry');
    }
  }
}

async function attemptPaymentCharge(subscription: any): Promise<boolean> {
  // In demo mode, simulate 80% success rate for retries
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_demo_key') {
    return Math.random() < 0.8;
  }

  // In production, use Stripe to retry the payment
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' as any });

    if (!subscription.stripeCustomerId) {
      logger.warn({ subscriptionId: subscription._id }, 'No Stripe customer ID for subscription');
      return false;
    }

    // Get the latest invoice for this subscription
    const invoices = await stripe.invoices.list({
      customer: subscription.stripeCustomerId,
      limit: 1,
      status: 'open',
    });

    if (invoices.data.length === 0) {
      logger.warn({ subscriptionId: subscription._id }, 'No open invoice found for subscription');
      return false;
    }

    const invoice = invoices.data[0];

    // Attempt to pay the invoice using the customer's default payment method
    const paidInvoice = await stripe.invoices.pay(invoice.id);

    return paidInvoice.status === 'paid';
  } catch (err) {
    logger.error({ err, subscriptionId: subscription._id }, 'Stripe payment retry failed');
    return false;
  }
}

async function sendGoldWelcomeEmail(to: string, name: string, price: number, dashboardUrl: string) {
  const html = renderGoldWelcomeEmail({ customerName: name, price, dashboardUrl });
  await sendMail(to, 'Welcome to PawTag Gold Membership', html);
}

async function sendPaymentRetrySuccessEmail(to: string, name: string, tagId: string) {
  const html = renderPaymentRetrySuccessEmail({ name, tagId });
  await sendMail(to, `Payment successful for your PawTag subscription`, html);
}

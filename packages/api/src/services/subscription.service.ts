import { Subscription, Tag, Invoice, InvoiceAccessToken, User, Notification, Product, TagExpiryNotification, Setting } from '@pawtag/db';
import { isFakeMode } from '../commerce/payment-mode';
import Stripe from 'stripe';
import { sendMail, sendInvoiceEmail, sendSubscriptionRenewalEmail } from './email.service';
import { createAndDeliverNotification } from './notification-delivery.service';
import { renderSubscriptionReminderEmail, renderGracePeriodReminderEmail, renderPaymentFailureEmail, renderGracePeriodStartedEmail, renderGoldWelcomeEmail, renderPaymentRetrySuccessEmail, renderFreePeriodReminder2WeekEmail, renderFreePeriodReminder3DayEmail, renderGracePeriodReminder3DayEmail, renderTagExpiredEmail } from './email/templates';
import { auditService, type AuditContext } from './audit';
import { incrementCounter, METRICS } from '../lib/metrics';
import logger from '../lib/logger';

const REMINDER_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Lazy-init Stripe client — only create when not in fake mode
let _stripe: Stripe | null = null;
function getStripeClient(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  _stripe = new Stripe(key, { apiVersion: '2026-08-26.dahlia' as any });
  return _stripe;
}

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

let subscriptionTimer: ReturnType<typeof setInterval> | null = null;

export function startSubscriptionService() {
  if (subscriptionTimer) return;
  subscriptionTimer = setInterval(async () => {
    try {
      await runSubscriptionChecks();
      await processPaymentRetries();
    } catch (error) {
      logger.error({ err: error }, '[SubscriptionService] Error');
    }
  }, REMINDER_CHECK_INTERVAL_MS);

  logger.info('[SubscriptionService] Started — checks every hour for subscription lifecycle events and payment retries');
}

export function stopSubscriptionService() {
  if (subscriptionTimer) {
    clearInterval(subscriptionTimer);
    subscriptionTimer = null;
    logger.info('[SubscriptionService] Stopped');
  }
}

/**
 * Run the subscription service job. Called by the job scheduler.
 */
export async function runSubscriptionJob(): Promise<import('./job-scheduler.service').JobResult> {
  try {
    await runSubscriptionChecks();
    await processPaymentRetries();
    return { success: true };
  } catch (error: any) {
    logger.error({ err: error }, '[SubscriptionService] Job error');
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export async function createSubscription(data: {
  userId: string;
  tagId?: string;
  orderId?: string;
  planType?: 'annual' | 'monthly' | 'free' | 'gold';
  planId?: string;
  price?: number;
  autoRenew?: boolean;
}) {
  const now = new Date();
  const planType = data.planType || 'annual';
  
  const planNames: Record<string, string> = {
    annual: 'PawTag Annual',
    monthly: 'PawTag Monthly',
    free: 'PawTag Free',
    gold: 'Gold Membership',
  };

  // Read pricing and config from Product (not CMS settings)
  let price = data.price ?? 0;
  let freePeriodMonths = 3;
  let productName = planNames[planType];

  if (data.planId) {
    const product = await Product.findById(data.planId).lean();
    if (product) {
      // Use annualPrice for annual plans, monthlyPrice for monthly plans
      if (planType === 'annual') {
        price = data.price ?? product.subscriptionConfig?.annualPrice
          ?? (product.subscriptionConfig?.monthlyPrice ?? 0) * 12;
      } else {
        price = data.price ?? product.subscriptionConfig?.monthlyPrice ?? product.price ?? 0;
      }
      freePeriodMonths = product.subscriptionConfig?.freePeriodMonths ?? 3;
      productName = product.name || productName;
    }
  }

  // Use customer's auto-renew preference, falling back to CMS default
  const defaultAutoRenew = data.autoRenew !== undefined ? data.autoRenew : await getDefaultAutoRenew();
  const freePeriodEndsAt = new Date(now);
  freePeriodEndsAt.setMonth(freePeriodEndsAt.getMonth() + freePeriodMonths);

  const currentPeriodEnd = new Date(freePeriodEndsAt);

  const subscription = await Subscription.create({
    userId: data.userId,
    tagId: data.tagId,
    orderId: data.orderId,
    planId: data.planId,
    planName: productName,
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

  // Create Stripe Subscription for auto-renewing products (with trial period)
  if (defaultAutoRenew && price > 0) {
    try {
      if (!isFakeMode()) {
        const user = await User.findById(data.userId).select('stripeCustomerId email fullName').lean();
        if (user?.stripeCustomerId) {
          const stripe = getStripeClient();

          // Look up or create Stripe Price for this product
          let stripePriceId: string | undefined;
          if (data.planId) {
            const priceCacheKey = `${data.planId}.stripePriceId`;
            const cached = (await Setting.findOne({ key: priceCacheKey }).lean())?.value;
            if (cached) {
              try {
                const existingPrice = await stripe.prices.retrieve(cached) as any;
                if (existingPrice.status === 'active' && existingPrice.unit_amount === Math.round(price * 100)) {
                  stripePriceId = cached;
                }
              } catch {
                // Price no longer valid — will create new one
              }
            }

            if (!stripePriceId) {
              const product = await Product.findById(data.planId).lean();
              const stripeProduct = await stripe.products.create({
                name: product?.name || productName,
                metadata: { planId: data.planId, planType },
              });
              const newPrice = await stripe.prices.create({
                product: stripeProduct.id,
                unit_amount: Math.round(price * 100),
                currency: 'nzd',
                recurring: { interval: planType === 'monthly' ? 'month' : 'year' },
                metadata: { planId: data.planId },
              });
              stripePriceId = newPrice.id;
              await Setting.findOneAndUpdate(
                { key: `${data.planId}.stripePriceId` },
                { key: `${data.planId}.stripePriceId`, value: newPrice.id },
                { upsert: true },
              );
            }
          }

          if (stripePriceId) {
            // Create Stripe Subscription with trial period
            const trialEnd = Math.floor(freePeriodEndsAt.getTime() / 1000);
            const stripeSubscription = await stripe.subscriptions.create({
              customer: user.stripeCustomerId,
              items: [{ price: stripePriceId }],
              trial_end: trialEnd,
              payment_behavior: 'default_incomplete',
              payment_settings: { save_default_payment_method: 'on_subscription' },
              metadata: {
                userId: data.userId.toString(),
                subscriptionId: subscription._id.toString(),
                plan: 'tag',
              },
              expand: ['latest_invoice.payment_intent'],
            });

            // Store Stripe IDs on PawTag Subscription
            await Subscription.findByIdAndUpdate(subscription._id, {
              stripeCustomerId: user.stripeCustomerId,
              stripeSubscriptionId: stripeSubscription.id,
            });

            logger.info({
              userId: data.userId,
              stripeSubscriptionId: stripeSubscription.id,
              trialEnd: freePeriodEndsAt,
            }, 'Created Stripe Subscription with trial for tag');
          }
        }
      }
    } catch (err) {
      // Non-blocking — PawTag Subscription is already created
      // Renewal will fall back to processAutoRenewals() safety net
      logger.error({ err, userId: data.userId, subscriptionId: subscription._id }, 'Failed to create Stripe Subscription — falling back to local renewal');
    }
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
export async function createGoldSubscription(userId: string, price?: number, planType?: 'monthly' | 'annual') {
  const now = new Date();

  // Load Gold price from CMS settings
  const goldPriceSetting = await Setting.findOne({ key: 'guardian.goldPrice' }).lean();
  const goldAnnualPriceSetting = await Setting.findOne({ key: 'guardian.goldAnnualPrice' }).lean();
  const goldMonthlyPrice = parseFloat(goldPriceSetting?.value || '3.99');
  const goldAnnualPrice = parseFloat(goldAnnualPriceSetting?.value || '39.99');

  // Determine billing interval and price
  const isAnnual = planType === 'annual';
  const goldPrice = price ?? (isAnnual ? goldAnnualPrice : goldMonthlyPrice);
  const billingInterval = isAnnual ? 'year' : 'month';

  // Set period end based on billing interval
  const currentPeriodEnd = new Date(now);
  if (isAnnual) {
    currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
  } else {
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
  }

  // Get user info for Stripe customer creation
  const user = await User.findById(userId).select('fullName email stripeCustomerId').lean();
  if (!user) throw new Error('User not found');

  let stripeCustomerId = user.stripeCustomerId;
  let stripeSubscriptionId: string | undefined;
  let stripePaymentIntentId: string | undefined;

  // Determine if we're in fake mode (no real Stripe key)
  if (!isFakeMode()) {
    try {
      const stripe = getStripeClient();

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

      // Look up or create a reusable Stripe Price for Gold membership
      let goldStripePriceId = (await Setting.findOne({ key: 'gold.stripePriceId' }).lean())?.value;
      let goldStripeProductId = (await Setting.findOne({ key: 'gold.stripeProductId' }).lean())?.value;

      if (goldStripePriceId) {
        // Verify price still active and matches current amount
        try {
          const existingPrice = await stripe.prices.retrieve(goldStripePriceId) as any;
          if (existingPrice.status !== 'active' || existingPrice.unit_amount !== Math.round(goldPrice * 100)) {
            goldStripePriceId = null as any;
          }
        } catch {
          goldStripePriceId = null as any;
        }
      }

      if (!goldStripePriceId) {
        // Ensure product exists
        if (!goldStripeProductId) {
          const product = await stripe.products.create({
            name: 'PawTag Gold Membership',
            metadata: { plan: 'gold' },
          });
          goldStripeProductId = product.id;
          await Setting.findOneAndUpdate(
            { key: 'gold.stripeProductId' },
            { key: 'gold.stripeProductId', value: product.id },
            { upsert: true },
          );
        }

        // Create price for existing product
        const priceObj = await stripe.prices.create({
          product: goldStripeProductId,
          unit_amount: Math.round(goldPrice * 100),
          currency: 'nzd',
          recurring: { interval: billingInterval },
          metadata: { plan: 'gold' },
        });
        goldStripePriceId = priceObj.id;
        await Setting.findOneAndUpdate(
          { key: 'gold.stripePriceId' },
          { key: 'gold.stripePriceId', value: priceObj.id },
          { upsert: true },
        );
      }

      // Create Stripe Subscription
      const stripeSubscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: goldStripePriceId }],
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
    renewalMethod: isAnnual ? 'annual' : 'monthly',
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
  const invoice = await createInvoice({
    subscriptionId: subscription._id.toString(),
    userId: userId,
    amount: goldPrice,
    billingPeriodStart: now,
    billingPeriodEnd: currentPeriodEnd,
    status: stripePaymentIntentId ? 'paid' : 'pending', // Only mark paid if Stripe confirmed payment
    paymentMethod: stripePaymentIntentId ? 'stripe' : 'pending',
  });

  // Send Gold welcome email (fire-and-forget)
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const dashboardUrl = `${frontendUrl}/account/guardian`;
  sendGoldWelcomeEmail(user.email, user.fullName || 'there', goldPrice, dashboardUrl, planType).catch((err) => {
    logger.error({ err, userId }, '[Gold] Failed to send welcome email');
  });

  // Send invoice email (fire-and-forget)
  if (invoice) {
    const invoiceUrl = `${frontendUrl}/account/subscriptions`;
    sendInvoiceEmail(user.email, user.fullName || 'there', invoice.invoiceNumber, '', invoiceUrl, goldPrice).catch((err) => {
      logger.error({ err, userId }, '[Gold] Failed to send invoice email');
    });
  }

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
      isDemoMode: isFakeMode(),
    },
  });

  incrementCounter(METRICS.SUBSCRIPTION_CREATED_TOTAL, { planType: 'gold' });

  return subscription;
}

export async function renewSubscription(subscriptionId: string, paymentMethod?: string) {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw new Error('Subscription not found');

  // Business rule: expired subscriptions cannot be renewed — must buy new tag
  if ((subscription as any).status === 'expired') {
    throw new Error('This tag has expired. Please purchase a new PawTag.');
  }

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

  // Send renewal confirmation email (fire-and-forget)
  try {
    const user = await User.findById(subscription.userId).select('email fullName').lean();
    if (user?.email) {
      await sendSubscriptionRenewalEmail(
        user.email,
        user.fullName || 'Customer',
        (subscription.tagId as any)?.tagId || 'N/A',
        subscription.planName,
        subscription.price,
        subscription.currentPeriodStart,
        newPeriodEnd,
      );
      logger.info({ subscriptionId: subscription._id, email: user.email }, 'Renewal confirmation email sent');
    }
  } catch (emailErr) {
    logger.error({ err: emailErr, subscriptionId: subscription._id }, 'Failed to send renewal confirmation email');
  }

  return subscription;
}

export interface CancelSubscriptionContext {
  sourceIp?: string;
  userAgent?: string;
  deviceId?: string;
  actorId?: string;
  actorFullName?: string;
  actorRoleName?: string;
  portal?: 'customer-web' | 'customer-mobile' | 'admin-web' | 'system';
}

export async function cancelSubscription(
  subscriptionId: string,
  reason?: string,
  context?: CancelSubscriptionContext,
) {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw new Error('Subscription not found');

  // Prevent double-cancel
  if (subscription.cancelledAt) {
    throw new Error('Subscription is already cancelled');
  }

  const oldStatus = subscription.status;
  const userId = subscription.userId instanceof Object ? subscription.userId.toString() : String(subscription.userId);
  const tagId = subscription.tagId ? subscription.tagId.toString() : null;

  // Set status, disable auto-renewal, and record cancellation
  subscription.status = 'cancelled';
  subscription.autoRenew = false;
  subscription.cancelledAt = new Date();
  subscription.cancellationReason = reason;

  // Populate cancellation metadata when context is provided
  if (context?.actorFullName) {
    const portalLabel = context.portal === 'customer-web' ? 'Customer Web Portal'
      : context.portal === 'customer-mobile' ? 'Customer Mobile App'
      : context.portal === 'admin-web' ? 'Admin Web Portal'
      : context.portal === 'system' ? 'System (Auto)'
      : 'Customer Web Portal';
    const roleDisplay = context.actorRoleName || 'Customer';
    subscription.cancelledBy = roleDisplay.toLowerCase() === 'customer'
      ? `Customer (${context.actorFullName})`
      : `${context.actorFullName} (${roleDisplay})`;
    subscription.cancelledByType = roleDisplay;
    subscription.cancelledByPortal = context.portal || 'customer-web';
    subscription.cancelledByDescription = `${subscription.planName} is Cancelled via ${portalLabel} by ${context.actorFullName} (${roleDisplay})`;
  }

  // Cancel Stripe subscription if it exists
  let stripeCancelSucceeded = false;
  if (subscription.stripeSubscriptionId && !isFakeMode()) {
    try {
      const stripe = getStripeClient();
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      stripeCancelSucceeded = true;
      logger.info({ subscriptionId: subscription._id, stripeSubscriptionId: subscription.stripeSubscriptionId }, 'Stripe subscription cancelled');
    } catch (stripeErr: any) {
      // Stripe cancellation failed — mark for repair/reconciliation
      logger.error({ err: stripeErr, subscriptionId: subscription._id }, 'Failed to cancel Stripe subscription');
    }
  } else if (isFakeMode()) {
    // Fake mode — treat as succeeded
    stripeCancelSucceeded = true;
  }

  // Only mark as cancelled if Stripe succeeded (or no Stripe subscription)
  if (stripeCancelSucceeded || !subscription.stripeSubscriptionId) {
    subscription.status = 'cancelled';
  } else {
    // Stripe failed — mark for repair
    subscription.status = 'cancelled'; // Still mark locally per business rule
    subscription.cancellationReason = `${subscription.cancellationReason || ''} [Stripe cancel pending]`;
    logger.error({ subscriptionId: subscription._id }, 'Subscription cancelled locally but Stripe cancel failed — reconciliation required');
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

  // Log audit event with request context when available
  const auditContext = context?.actorId ? {
    actorType: 'USER' as const,
    actorId: context.actorId,
    actorUsername: context.actorFullName || 'unknown',
    sourceIp: context.sourceIp || 'unknown',
    userAgent: context.userAgent || 'unknown',
    deviceId: context.deviceId,
    applicationName: 'pawtag-api',
    applicationVersion: '1.0.0',
    apiVersion: 'v1',
    environment: process.env.NODE_ENV || 'development',
  } : undefined;

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
      cancelledBy: subscription.cancelledBy,
      cancelledByPortal: subscription.cancelledByPortal,
    },
  }, auditContext);

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
    stripeSubscriptionId: { $exists: false }, // Skip Stripe-managed subs (webhooks handle those)
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

      // Send renewal confirmation email (fire-and-forget)
      try {
        const user = await User.findById(sub.userId).select('email fullName').lean();
        if (user?.email) {
          await sendSubscriptionRenewalEmail(
            user.email,
            user.fullName || 'Customer',
            (sub.tagId as any)?.tagId || 'N/A',
            sub.planName,
            sub.price,
            sub.currentPeriodStart,
            newPeriodEnd,
          );
          logger.info({ subscriptionId: sub._id, email: user.email }, 'Renewal confirmation email sent');
        }
      } catch (emailErr) {
        logger.error({ err: emailErr, subscriptionId: sub._id }, 'Failed to send renewal confirmation email');
      }
    } catch (error) {
      logger.error({ err: error, subscriptionId: sub._id }, '[SubscriptionService] Failed to auto-renew');
    }
  }
}

export async function checkExpiringSubscriptions() {
  const now = new Date();

  // Time thresholds
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const in1Day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

  // Find active subscriptions expiring within 30 days
  const expiringSubs = await Subscription.find({
    status: 'active',
    currentPeriodEnd: { $lte: in30Days, $gt: now },
    deletedAt: null,
  }).populate('userId', 'fullName email').populate('tagId', 'tagId').populate('planId', 'name subscriptionConfig');

  for (const sub of expiringSubs) {
    const user = sub.userId as any;
    const tag = sub.tagId as any;
    const product = sub.planId as any;
    if (!user) continue;

    const daysUntilExpiry = Math.ceil(
      (sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const reminderStates = sub.reminderStates || { graceWeeklySentCount: 0 };
    const isFreePeriod = sub.freePeriodEndsAt && sub.currentPeriodEnd.getTime() === sub.freePeriodEndsAt.getTime();
    // Use annualPrice for annual plans, monthlyPrice for monthly
    const isAnnualPlan = sub.planType === 'annual' || sub.renewalMethod === 'annual';
    const monthlyPrice = isAnnualPlan
      ? (product?.subscriptionConfig?.annualPrice ?? (product?.subscriptionConfig?.monthlyPrice ?? sub.price ?? 3.99) * 12)
      : (product?.subscriptionConfig?.monthlyPrice || sub.price || 3.99);
    const productName = product?.name || sub.planName || 'PawTag';

    // Free period reminders (2-week and 3-day)
    if (isFreePeriod) {
      if (daysUntilExpiry <= 3 && !reminderStates.reminder1dSent) {
        await sendFreePeriodReminder3DayEmail(user.email, user.fullName, tag?.tagId || 'Unknown', productName, sub.currentPeriodEnd, monthlyPrice, sub.autoRenew, sub.planType);
        reminderStates.reminder1dSent = true;
      } else if (daysUntilExpiry <= 14 && !reminderStates.reminder7dSent) {
        await sendFreePeriodReminder2WeekEmail(user.email, user.fullName, tag?.tagId || 'Unknown', productName, sub.currentPeriodEnd, monthlyPrice, sub.autoRenew, sub.planType);
        reminderStates.reminder7dSent = true;
      }
    } else {
      // Billing period reminders (existing logic)
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
    
    // Read grace period from Product (not CMS settings)
    let gracePeriodWeeks = 4; // default
    if (sub.planId) {
      const product = await Product.findById(sub.planId).lean();
      if (product?.subscriptionConfig?.gracePeriodWeeks) {
        gracePeriodWeeks = product.subscriptionConfig.gracePeriodWeeks;
      }
    }
    
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
  }).populate('userId', 'fullName email').populate('tagId', 'tagId').populate('planId', 'name');

  for (const sub of graceExpired) {
    const user = sub.userId as any;
    const tag = sub.tagId as any;
    const product = sub.planId as any;
    
    sub.status = 'expired';
    await sub.save();

    await Tag.findByIdAndUpdate(sub.tagId, {
      subscriptionStatus: 'expired',
      status: 'expired',
    });

    // Send tag expired email
    if (user?.email) {
      await sendTagExpiredEmail(user.email, user.fullName || 'Customer', tag?.tagId || 'Unknown', product?.name || 'PawTag');
    }

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
  }).populate('userId', 'fullName email').populate('tagId', 'tagId').populate('planId', 'name');

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
    
    // Send 3-day grace warning
    if (daysLeft <= 3 && !reminderStates.reminder1dSent) {
      await sendGracePeriodReminder3DayEmail(user.email, user.fullName || 'Customer', tag?.tagId || 'Unknown', sub.gracePeriodEndsAt);
      reminderStates.reminder1dSent = true;
      sub.reminderStates = reminderStates;
      await sub.save();
      remindersSent++;
      continue;
    }

    // Send weekly reminder
    const lastReminder = reminderStates.lastGraceReminderAt;
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

  const invoice = await Invoice.create({
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

  // Create access token for the invoice so customers can view it
  try {
    const { generateSecureToken, hashToken } = await import('./auth.service');
    const secureToken = generateSecureToken();
    const tokenHash = hashToken(secureToken);
    await InvoiceAccessToken.create({
      invoiceId: invoice._id,
      userId: data.userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      verifiedAt: new Date(), // Pre-verified for subscription invoices
    });
  } catch (err) {
    // Don't fail invoice creation if token creation fails — log and continue
    logger.warn({ err, invoiceId: invoice._id }, 'Failed to create invoice access token');
  }

  return invoice;
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

async function checkCancelledBenefitsExpiry(): Promise<void> {
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const expiringCancelled = await Subscription.find({
    status: 'cancelled',
    currentPeriodEnd: { $lte: in3Days, $gt: now },
    deletedAt: null,
  }).populate('userId', 'fullName email');

  for (const sub of expiringCancelled) {
    const user = sub.userId as any;
    if (!user?.email) continue;

    // Dedup: skip if reminder already sent
    if ((sub as any).cancelledBenefitsExpiryReminderSent) continue;

    const daysLeft = Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) continue;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const reSubscribeUrl = `${frontendUrl}/account/upgrade`;

    const { renderCancelledBenefitsExpiringEmail } = await import('./email/templates/cancelled-benefits-expiring');
    const html = renderCancelledBenefitsExpiringEmail({
      name: user.fullName || 'there',
      planName: sub.planName || 'Gold Membership',
      daysLeft,
      benefitsUntil: sub.currentPeriodEnd.toLocaleDateString('en-NZ', { dateStyle: 'full' }),
      reSubscribeUrl,
    });

    await sendMail(
      user.email,
      `Your ${sub.planName} benefits expire in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
      html,
    ).catch(() => {});

    // Mark as sent to prevent duplicate emails
    (sub as any).cancelledBenefitsExpiryReminderSent = true;
    await sub.save().catch(() => {});

    logger.info({ subscriptionId: sub._id, daysLeft, email: user.email }, 'Sent cancelled benefits expiry reminder');
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
  await checkCancelledBenefitsExpiry();

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

async function sendFreePeriodReminder2WeekEmail(to: string, name: string, tagId: string, productName: string, freePeriodEndsAt: Date, monthlyPrice: number, autoRenew: boolean, planType?: string) {
  const subscriptionsUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/subscriptions`;
  const html = renderFreePeriodReminder2WeekEmail({
    name,
    tagId,
    productName,
    freePeriodEndsAt: freePeriodEndsAt.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }),
    monthlyPrice,
    planType,
    autoRenew,
    subscriptionsUrl,
  });

  await sendMail(to, `Your free ${productName} subscription ends in 2 weeks`, html);
}

async function sendFreePeriodReminder3DayEmail(to: string, name: string, tagId: string, productName: string, freePeriodEndsAt: Date, monthlyPrice: number, autoRenew: boolean, planType?: string) {
  const subscriptionsUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/subscriptions`;
  const html = renderFreePeriodReminder3DayEmail({
    name,
    tagId,
    productName,
    freePeriodEndsAt: freePeriodEndsAt.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }),
    monthlyPrice,
    planType,
    autoRenew,
    subscriptionsUrl,
  });

  await sendMail(to, `URGENT: Your free ${productName} subscription ends in 3 days`, html);
}

async function sendGracePeriodReminder3DayEmail(to: string, name: string, tagId: string, gracePeriodEndsAt: Date) {
  const renewUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/subscriptions`;
  const html = renderGracePeriodReminder3DayEmail({
    name,
    tagId,
    gracePeriodEndsAt: gracePeriodEndsAt.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }),
    renewUrl,
  });

  await sendMail(to, `URGENT: Your PawTag grace period ends in 3 days`, html);
}

async function sendTagExpiredEmail(to: string, name: string, tagId: string, productName: string) {
  const shopUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/shop`;
  const html = renderTagExpiredEmail({ name, tagId, productName, shopUrl });

  await sendMail(to, `Your PawTag has expired — Buy a new tag`, html);
}

export async function changeSubscriptionPlan(subscriptionId: string, newPlanType: 'annual' | 'monthly') {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw new Error('Subscription not found');
  if (subscription.status !== 'active') throw new Error('Can only change plan for active subscriptions');

  // Read price from Product (not CMS settings)
  let newPrice = subscription.price; // default to current price
  if (subscription.planId) {
    const product = await Product.findById(subscription.planId).lean();
    if (product?.subscriptionConfig) {
      if (newPlanType === 'annual') {
        newPrice = product.subscriptionConfig.annualPrice
          ?? (product.subscriptionConfig.monthlyPrice ?? 0) * 12;
      } else {
        newPrice = product.subscriptionConfig.monthlyPrice ?? subscription.price;
      }
    }
  }

  const planNames: Record<string, string> = { annual: 'PawTag Annual', monthly: 'PawTag Monthly' };

  const oldPlanType = subscription.planType;
  const oldPlanName = subscription.planName;
  const oldPrice = subscription.price;

  subscription.planType = newPlanType;
  subscription.planName = planNames[newPlanType];
  subscription.price = newPrice;
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
      price: newPrice,
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

/**
 * Change a Gold subscription between monthly and annual billing.
 *
 * Business rules:
 * - Only allowed on active Gold subscriptions
 * - Reads new price from CMS settings (guardian.goldPrice / guardian.goldAnnualPrice)
 * - If Stripe subscription exists: cancels old, creates new with correct price/interval
 * - Creates invoice record for the plan change
 * - Sends plan-change confirmation email
 * - Full audit logging with before/after state
 */
export async function changeGoldPlan(
  subscriptionId: string,
  userId: string,
  newPlanType: 'monthly' | 'annual',
) {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw new Error('Subscription not found');
  if (subscription.userId.toString() !== userId) throw new Error('Subscription not found');
  if (subscription.planType !== 'gold') throw new Error('This is not a Gold subscription');
  if (subscription.status !== 'active') throw new Error('Can only change plan for active subscriptions');

  // Load Gold prices from CMS settings
  const goldPriceSetting = await Setting.findOne({ key: 'guardian.goldPrice' }).lean();
  const goldAnnualPriceSetting = await Setting.findOne({ key: 'guardian.goldAnnualPrice' }).lean();
  const goldMonthlyPrice = parseFloat(goldPriceSetting?.value || '3.99');
  const goldAnnualPrice = parseFloat(goldAnnualPriceSetting?.value || '39.99');

  const newPrice = newPlanType === 'annual' ? goldAnnualPrice : goldMonthlyPrice;
  const oldPlanType = subscription.renewalMethod;
  const oldPrice = subscription.price;

  // Nothing to change if already on the requested plan
  if (subscription.renewalMethod === newPlanType) {
    throw new Error(`Already on the ${newPlanType} billing plan`);
  }

  // Update Stripe subscription if it exists
  let stripeUpdateSucceeded = false;
  if (subscription.stripeSubscriptionId && !isFakeMode()) {
    try {
      const stripe = getStripeClient();

      // Look up or create a new Stripe Price for Gold
      const billingInterval = newPlanType === 'annual' ? 'year' : 'month';
      const goldStripeProductId = (await Setting.findOne({ key: 'gold.stripeProductId' }).lean())?.value;

      if (goldStripeProductId) {
        // Create a new price for the new interval
        const newPriceObj = await stripe.prices.create({
          product: goldStripeProductId,
          unit_amount: Math.round(newPrice * 100),
          currency: 'nzd',
          recurring: { interval: billingInterval },
          metadata: { plan: 'gold' },
        });

        // Cancel the old Stripe subscription and create a new one
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);

        const user = await User.findById(userId).select('stripeCustomerId').lean();
        if (user?.stripeCustomerId) {
          const newStripeSub = await stripe.subscriptions.create({
            customer: user.stripeCustomerId,
            items: [{ price: newPriceObj.id }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            metadata: { userId: userId.toString(), plan: 'gold' },
            expand: ['latest_invoice.payment_intent'],
          });

          subscription.stripeSubscriptionId = newStripeSub.id;
          stripeUpdateSucceeded = true;

          logger.info({
            subscriptionId: subscription._id,
            oldStripeSubscriptionId: subscription.stripeSubscriptionId,
            newStripeSubscriptionId: newStripeSub.id,
            newPlanType,
            newPrice,
          }, '[Gold] Stripe subscription updated for plan change');
        }
      }
    } catch (stripeErr) {
      logger.error({ err: stripeErr, subscriptionId: subscription._id }, '[Gold] Failed to update Stripe subscription for plan change');
      // Continue with local update — Stripe mismatch will be caught by reconciliation
    }
  } else if (isFakeMode()) {
    stripeUpdateSucceeded = true;
  }

  // Update PawTag subscription
  subscription.renewalMethod = newPlanType;
  subscription.price = newPrice;
  subscription.planName = 'Gold Membership';

  await subscription.save();

  // Create invoice record for the plan change
  const now = new Date();
  await createInvoice({
    subscriptionId: subscription._id.toString(),
    userId: userId,
    amount: newPrice,
    billingPeriodStart: now,
    billingPeriodEnd: subscription.currentPeriodEnd,
    status: stripeUpdateSucceeded ? 'paid' : 'pending',
    paymentMethod: stripeUpdateSucceeded ? 'stripe' : 'pending',
  });

  // Send plan change confirmation email (fire-and-forget)
  try {
    const user = await User.findById(userId).select('fullName email').lean();
    if (user?.email) {
      const { sendMail } = await import('./email.service');
      const { renderSubscriptionPlanChangedEmail } = await import('./email/templates/subscription-plan-changed');
      const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/subscriptions`;
      const html = renderSubscriptionPlanChangedEmail({
        customerName: user.fullName || 'there',
        planName: 'Gold Membership',
        oldPlanType: oldPlanType as 'monthly' | 'annual',
        newPlanType,
        oldPrice,
        newPrice,
        nextBillingDate: subscription.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A',
        dashboardUrl,
      });
      await sendMail(user.email, `Gold Membership — Plan Changed to ${newPlanType}`, html, undefined, {
        templateSlug: 'subscription-plan-changed',
        businessFlow: 'subscription',
        relatedEntityType: 'subscription',
        relatedEntityId: subscription._id.toString(),
        relatedEntityDisplay: 'Gold Membership',
      });
    }
  } catch (emailErr) {
    logger.error({ err: emailErr, subscriptionId: subscription._id }, '[Gold] Failed to send plan change email');
  }

  // Audit log
  await auditJobEvent({
    action: 'gold_plan_changed',
    eventType: 'subscription.plan_changed',
    eventCategory: 'UPDATE',
    operationType: 'UPDATE',
    resourceType: 'Subscription',
    resourceId: subscription._id.toString(),
    outcome: 'SUCCESS',
    severity: 'HIGH',
    beforeState: {
      renewalMethod: oldPlanType,
      price: oldPrice,
      status: subscription.status,
    },
    afterState: {
      renewalMethod: newPlanType,
      price: newPrice,
      status: subscription.status,
    },
    metadata: {
      userId,
      planType: 'gold',
      planName: 'Gold Membership',
      stripeUpdateSucceeded,
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
  
  // Read grace period from Product (not CMS settings)
  let gracePeriodWeeks = 4; // default
  if (subscription.planId) {
    const product = await Product.findById(subscription.planId).lean();
    if (product?.subscriptionConfig?.gracePeriodWeeks) {
      gracePeriodWeeks = product.subscriptionConfig.gracePeriodWeeks;
    }
  }
  
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
  // In fake mode, simulate success (deterministic — no Math.random)
  if (isFakeMode()) {
    return true;
  }

  // In production, use Stripe to retry the payment
  try {
    const stripe = getStripeClient();

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

async function sendGoldWelcomeEmail(to: string, name: string, price: number, dashboardUrl: string, planType?: string) {
  const html = renderGoldWelcomeEmail({ customerName: name, price, planType, dashboardUrl });
  await sendMail(to, 'Welcome to PawTag Gold Membership', html);
}

async function sendPaymentRetrySuccessEmail(to: string, name: string, tagId: string) {
  const html = renderPaymentRetrySuccessEmail({ name, tagId });
  await sendMail(to, `Payment successful for your PawTag subscription`, html);
}

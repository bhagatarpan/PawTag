import { MembershipTier, UserMembership, User, Tag, Invoice, InvoiceAccessToken } from '@pawtag/db';
import mongoose from 'mongoose';
import { isFakeMode } from '../commerce/payment-mode';
import Stripe from 'stripe';
import {
  KEEP_MEMBERSHIP_AUDIT_ACTIONS,
  KEEP_MEMBERSHIP_OUTCOMES,
  MEMBERSHIP_TIER_CHANGE_CODES,
  MEMBERSHIP_TIER_CHANGE_HTTP_STATUS,
  STRIPE_CURRENCY_NZD,
  isCancellingMembership,
  requiresPaymentForKeep,
  type KeepMembershipOutcome,
  type KeepMembershipResponseData,
  type MembershipTierChangeCode,
  type RepairUpgradeResponseData,
} from '@pawtag/shared';
import { sendMail } from './email.service';
import { sendInvoiceEmail } from './email.service';
import { generateInvoiceHtml } from './invoice-html.service';
import { generateSecureToken, hashToken } from './auth.service';
import { createAndDeliverNotification } from './notification-delivery.service';
import { auditService, type AuditContext } from './audit';
import { systemAuditContext } from '../lib/app-meta';
import { getRequestContext } from '../lib/request-context';
import { AppError, type ErrorCode, type ErrorMetadata } from '../lib/app-errors';
import {
  getStripeClient,
  resetStripeClientCache,
  setStripeClientForTests,
} from '../lib/stripe-client';
import {
  classifyStripeSubscriptionFailure,
  firstSubscriptionItemId,
  isInvalidStripeSubscriptionId,
  logStripeSubscriptionFailure,
  stripeSubscriptionEnded,
} from './stripe/stripe-subscription-errors';
import logger from '../lib/logger';

// Re-export central Stripe client for existing callers/tests.
export { getStripeClient, resetStripeClientCache, setStripeClientForTests };

function httpStatusForMembershipCode(code: MembershipTierChangeCode): number {
  return MEMBERSHIP_TIER_CHANGE_HTTP_STATUS[code] ?? 400;
}

function appErrorCodeForHttpStatus(httpStatus: number): ErrorCode {
  if (httpStatus === 402 || httpStatus === 502) return 'EXTERNAL_SERVICE_ERROR';
  if (httpStatus === 409) return 'CONFLICT_ERROR';
  if (httpStatus === 400) return 'VALIDATION_ERROR';
  return 'BUSINESS_RULE_ERROR';
}

export class MembershipTierChangeError extends AppError {
  public readonly membershipCode: MembershipTierChangeCode;

  constructor(
    membershipCode: MembershipTierChangeCode,
    message: string,
    userMessage: string,
    metadata?: ErrorMetadata,
  ) {
    const httpStatus = httpStatusForMembershipCode(membershipCode);
    super(message, {
      code: appErrorCodeForHttpStatus(httpStatus),
      httpStatus,
      userMessage,
      metadata: { ...metadata, membershipCode },
    });
    this.name = 'MembershipTierChangeError';
    this.membershipCode = membershipCode;
  }
}

function throwMembershipTierError(
  membershipCode: MembershipTierChangeCode,
  message: string,
  userMessage: string,
  metadata?: ErrorMetadata,
): never {
  throw new MembershipTierChangeError(membershipCode, message, userMessage, metadata);
}

function mapStripeSubscriptionFailure(err: unknown, membershipId: string): never {
  const classified = logStripeSubscriptionFailure(
    err,
    { membershipId, operation: 'changeTier.stripeSubscriptionUpdate' },
    'changeTier.stripeSubscriptionUpdate',
  );

  switch (classified.kind) {
    case 'subscription_missing':
      return throwMembershipTierError(
        MEMBERSHIP_TIER_CHANGE_CODES.SUBSCRIPTION_MISSING,
        `Stripe subscription missing for membership ${membershipId}`,
        'We could not find an active billing subscription for this membership. Please subscribe again or contact support.',
        { stripeCode: classified.stripeCode },
      );
    case 'subscription_not_active':
      return throwMembershipTierError(
        MEMBERSHIP_TIER_CHANGE_CODES.SUBSCRIPTION_NOT_ACTIVE,
        `Stripe subscription not active for membership ${membershipId}`,
        'This membership subscription has already ended with the payment provider. Please subscribe again.',
        { stripeCode: classified.stripeCode },
      );
    case 'payment_method_required':
      return throwMembershipTierError(
        MEMBERSHIP_TIER_CHANGE_CODES.PAYMENT_METHOD_REQUIRED,
        `Stripe requires a payment method for membership ${membershipId}`,
        'Please update your payment method, then try the upgrade again.',
        { stripeCode: classified.stripeCode },
      );
    default:
      return throwMembershipTierError(
        MEMBERSHIP_TIER_CHANGE_CODES.STRIPE_UPDATE_FAILED,
        `Stripe subscription update failed for membership ${membershipId}: ${classified.stripeCode || 'unknown'}`,
        'Payment provider update failed. Please try again or contact support.',
        { stripeCode: classified.stripeCode },
      );
  }
}

// Cache for settings
let settingsCache: Record<string, string> = {};
let settingsCacheTimestamp = 0;
const SETTINGS_CACHE_TTL = 60 * 1000;

async function loadSettings(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now - settingsCacheTimestamp < SETTINGS_CACHE_TTL && Object.keys(settingsCache).length > 0) {
    return settingsCache;
  }
  try {
    const { Setting } = await import('@pawtag/db');
    const settings = await Setting.find({
      key: { $in: ['membership.renewalReminderDays', 'membership.maxPaymentRetries'] },
    }).lean();
    settingsCache = {};
    for (const setting of settings) {
      settingsCache[setting.key] = setting.value;
    }
    settingsCacheTimestamp = now;
    return settingsCache;
  } catch (error) {
    logger.error({ err: error }, 'Failed to load membership settings');
    return { 'membership.renewalReminderDays': '30,7', 'membership.maxPaymentRetries': '3' };
  }
}

// ─── Audit Helper ────────────────────────────────────────────

async function auditMembershipEvent(
  input: Parameters<typeof auditService.log>[1],
  overrides: Partial<AuditContext> = {},
): Promise<void> {
  try {
    const reqCtx = getRequestContext();
    const context: AuditContext = systemAuditContext('SERVICE', {
      ...(reqCtx?.requestId ? { requestId: reqCtx.requestId } : {}),
      ...(reqCtx?.correlationId ? { correlationId: reqCtx.correlationId } : {}),
      ...(reqCtx?.userId ? { actorId: reqCtx.userId, actorUsername: reqCtx.email || reqCtx.userId } : {}),
      ...(reqCtx?.ip ? { sourceIp: reqCtx.ip } : {}),
      ...(reqCtx?.userId ? { subjectUserId: reqCtx.userId } : {}),
      ...overrides,
    });
    // Customer-initiated keep/resume/cancel: prefer real actor when request context has userId
    if (reqCtx?.userId && input.action?.startsWith('membership_')) {
      context.actorType = 'SERVICE';
      context.actorId = reqCtx.userId;
      context.actorUsername = reqCtx.email || reqCtx.userId;
      if (reqCtx.ip) context.sourceIp = reqCtx.ip;
    }
    await auditService.log(context, input);
  } catch (err) {
    logger.error({ err }, '[Audit] Failed to log membership event');
  }
}

// ─── Get Membership Tiers ────────────────────────────────────

export async function getMembershipTiers() {
  return MembershipTier.find({ isActive: true }).sort({ displayOrder: 1 }).lean();
}

export async function getMembershipTierByTier(tier: 'gold' | 'platinum' | 'black') {
  return MembershipTier.findOne({ tier }).lean();
}

// ─── Get User Membership Status ──────────────────────────────

export async function getUserMembershipStatus(userId: string) {
  const membership = await UserMembership.findOne({
    userId,
    status: { $in: ['active', 'cancelled', 'expired', 'pending_payment'] },
  })
    .populate('tierId')
    .sort({ createdAt: -1 })
    .lean();

  if (!membership) {
    return { hasMembership: false, membership: null, tier: null };
  }

  return {
    hasMembership: membership.status === 'active',
    membership,
    tier: membership.tierId,
  };
}

// ─── Check Tag Access ────────────────────────────────────────

/**
 * HYBRID 2 access for a tag.
 * Uses stored Active Period / warranty + membership via calculateTagStatus.
 */
export async function checkTagAccess(tagId: string): Promise<{
  hasAccess: boolean;
  finderEnabled: boolean;
  reason: string;
  status?: string;
  activePeriodEndsAt?: Date;
  warrantyEndsAt?: Date;
  membershipEndsAt?: Date;
}> {
  const tag = await Tag.findById(tagId).lean();
  if (!tag) {
    return { hasAccess: false, finderEnabled: false, reason: 'Tag not found' };
  }

  if (tag.status === 'returned' || tag.returnedAt) {
    return {
      hasAccess: false,
      finderEnabled: false,
      reason: 'Tag returned to PawTag',
      status: 'returned',
    };
  }

  const { calculateTagStatus } = await import('./tag-status.service');
  const result = await calculateTagStatus(tag as any);

  // Active period or membership → access + finder
  if (result.status === 'active') {
    return {
      hasAccess: true,
      finderEnabled: result.finderEnabled,
      reason: result.reason,
      status: 'active',
      activePeriodEndsAt: result.activePeriodEndsAt || tag.activePeriodEndsAt,
      warrantyEndsAt: result.warrantyEndsAt || tag.warrantyEndsAt,
      membershipEndsAt: result.membershipEndsAt,
    };
  }

  // Limited: warranty still valid, no finder (needs membership)
  if (result.status === 'limited') {
    return {
      hasAccess: true,
      finderEnabled: false,
      reason: 'Active period expired — membership required for finder notifications',
      status: 'limited',
      activePeriodEndsAt: result.activePeriodEndsAt,
      warrantyEndsAt: result.warrantyEndsAt,
    };
  }

  // Expired
  return {
    hasAccess: false,
    finderEnabled: false,
    reason: result.reason,
    status: 'expired',
    warrantyEndsAt: result.warrantyEndsAt,
  };
}

// ─── Cleanup Helpers ──────────────────────────────────────

async function cleanupPendingMembership(
  membership: { _id: any; stripeSubscriptionId?: string },
  stripe: Stripe,
): Promise<void> {
  if (membership.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(membership.stripeSubscriptionId);
      logger.info({ membershipId: membership._id, stripeSubscriptionId: membership.stripeSubscriptionId }, '[Membership] Cancelled orphaned Stripe subscription');
    } catch (err: any) {
      // Subscription may already be cancelled or not found — log but don't fail
      logger.warn({ err, membershipId: membership._id }, '[Membership] Failed to cancel Stripe subscription (may already be cancelled)');
    }
  }
  await UserMembership.findByIdAndDelete(membership._id);
  logger.info({ membershipId: membership._id }, '[Membership] Deleted orphaned pending membership');
}

export async function cleanupOrphanedPendingMemberships(): Promise<{ cleaned: number; errors: number }> {
  const cutoffTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
  let cleaned = 0;
  let errors = 0;

  try {
    const orphanedMemberships = await UserMembership.find({
      status: 'pending_payment',
      createdAt: { $lt: cutoffTime },
    }).lean();

    if (orphanedMemberships.length === 0) {
      return { cleaned: 0, errors: 0 };
    }

    logger.info({ count: orphanedMemberships.length }, '[Membership Cleanup] Found orphaned pending memberships');

    const stripe = isFakeMode() ? null : getStripeClient();

    for (const membership of orphanedMemberships) {
      try {
        if (stripe && membership.stripeSubscriptionId) {
          await cleanupPendingMembership(membership, stripe);
        } else {
          await UserMembership.findByIdAndDelete(membership._id);
        }
        cleaned++;
      } catch (err) {
        logger.error({ err, membershipId: membership._id }, '[Membership Cleanup] Failed to clean up membership');
        errors++;
      }
    }

    logger.info({ cleaned, errors }, '[Membership Cleanup] Completed');
  } catch (err) {
    logger.error({ err }, '[Membership Cleanup] Failed to query orphaned memberships');
    errors++;
  }

  return { cleaned, errors };
}

// ─── Subscribe to Tier ───────────────────────────────────────

export async function subscribeToTier(
  userId: string,
  tierId: string,
  paymentMethodId?: string,
): Promise<{ membership: any; clientSecret?: string }> {
  const now = new Date();

  // Get tier
  const tier = await MembershipTier.findById(tierId).lean();
  if (!tier) throw new Error('Membership tier not found');
  if (!tier.isActive) throw new Error('This membership tier is not currently available');

  // Check for existing active membership
  const existingActiveMembership = await UserMembership.findOne({
    userId,
    status: 'active',
  });
  if (existingActiveMembership) {
    throw new Error('You already have an active membership');
  }

  // Check for existing pending_payment membership (idempotent retry)
  const existingPendingMembership = await UserMembership.findOne({
    userId,
    status: 'pending_payment',
  }).lean();

  if (existingPendingMembership && existingPendingMembership.stripeSubscriptionId && !isFakeMode()) {
    // Try to retrieve the existing Stripe subscription's client secret
    try {
      const stripe = getStripeClient();
      const stripeSubscription = await stripe.subscriptions.retrieve(
        existingPendingMembership.stripeSubscriptionId,
        { expand: ['latest_invoice.payment_intent'] },
      );

      const latestInvoice = stripeSubscription.latest_invoice as any;
      if (latestInvoice?.payment_intent?.client_secret) {
        logger.info({
          userId,
          membershipId: existingPendingMembership._id,
          stripeSubscriptionId: stripeSubscription.id,
        }, '[Membership] Returning existing pending membership with client secret');
        return { membership: existingPendingMembership, clientSecret: latestInvoice.payment_intent.client_secret };
      }

      // Stripe subscription exists but no client secret — clean up and retry
      logger.warn({
        userId,
        membershipId: existingPendingMembership._id,
        stripeSubscriptionId: stripeSubscription.id,
      }, '[Membership] Existing pending membership has no client secret, cleaning up');
      await cleanupPendingMembership(existingPendingMembership, stripe);
    } catch (err) {
      // Stripe subscription retrieval failed — clean up and retry
      logger.error({ err, userId, membershipId: existingPendingMembership._id }, '[Membership] Failed to retrieve existing Stripe subscription, cleaning up');
      try {
        const stripe = getStripeClient();
        await cleanupPendingMembership(existingPendingMembership, stripe);
      } catch {
        // If cleanup fails, still try to delete the membership record
        await UserMembership.findByIdAndDelete(existingPendingMembership._id);
      }
    }
  } else if (existingPendingMembership) {
    // Demo mode or no Stripe subscription — delete stale pending membership
    await UserMembership.findByIdAndDelete(existingPendingMembership._id);
  }

  // Get user
  const user = await User.findById(userId).select('email fullName stripeCustomerId').lean();
  if (!user) throw new Error('User not found');

  // Create or get Stripe Customer
  let stripeCustomerId = user.stripeCustomerId;
  let stripeSubscriptionId: string | undefined;
  let clientSecret: string | undefined;

  if (!isFakeMode()) {
    try {
      const stripe = getStripeClient();

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.fullName || undefined,
          metadata: { userId: userId.toString(), source: 'pawtag-membership' },
        });
        stripeCustomerId = customer.id;
        await User.findByIdAndUpdate(userId, { stripeCustomerId: customer.id });
        logger.info({ userId, stripeCustomerId: customer.id }, '[Membership] Created Stripe customer');
      }

      // Look up or create Stripe Price
      let stripePriceId = tier.stripePriceId;
      if (!stripePriceId) {
        const priceObj = await stripe.prices.create({
          product_data: {
            name: `${tier.name} - Annual`,
            metadata: { tier: tier.tier },
          },
          unit_amount: Math.round(tier.price * 100),
          currency: 'nzd',
          recurring: { interval: 'year' },
          metadata: { tier: tier.tier },
        });
        stripePriceId = priceObj.id;
        await MembershipTier.findByIdAndUpdate(tierId, { stripePriceId: priceObj.id });
      }

      // Create Stripe Subscription — preselect customer default PM when available
      const { getDefaultPaymentMethodIdForUser } = await import('./payment-method.service');
      const defaultPaymentMethodId = await getDefaultPaymentMethodIdForUser(userId).catch(() => null);

      const stripeSubscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: stripePriceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        ...(defaultPaymentMethodId ? { default_payment_method: defaultPaymentMethodId } : {}),
        metadata: { userId: userId.toString(), tier: tier.tier },
        expand: ['latest_invoice.payment_intent'],
      });

      stripeSubscriptionId = stripeSubscription.id;

      // Extract client secret for frontend — primary attempt from expanded response
      const latestInvoice = stripeSubscription.latest_invoice as any;
      if (latestInvoice?.payment_intent?.client_secret) {
        clientSecret = latestInvoice.payment_intent.client_secret;
      }

      // If clientSecret is still null, the payment_intent was not auto-created on the invoice.
      // This happens with some Stripe API versions/accounts. Create a PaymentIntent manually
      // for the invoice amount so the frontend can collect payment.
      if (!clientSecret && stripeSubscriptionId) {
        logger.warn({ userId, stripeSubscriptionId }, '[Membership] payment_intent not on invoice, creating PaymentIntent manually');

        // Retrieve the subscription to get the latest invoice amount
        const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const invoiceId = typeof sub.latest_invoice === 'string' ? sub.latest_invoice : (sub.latest_invoice as any)?.id;

        if (invoiceId) {
          const invoice = await stripe.invoices.retrieve(invoiceId);
          const amount = invoice.amount_due || invoice.total;

          if (amount > 0) {
            const paymentIntent = await stripe.paymentIntents.create({
              amount,
              currency: invoice.currency || 'nzd',
              customer: stripeCustomerId,
              metadata: {
                userId: userId.toString(),
                subscriptionId: stripeSubscriptionId,
                invoiceId,
                tier: tier.tier,
              },
              automatic_payment_methods: { enabled: true },
            });
            clientSecret = paymentIntent.client_secret || undefined;
            logger.info({ userId, paymentIntentId: paymentIntent.id, hasClientSecret: !!clientSecret }, '[Membership] Created PaymentIntent manually');
          } else {
            logger.warn({ userId, invoiceId, amount }, '[Membership] Invoice has zero amount, cannot create PaymentIntent');
          }
        } else {
          logger.error({ userId, stripeSubscriptionId }, '[Membership] No invoice found on subscription');
        }
      }

      logger.info({
        userId,
        stripeCustomerId,
        stripeSubscriptionId,
        clientSecretObtained: !!clientSecret,
      }, '[Membership] Stripe subscription setup complete');
    } catch (err) {
      logger.error({ err, userId }, '[Membership] Stripe subscription creation failed');
      throw new Error('Payment processing failed. Please try again.');
    }

    // If clientSecret is still undefined after both extraction attempts, clean up and fail
    if (!clientSecret && stripeSubscriptionId) {
      logger.error({ userId, stripeSubscriptionId }, '[Membership] clientSecret unavailable after subscription creation, cleaning up');
      try {
        const stripe = getStripeClient();
        await stripe.subscriptions.cancel(stripeSubscriptionId);
      } catch {
        // Best-effort cleanup — log but don't mask the original error
      }
      throw new Error('Unable to initialize payment. Please try again.');
    }

    if (!clientSecret) {
      throw new Error('Unable to initialize payment. Please try again.');
    }
  }

  // Calculate period end (1 year from now)
  const currentPeriodEnd = new Date(now);
  currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);

  // In demo/fake mode, activate immediately; otherwise pending until payment
  const initialStatus = isFakeMode() ? 'active' : 'pending_payment';

  // Create UserMembership
  const membership = await UserMembership.create({
    userId,
    tierId,
    status: initialStatus,
    billingCycle: 'annual',
    price: tier.price,
    currency: 'NZD',
    startDate: now,
    currentPeriodStart: now,
    currentPeriodEnd,
    stripeCustomerId,
    stripeSubscriptionId,
    paymentMethodId,
    autoRenew: true,
    adminExtensionGraceUsed: false,
    adminExtensionCount: 0,
  });

  // In demo mode, complete activation immediately (update user, extend tags)
  if (isFakeMode()) {
    await User.findByIdAndUpdate(userId, {
      membershipTier: tier.tier,
      membershipId: membership._id,
    });

    try {
      await extendTagsForMembership(userId, membership._id.toString());
    } catch (err) {
      logger.error({ err, membershipId: membership._id }, '[Membership] Failed to extend tags in demo mode');
    }
  }

  // Audit log
  await auditMembershipEvent({
    action: 'membership_created',
    eventType: 'membership.created',
    eventCategory: 'FINANCIAL',
    operationType: 'CREATE',
    resourceType: 'UserMembership',
    resourceId: membership._id.toString(),
    outcome: 'SUCCESS',
    severity: 'HIGH',
    metadata: {
      userId,
      tierId,
      tier: tier.tier,
      price: tier.price,
      stripeCustomerId: stripeCustomerId || 'demo',
      stripeSubscriptionId: stripeSubscriptionId || 'demo',
    },
  });

  return { membership, clientSecret };
}

// ─── Activate Membership (after payment) ─────────────────────

export async function activateMembership(membershipId: string) {
  const membership = await UserMembership.findById(membershipId);
  if (!membership) throw new Error('Membership not found');

  // Paid repair upgrade: active local membership + pendingTierId after Stripe payment
  if (membership.status === 'active' && membership.pendingTierId) {
    return completeRepairUpgrade(membership);
  }

  if (membership.status === 'active') return membership;

  membership.status = 'active';
  await membership.save();

  // Populate card display data from Stripe subscription's default payment method.
  // The subscription uses save_default_payment_method: 'on_subscription',
  // so after initial payment Stripe stores the PM on the subscription.
  if (membership.stripeSubscriptionId && !isFakeMode()) {
    try {
      const stripe = getStripeClient();
      const sub = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);
      const defaultPmId = typeof sub.default_payment_method === 'string'
        ? sub.default_payment_method
        : (sub.default_payment_method as any)?.id;

      if (defaultPmId) {
        const pm = await stripe.paymentMethods.retrieve(defaultPmId);
        if (pm.card) {
          membership.cardBrand = pm.card.brand;
          membership.cardLast4 = pm.card.last4;
          membership.cardExpMonth = pm.card.exp_month;
          membership.cardExpYear = pm.card.exp_year;
          membership.paymentMethodId = pm.id;
          await membership.save();
          logger.info({ membershipId, cardBrand: pm.card.brand, cardLast4: pm.card.last4 }, '[Membership] Card display data populated from Stripe');
        }
      }
    } catch (err) {
      logger.warn({ err, membershipId }, '[Membership] Failed to populate card display data from Stripe');
    }
  }

  // Create invoice for membership purchase (INVM- prefix) — with idempotency check
  let invoiceId: mongoose.Types.ObjectId | undefined;
  try {
    // Check if invoice already exists (idempotency: prevent duplicate if frontend + webhook both call activate)
    const existingInvoice = await Invoice.findOne({
      userId: membership.userId,
      stripeSubscriptionId: membership.stripeSubscriptionId,
    });

    if (existingInvoice) {
      invoiceId = existingInvoice._id;
      logger.info({ membershipId, invoiceId: existingInvoice._id }, '[Membership] Invoice already exists, skipping creation');
    } else {
      const invCounter = await UserMembership.db!.collection('counters').findOneAndUpdate(
        { _id: 'membershipInvoiceNumber' as any },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      );
      const invoiceNumber = `INVM-${String(invCounter?.value?.seq || 1).padStart(6, '0')}`;

      const invoice = await Invoice.create({
        userId: membership.userId,
        userMembershipId: membership._id,
        invoiceNumber,
        amount: membership.price,
        currency: membership.currency || 'NZD',
        status: 'paid',
        stripeSubscriptionId: membership.stripeSubscriptionId,
        billingPeriod: {
          start: membership.currentPeriodStart,
          end: membership.currentPeriodEnd,
        },
        paidAt: new Date(),
      });

      invoiceId = invoice._id;
      logger.info({ membershipId, invoiceId: invoice._id, invoiceNumber }, '[Membership] Invoice created');
    }

    membership.invoiceId = invoiceId;
    await membership.save();
  } catch (err) {
    logger.error({ err, membershipId }, '[Membership] Failed to create invoice');
  }

  // Update user's membershipTier
  const tier = await MembershipTier.findById(membership.tierId).lean();
  if (tier) {
    await User.findByIdAndUpdate(membership.userId, {
      membershipTier: tier.tier,
      membershipId: membership._id,
    });
  }

  // Send welcome email — CMS-first
  try {
    const user = await User.findById(membership.userId).select('email fullName').lean();
    if (user?.email && tier) {
      const { renderMembershipWelcomeEmail } = await import('./email/templates/membership-welcome');
      const { sendCmsEmailOrFallback } = await import('./email.service');
      const html = renderMembershipWelcomeEmail({
        customerName: user.fullName || 'there',
        tierName: tier.displayName,
        price: membership.price,
        renewalDate: membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A',
        dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
      });
      await sendCmsEmailOrFallback({
        slug: 'membership-welcome',
        to: user.email,
        vars: {
          customerName: user.fullName || 'there',
          tierName: tier.displayName,
          price: String(membership.price),
          renewalDate: membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A',
          dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
        },
        fallbackSubject: `Welcome to ${tier.name}!`,
        fallbackHtml: html,
        businessFlow: 'subscriptions',
        relatedEntityType: 'membership',
        relatedEntityId: String(membership._id),
      }).catch(() => {});
    }
  } catch (err) {
    logger.error({ err, membershipId }, '[Membership] Failed to send welcome email');
  }

  // Send invoice email with secure viewable URL
  try {
    if (invoiceId) {
      const user = await User.findById(membership.userId).select('email fullName').lean();
      const invoice = await Invoice.findById(invoiceId).lean();
      if (user?.email && invoice) {
        // Generate secure invoice access URL
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const token = require('crypto').randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year for membership invoices
        await InvoiceAccessToken.create({
          invoiceId: invoice._id,
          userId: membership.userId,
          token,
          expiresAt,
        });
        const invoiceUrl = `${frontendUrl}/account/invoices/${invoice.invoiceNumber}?token=${token}`;

        const { generateInvoiceHtml } = await import('./invoice-html.service');
        const { sendInvoiceEmail } = await import('./email.service');
        const invoiceHtml = await generateInvoiceHtml(invoice._id.toString());
        await sendInvoiceEmail(user.email, user.fullName, invoice.invoiceNumber, invoiceHtml, invoiceUrl, invoice.amount).catch(() => {});
        logger.info({ membershipId, invoiceId: invoice._id, invoiceNumber: invoice.invoiceNumber }, '[Membership] Invoice email sent');
      }
    }
  } catch (err) {
    logger.error({ err, membershipId }, '[Membership] Failed to send invoice email');
  }

  // In-app notification
  try {
    await createAndDeliverNotification({
      userId: membership.userId.toString(),
      type: 'membership_activated',
      title: `${tier?.displayName || 'Gold'} Membership Activated`,
      message: `Welcome to ${tier?.displayName || 'Gold'}! Your membership is now active.`,
      priority: 'normal',
      channel: 'info',
      actionUrl: '/account/membership',
    });
  } catch (err) {
    logger.error({ err, membershipId }, '[Membership] Failed to create in-app notification');
  }

  // HYBRID 2: Extend tags based on membership tier limit
  try {
    await extendTagsForMembership(membership.userId.toString(), membership._id.toString());
  } catch (err) {
    logger.error({ err, membershipId }, '[Membership] Failed to extend tags');
    // Don't fail membership activation if tag extension fails
  }

  return membership;
}

// ─── Cancel Membership ───────────────────────────────────────

export async function cancelMembership(userId: string, reason?: string) {
  const membership = await UserMembership.findOne({
    userId,
    status: 'active',
  });

  if (!membership) throw new Error('No active membership found');

  // Guard: prevent double-cancel (membership already has cancelledAt set)
  if (membership.cancelledAt) {
    throw new Error('Your membership is already scheduled for cancellation');
  }

  // Cancel Stripe subscription at period end (not immediately).
  // This ensures the customer keeps benefits until currentPeriodEnd.
  // CRITICAL: If Stripe fails, we must NOT proceed — customer would be
  // charged after cancelling. Throw to prevent local state change.
  if (membership.stripeSubscriptionId && !isFakeMode()) {
    try {
      const stripe = getStripeClient();
      await stripe.subscriptions.update(membership.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      logger.info({ membershipId: membership._id }, 'Stripe subscription set to cancel at period end');
    } catch (err) {
      logger.error({ err, membershipId: membership._id }, 'Failed to set Stripe subscription cancel_at_period_end');
      throw new Error('Failed to cancel membership with payment provider. Please try again or contact support.');
    }
  }

  // Record cancellation intent but keep membership ACTIVE until period end.
  // The checkExpiredMemberships job will transition to 'expired' at currentPeriodEnd.
  membership.autoRenew = false;
  membership.cancelledAt = new Date();
  membership.cancellationReason = reason;
  await membership.save();

  // NOTE: User.membershipTier is NOT nulled here — benefits remain until period end.
  // Tags are NOT removed here — they remain active until period end.
  // The expiry job handles both transitions.

  // Generate retention offer for next purchase
  let retentionOffer = null;
  try {
    const { generateRetentionOffer } = await import('./membership-retention.service');
    retentionOffer = await generateRetentionOffer(userId, membership.tierId.toString(), 'cancel');
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, '[Membership] Failed to generate retention offer');
  }

  // Send cancellation email — CMS-first
  try {
    const user = await User.findById(userId).select('email fullName').lean();
    const tier = await MembershipTier.findById(membership.tierId).lean();
    if (user?.email && tier) {
      const { renderMembershipCancelledEmail } = await import('./email/templates/membership-cancelled');
      const { sendCmsEmailOrFallback } = await import('./email.service');
      const benefitsUntil = membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A';
      const html = renderMembershipCancelledEmail({
        customerName: user.fullName || 'there',
        tierName: tier.displayName,
        cancelledAt: membership.cancelledAt?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A',
        benefitsUntil,
        resubscribeUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/membership`,
        retentionOffer: retentionOffer || undefined,
      });
      await sendCmsEmailOrFallback({
        slug: 'membership-cancelled',
        to: user.email,
        vars: {
          customerName: user.fullName || 'there',
          tierName: tier.displayName,
          benefitsUntil,
          dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
        },
        fallbackSubject: `${tier.name} Membership Cancelled`,
        fallbackHtml: html,
        businessFlow: 'subscriptions',
        relatedEntityType: 'membership',
        relatedEntityId: String(membership._id),
      }).catch((err) => logger.error({ err, membershipId: membership._id }, '[Membership] Failed to send cancellation email'));
    }
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, '[Membership] Failed to send cancellation email');
  }

  // In-app notification
  try {
    const cancelTier = await MembershipTier.findById(membership.tierId).lean();
    await createAndDeliverNotification({
      userId: membership.userId.toString(),
      type: 'membership_cancelled',
      title: `${cancelTier?.displayName || 'Membership'} Cancelled`,
      message: `Your ${cancelTier?.displayName || 'membership'} has been cancelled. Benefits remain active until ${membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'the end of your billing period'}.`,
      priority: 'normal',
      channel: 'info',
      actionUrl: '/account/membership',
    });
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, '[Membership] Failed to send cancellation notification');
  }

  // Audit log
  await auditMembershipEvent({
    action: 'membership_cancelled',
    eventType: 'membership.cancelled',
    eventCategory: 'FINANCIAL',
    operationType: 'UPDATE',
    resourceType: 'UserMembership',
    resourceId: membership._id.toString(),
    outcome: 'SUCCESS',
    severity: 'HIGH',
    metadata: {
      userId,
      tierId: membership.tierId.toString(),
      reason: reason || 'Customer request',
      cancelAtPeriodEnd: true,
      benefitsUntil: membership.currentPeriodEnd,
    },
  });

  return membership;
}

// ─── Resume Membership ──────────────────────────────────────

/**
 * Resume a membership that was cancelled for period end (cancel_at_period_end).
 *
 * Only valid while status is still 'active' and cancelledAt is set — i.e. the
 * customer is in the cancelling window before currentPeriodEnd.
 *
 * Stripe is authoritative: cancel_at_period_end is cleared first. If Stripe
 * fails, local cancellation state is left intact.
 */
export async function resumeMembership(userId: string) {
  const membership = await UserMembership.findOne({
    userId,
    status: 'active',
    cancelledAt: { $ne: null },
  });

  if (!membership) {
    throw new Error('Your membership is not scheduled for cancellation');
  }

  if (membership.currentPeriodEnd && membership.currentPeriodEnd.getTime() < Date.now()) {
    throw new Error('Your membership benefits have already ended. Please subscribe again to rejoin.');
  }

  const previousCancelledAt = membership.cancelledAt;

  // Stripe first — fail closed. Do not clear local cancellation if provider fails.
  if (membership.stripeSubscriptionId && !isFakeMode()) {
    try {
      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);

      if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
        throw new Error('This membership subscription has already ended with the payment provider. Please subscribe again.');
      }

      await stripe.subscriptions.update(membership.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
      logger.info({ membershipId: membership._id }, 'Stripe subscription cancel_at_period_end cleared');
    } catch (err: any) {
      if (err?.message && /already ended|subscribe again/.test(err.message)) {
        throw err;
      }
      logger.error({ err, membershipId: membership._id }, 'Failed to resume Stripe subscription');
      throw new Error('Failed to resume membership with payment provider. Please try again or contact support.');
    }
  }

  membership.cancelledAt = undefined;
  membership.cancellationReason = undefined;
  membership.autoRenew = true;
  await membership.save();

  // Entitlements remain keyed on status==='active'; invalidate so any cached
  // tier lookups stay consistent after billing-state changes.
  try {
    const { membershipEntitlementService } = await import('./membership-entitlement.service');
    membershipEntitlementService.invalidateCache();
  } catch (err) {
    logger.warn({ err, membershipId: membership._id }, '[Membership] Failed to invalidate entitlement cache after resume');
  }

  // Email confirmation — CMS-first
  try {
    const user = await User.findById(userId).select('email fullName').lean();
    const tier = await MembershipTier.findById(membership.tierId).lean();
    if (user?.email && tier) {
      const { renderMembershipResumedEmail } = await import('./email/templates/membership-resumed');
      const { sendCmsEmailOrFallback } = await import('./email.service');
      const benefitsUntil = membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A';
      const html = renderMembershipResumedEmail({
        customerName: user.fullName || 'there',
        tierName: tier.displayName,
        resumedAt: new Date().toLocaleDateString('en-NZ', { dateStyle: 'full' }),
        benefitsUntil,
        dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
      });
      await sendCmsEmailOrFallback({
        slug: 'membership-resumed',
        to: user.email,
        vars: {
          customerName: user.fullName || 'there',
          tierName: tier.displayName,
          benefitsUntil,
          dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
        },
        fallbackSubject: `${tier.displayName} Membership Resumed`,
        fallbackHtml: html,
        businessFlow: 'subscriptions',
        relatedEntityType: 'membership',
        relatedEntityId: String(membership._id),
      }).catch((err) => logger.error({ err, membershipId: membership._id }, '[Membership] Failed to send resume email'));
    }
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, '[Membership] Failed to send resume email');
  }

  // In-app notification
  try {
    const resumeTier = await MembershipTier.findById(membership.tierId).lean();
    await createAndDeliverNotification({
      userId: membership.userId.toString(),
      type: 'membership_resumed',
      title: `${resumeTier?.displayName || 'Membership'} Resumed`,
      message: `Your ${resumeTier?.displayName || 'membership'} has been resumed. Auto-renewal is active and benefits remain until ${membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'the end of your billing period'}.`,
      priority: 'normal',
      channel: 'info',
      actionUrl: '/account/membership',
    });
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, '[Membership] Failed to send resume notification');
  }

  // Audit log
  await auditMembershipEvent({
    action: 'membership_resumed',
    eventType: 'membership.resumed',
    eventCategory: 'FINANCIAL',
    operationType: 'UPDATE',
    resourceType: 'UserMembership',
    resourceId: membership._id.toString(),
    outcome: 'SUCCESS',
    severity: 'HIGH',
    metadata: {
      userId,
      tierId: membership.tierId.toString(),
      previousCancelledAt,
      cancelAtPeriodEnd: false,
      autoRenew: true,
      benefitsUntil: membership.currentPeriodEnd,
      stripeSubscriptionId: membership.stripeSubscriptionId,
    },
  });

  return membership;
}

// ─── Keep my Membership ─────────────────────────────────────

/**
 * Keep my Membership — single customer action for cancelling members.
 *
 * Path A (benefits still active): no charge, original start/end dates.
 *   Local restore always; Stripe cancel_at_period_end cleared best-effort
 *   (if provider sub already ended, still keep the paid period locally).
 *
 * Path B (benefits exhausted): full current tier price via subscribeToTier.
 *   New period from payment date. Activate only after payment.
 *
 * Idempotent: double-click must not create duplicate memberships/charges.
 * Eligibility: cancelling members (cancelledAt or status cancelled), or
 * benefits-exhausted paid rejoin. Ordinary active non-cancelling members
 * who still have benefits get already_active — never force Path B.
 */
export async function keepMyMembership(userId: string): Promise<KeepMembershipResponseData> {
  const now = new Date();
  const operationId = `keep_${userId}_${now.getTime()}`;

  const membership = await UserMembership.findOne({
    userId,
    status: { $in: ['active', 'cancelled', 'pending_payment', 'expired'] },
  }).sort({ createdAt: -1 });

  if (!membership) {
    throw new MembershipTierChangeError(
      MEMBERSHIP_TIER_CHANGE_CODES.NO_ACTIVE_MEMBERSHIP,
      'No membership found to keep',
      'No membership found to keep. Please subscribe to join.',
    );
  }

  const tier = await MembershipTier.findById(membership.tierId).lean();
  if (!tier) {
    throw new MembershipTierChangeError(
      MEMBERSHIP_TIER_CHANGE_CODES.TIER_NOT_FOUND,
      'Membership tier not found',
      'Membership tier not found',
    );
  }

  const benefitsEnded =
    !membership.currentPeriodEnd || membership.currentPeriodEnd.getTime() <= now.getTime();
  const { requiresPayment } = requiresPaymentForKeep(membership, now);
  const cancelling = isCancellingMembership(membership);

  // Idempotent paid path: already waiting on payment
  if (membership.status === 'pending_payment' && membership.stripeSubscriptionId && !isFakeMode()) {
    try {
      const stripe = getStripeClient();
      const stripeSub = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId, {
        expand: ['latest_invoice.payment_intent'],
      });
      const clientSecret = (stripeSub.latest_invoice as any)?.payment_intent?.client_secret;
      if (clientSecret) {
        logger.info(
          { membershipId: membership._id, userId, operationId },
          '[Membership] Keep: already pending payment — returning existing client secret',
        );
        return {
          outcome: KEEP_MEMBERSHIP_OUTCOMES.PAYMENT_REQUIRED,
          membership,
          clientSecret,
          membershipId: String(membership._id),
          chargeAmount: membership.price,
          currency: membership.currency || tier.currency || STRIPE_CURRENCY_NZD.toUpperCase(),
          paymentRequired: true,
          tierDisplayName: tier.displayName,
          benefitsUntil: membership.currentPeriodEnd?.toISOString(),
        };
      }
    } catch (err) {
      logger.warn(
        { err, membershipId: membership._id, userId },
        '[Membership] Keep: failed to reload pending payment client secret',
      );
    }
  }

  // Idempotent free path: already active, not cancelling, benefits still ongoing
  if (membership.status === 'active' && !cancelling && !requiresPayment) {
    logger.info(
      { membershipId: membership._id, userId, operationId },
      '[Membership] Keep: already active — idempotent success',
    );
    return {
      outcome: KEEP_MEMBERSHIP_OUTCOMES.ALREADY_ACTIVE,
      membership,
      membershipId: String(membership._id),
      benefitsUntil: membership.currentPeriodEnd?.toISOString(),
      renewalDate: membership.currentPeriodEnd?.toISOString(),
      tierDisplayName: tier.displayName,
      preservedOriginalDates: true,
      paymentRequired: false,
      startDate: membership.currentPeriodStart?.toISOString() || membership.startDate?.toISOString(),
      endDate: membership.currentPeriodEnd?.toISOString(),
    };
  }

  // ── Path A — benefits still active: free restore, original dates ──
  if (!requiresPayment && cancelling) {
    const previousCancelledAt = membership.cancelledAt;

    // Stripe resume best-effort — free keep must not fail if provider sub is dead
    let stripeResumeStatus = 'skipped';
    if (membership.stripeSubscriptionId && !isFakeMode()) {
      try {
        const stripe = getStripeClient();
        if (isInvalidStripeSubscriptionId(membership.stripeSubscriptionId)) {
          stripeResumeStatus = 'invalid_subscription_id_local_keep';
          logger.warn(
            { membershipId: membership._id, userId, operationId },
            '[Membership] Keep: invalid Stripe subscription id — local keep for paid period',
          );
        } else {
          const subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);
          if (stripeSubscriptionEnded(subscription.status)) {
            stripeResumeStatus = 'subscription_ended_local_keep';
            logger.warn(
              {
                membershipId: membership._id,
                userId,
                operationId,
                stripeSubscriptionStatus: subscription.status,
              },
              '[Membership] Keep: Stripe subscription already ended — local keep for paid period',
            );
          } else {
            await stripe.subscriptions.update(membership.stripeSubscriptionId, {
              cancel_at_period_end: false,
            });
            stripeResumeStatus = 'resumed';
            logger.info(
              { membershipId: membership._id, stripeSubscriptionId: membership.stripeSubscriptionId },
              '[Membership] Keep: Stripe cancel_at_period_end cleared',
            );
          }
        }
      } catch (err) {
        stripeResumeStatus = 'stripe_error_local_keep';
        logger.warn(
          { err, membershipId: membership._id, userId, operationId },
          '[Membership] Keep: Stripe resume failed — local keep for paid period',
        );
      }
    } else {
      stripeResumeStatus = isFakeMode() ? 'fake_mode' : 'no_subscription';
    }

    // Local restore — preserve original start/end dates
    membership.cancelledAt = undefined;
    membership.cancellationReason = undefined;
    membership.autoRenew = true;
    membership.status = 'active';
    await membership.save();

    try {
      await User.findByIdAndUpdate(userId, {
        membershipTier: tier.tier,
        membershipId: membership._id,
      });
    } catch (err) {
      logger.error({ err, membershipId: membership._id }, '[Membership] Keep: failed to update user tier pointer');
    }

    try {
      const { membershipEntitlementService } = await import('./membership-entitlement.service');
      membershipEntitlementService.invalidateCache();
    } catch (err) {
      logger.warn({ err, membershipId: membership._id }, '[Membership] Keep: entitlement cache invalidate failed');
    }

    try {
      await removeMembershipFromTags(userId, membership._id.toString());
      await extendTagsForMembership(userId, membership._id.toString());
    } catch (err) {
      logger.error({ err, membershipId: membership._id }, '[Membership] Keep: tag re-eval failed');
    }

    const startDateStr =
      membership.currentPeriodStart?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) ||
      membership.startDate?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) ||
      'N/A';
    const endDateStr =
      membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A';

    // Email — membership-kept (free)
    try {
      const user = await User.findById(userId).select('email fullName').lean();
      if (user?.email) {
        const { renderMembershipKeptEmail } = await import('./email/templates/membership-kept');
        const { sendCmsEmailOrFallback } = await import('./email.service');
        const html = renderMembershipKeptEmail({
          customerName: user.fullName || 'there',
          tierName: tier.displayName,
          startDate: startDateStr,
          endDate: endDateStr,
          dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
        });
        await sendCmsEmailOrFallback({
          slug: 'membership-kept',
          to: user.email,
          vars: {
            customerName: user.fullName || 'there',
            tierName: tier.displayName,
            startDate: startDateStr,
            endDate: endDateStr,
            dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
          },
          fallbackSubject: 'Your membership is active again',
          fallbackHtml: html,
          businessFlow: 'subscriptions',
          relatedEntityType: 'membership',
          relatedEntityId: String(membership._id),
        }).catch((err) =>
          logger.error({ err, membershipId: membership._id }, '[Membership] Keep: email failed'),
        );
      }
    } catch (err) {
      logger.error({ err, membershipId: membership._id }, '[Membership] Keep: email failed');
    }

    try {
      await createAndDeliverNotification({
        userId: membership.userId.toString(),
        type: 'membership_resumed',
        title: `${tier.displayName} Membership Kept`,
        message: `Your ${tier.displayName} membership is active again. Benefits remain until ${endDateStr}. No charge was required.`,
        priority: 'normal',
        channel: 'info',
        actionUrl: '/account/membership',
      });
    } catch (err) {
      logger.error({ err, membershipId: membership._id }, '[Membership] Keep: notification failed');
    }

    await auditMembershipEvent({
      action: KEEP_MEMBERSHIP_AUDIT_ACTIONS.KEPT,
      eventType: 'membership.kept',
      eventCategory: 'FINANCIAL',
      operationType: 'UPDATE',
      resourceType: 'UserMembership',
      resourceId: membership._id.toString(),
      subjectUserId: membership.userId.toString(),
      outcome: 'SUCCESS',
      severity: 'HIGH',
      businessOperation: 'Customer kept membership from cancelling state',
      metadata: {
        userId,
        operationId,
        tierId: membership.tierId.toString(),
        tier: tier.tier,
        previousStatus: 'cancelling',
        newStatus: 'active',
        previousCancelledAt,
        paymentRequired: false,
        chargeAmount: 0,
        currency: membership.currency || 'NZD',
        preservedOriginalDates: true,
        startDate: membership.currentPeriodStart || membership.startDate,
        currentPeriodStart: membership.currentPeriodStart,
        currentPeriodEnd: membership.currentPeriodEnd,
        stripeSubscriptionId: membership.stripeSubscriptionId,
        stripeResumeStatus,
        autoRenewAfter: true,
        initiatedBy: 'customer',
      },
    });

    logger.info(
      {
        membershipId: membership._id,
        userId,
        operationId,
        stripeResumeStatus,
        benefitsUntil: membership.currentPeriodEnd,
        chargeAmount: 0,
      },
      '[Membership] Keep my membership completed (no charge, original dates)',
    );

    return {
      outcome: KEEP_MEMBERSHIP_OUTCOMES.RESUMED,
      membership,
      membershipId: String(membership._id),
      benefitsUntil: membership.currentPeriodEnd?.toISOString(),
      renewalDate: membership.currentPeriodEnd?.toISOString(),
      tierDisplayName: tier.displayName,
      preservedOriginalDates: true,
      paymentRequired: false,
      startDate: membership.currentPeriodStart?.toISOString() || membership.startDate?.toISOString(),
      endDate: membership.currentPeriodEnd?.toISOString(),
    };
  }

  // ── Path B — benefits exhausted: paid rejoin, new period from payment ──
  if (!requiresPayment) {
    // Cancelling but benefits still active should have hit Path A; safety net
    throw new MembershipTierChangeError(
      MEMBERSHIP_TIER_CHANGE_CODES.NOT_CANCELLING,
      'Membership keep path unexpected',
      'Unable to keep membership right now. Please try again or contact support.',
    );
  }

  // Close old membership before paid rejoin (keep original id in audit)
  if (membership.status === 'active' || membership.status === 'cancelled') {
    const previousStatus = membership.status;
    membership.status = 'expired';
    membership.autoRenew = false;
    membership.cancellationReason =
      membership.cancellationReason || 'Period ended before keep membership';
    await membership.save();

    await User.findByIdAndUpdate(userId, {
      membershipTier: null,
      membershipId: null,
    });

    try {
      const { membershipEntitlementService } = await import('./membership-entitlement.service');
      membershipEntitlementService.invalidateCache();
    } catch (err) {
      logger.warn({ err, membershipId: membership._id }, '[Membership] Keep paid: entitlement cache invalidate failed');
    }

    await auditMembershipEvent({
      action: 'membership_expired',
      eventType: 'membership.expired',
      eventCategory: 'FINANCIAL',
      operationType: 'UPDATE',
      resourceType: 'UserMembership',
      resourceId: membership._id.toString(),
      subjectUserId: membership.userId.toString(),
      outcome: 'SUCCESS',
      severity: 'HIGH',
      businessOperation: 'Keep membership — benefits ended, preparing paid rejoin',
      metadata: {
        userId,
        operationId,
        tierId: membership.tierId.toString(),
        previousStatus,
        reason: 'keep_membership_period_ended',
        benefitsUntil: membership.currentPeriodEnd,
        initiatedBy: 'customer',
      },
    });
  }

  // Full-price rejoin — reuse subscribe pipeline (authoritative tier price)
  const subscribeResult = await subscribeToTier(userId, membership.tierId.toString());
  const chargeAmount = subscribeResult.membership?.price ?? tier.price;
  const currency =
    (subscribeResult.membership?.currency as string | undefined) || tier.currency || 'NZD';
  const newPeriodEnd = subscribeResult.membership?.currentPeriodEnd;

  await auditMembershipEvent({
    action: KEEP_MEMBERSHIP_AUDIT_ACTIONS.REACTIVATED_PAID,
    eventType: 'membership.reactivated_paid',
    eventCategory: 'FINANCIAL',
    operationType: 'CREATE',
    resourceType: 'UserMembership',
    resourceId: String(subscribeResult.membership?._id || ''),
    subjectUserId: userId,
    outcome: 'SUCCESS',
    severity: 'HIGH',
    businessOperation: 'Keep membership after period ended — full price rejoin',
    metadata: {
      userId,
      operationId,
      tierId: membership.tierId.toString(),
      tier: tier.tier,
      paymentRequired: true,
      chargeAmount,
      currency,
      newPeriodEnd,
      previousMembershipId: membership._id.toString(),
      preservedOriginalDates: false,
      initiatedBy: 'customer',
    },
  });

  logger.info(
    {
      userId,
      operationId,
      tierId: membership.tierId.toString(),
      chargeAmount,
      membershipId: subscribeResult.membership?._id,
      hasClientSecret: Boolean(subscribeResult.clientSecret),
    },
    '[Membership] Keep my membership — paid rejoin created',
  );

  return {
    outcome: KEEP_MEMBERSHIP_OUTCOMES.PAYMENT_REQUIRED,
    membership: subscribeResult.membership,
    clientSecret: subscribeResult.clientSecret,
    membershipId: String(subscribeResult.membership?._id || ''),
    chargeAmount,
    currency,
    benefitsUntil: newPeriodEnd?.toISOString(),
    renewalDate: newPeriodEnd?.toISOString(),
    tierDisplayName: tier.displayName,
    preservedOriginalDates: false,
    paymentRequired: true,
  };
}

// ─── Estimate Tier Change (Proration Preview) ──────────────

export interface TierChangeEstimate {
  currentTier: { tier: string; displayName: string; price: number };
  newTier: { tier: string; displayName: string; price: number };
  remainingDays: number;
  totalDays: number;
  proratedAmount: number;
  currency: string;
  isUpgrade: boolean;
  /** ISO date string — frontend formats for display */
  renewalDate: string;
  /** For downgrades: estimated Guardian points that will be clawed back */
  pointsAtRisk: number;
  /** For downgrades: current Guardian points balance */
  currentPointsBalance: number;
  /** For downgrades: list of entitlements that will change (name, currentValue, newValue) */
  entitlementsLost: Array<{ key: string; name: string; currentValue: any; newValue: any }>;
  /** For downgrades: ISO date when the downgrade takes effect */
  downgradeEffectiveDate: string;
  /** Membership is in cancel-at-period-end window (cancelledAt set, status still active) */
  isCancelling: boolean;
  /**
   * Option A: confirming an immediate upgrade while cancelling also resumes
   * membership (clears cancel_at_period_end + cancelledAt, autoRenew on).
   */
  willResumeOnUpgrade: boolean;
}

/**
 * Calculate a proration estimate for a tier change.
 *
 * Returns raw data only — no pre-formatted strings. The frontend is
 * responsible for currency/date formatting and user-facing copy.
 *
 * For downgrades, additionally computes points-at-risk and entitlements-lost
 * so the customer can see exact consequences before accepting.
 */
export async function estimateTierChange(
  userId: string,
  newTierId: string,
): Promise<TierChangeEstimate> {
  const membership = await UserMembership.findOne({
    userId,
    status: 'active',
  });

  if (!membership) throw new Error('No active membership found');

  const newTier = await MembershipTier.findById(newTierId).lean();
  if (!newTier) throw new Error('Membership tier not found');
  if (!newTier.isActive) throw new Error('This membership tier is not currently available');

  const oldTier = await MembershipTier.findById(membership.tierId).lean();
  if (oldTier?.tier === newTier.tier) throw new Error('Already on this tier');

  const now = new Date();
  const periodStart = membership.currentPeriodStart || membership.startDate || now;
  const periodEnd = membership.currentPeriodEnd;

  const totalDays = Math.max(
    1,
    Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)),
  );
  const remainingDays = Math.max(
    0,
    Math.ceil((periodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
  );

  const priceDiff = newTier.price - (oldTier?.price || 0);
  const proratedAmount = Math.round(((priceDiff / totalDays) * remainingDays) * 100) / 100;
  const isUpgrade = priceDiff > 0;

  // Prefer tier currency, fall back to membership currency, then NZD
  const currency = newTier.currency || membership.currency || 'NZD';

  // Cancelling window: status remains 'active' until currentPeriodEnd, but
  // cancelledAt/autoRenew show scheduled cancel. Immediate upgrade resumes.
  const isCancelling = Boolean(membership.cancelledAt);
  const willResumeOnUpgrade = isUpgrade && isCancelling;

  // For downgrades: compute points-at-risk and entitlements-lost
  let pointsAtRisk = 0;
  let currentPointsBalance = 0;
  let entitlementsLost: Array<{ key: string; name: string; currentValue: any; newValue: any }> = [];

  if (!isUpgrade) {
    try {
      // Get Guardian points balance
      const user = await User.findById(userId).select('guardianPoints').lean();
      currentPointsBalance = user?.guardianPoints || 0;

      // Get points multipliers from entitlement registry
      const { membershipEntitlementService } = await import('./membership-entitlement.service');
      const oldMultiplier = Number(await membershipEntitlementService.getTierValue(oldTier?.tier || 'gold', 'points_multiplier') ?? 1) || 1;
      const newMultiplier = Number(await membershipEntitlementService.getTierValue(newTier.tier, 'points_multiplier') ?? 1) || 1;

      // Estimate points earned at higher multiplier rate
      // Formula: points_at_risk = floor(balance × (1 - newMultiplier/oldMultiplier))
      // This is an approximation — exact calculation requires ledger data (Phase 3)
      if (oldMultiplier > newMultiplier && currentPointsBalance > 0) {
        pointsAtRisk = Math.floor(currentPointsBalance * (1 - newMultiplier / oldMultiplier));
      }

      // Compare entitlements between tiers
      const oldEntitlements = await membershipEntitlementService.getTierEntitlements(oldTier?.tier || 'gold');
      const newEntitlements = await membershipEntitlementService.getTierEntitlements(newTier.tier);

      const allKeys = new Set([...Object.keys(oldEntitlements), ...Object.keys(newEntitlements)]);
      for (const key of allKeys) {
        const oldVal = oldEntitlements[key];
        const newVal = newEntitlements[key];
        const oldValue = oldVal?.value;
        const newValue = newVal?.value;

        // Only include if the value actually changes
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          entitlementsLost.push({
            key,
            name: oldVal?.name || newVal?.name || key,
            currentValue: oldValue,
            newValue,
          });
        }
      }
    } catch (err) {
      logger.warn({ err, userId, newTierId }, 'Failed to compute downgrade consequences — estimate will be partial');
    }
  }

  return {
    currentTier: {
      tier: oldTier?.tier || 'unknown',
      displayName: oldTier?.displayName || 'Unknown',
      price: oldTier?.price || 0,
    },
    newTier: {
      tier: newTier.tier,
      displayName: newTier.displayName,
      price: newTier.price,
    },
    remainingDays,
    totalDays,
    proratedAmount,
    currency,
    isUpgrade,
    renewalDate: periodEnd.toISOString(),
    pointsAtRisk,
    currentPointsBalance,
    entitlementsLost,
    downgradeEffectiveDate: isUpgrade ? '' : periodEnd.toISOString(),
    isCancelling,
    willResumeOnUpgrade,
  };
}

// ─── Change Tier ─────────────────────────────────────────────

/**
 * Generate the next membership invoice number (INVM-NNNNNN).
 * Uses the atomic counters collection — same pattern as activateMembership.
 */
async function nextMembershipInvoiceNumber(): Promise<string> {
  const counter = await UserMembership.db!.collection('counters').findOneAndUpdate(
    { _id: 'membershipInvoiceNumber' as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return `INVM-${String((counter as any)?.value?.seq || 1).padStart(6, '0')}`;
}

/**
 * Create a membership invoice document with idempotency.
 * Returns the invoice document, or an existing one if already created.
 */
async function createMembershipInvoice(params: {
  userId: mongoose.Types.ObjectId;
  membershipId: mongoose.Types.ObjectId;
  stripeSubscriptionId?: string;
  stripeInvoiceId?: string;
  amount: number;
  currency: string;
  billingPeriod: { start: Date; end: Date };
}): Promise<any> {
  // Idempotency: check by stripeInvoiceId (strongest key) or membership + subscription
  const existing = params.stripeInvoiceId
    ? await Invoice.findOne({ stripeInvoiceId: params.stripeInvoiceId })
    : await Invoice.findOne({
        userId: params.userId,
        userMembershipId: params.membershipId,
        stripeSubscriptionId: params.stripeSubscriptionId,
      });

  if (existing) {
    logger.info({ invoiceId: existing._id, stripeInvoiceId: params.stripeInvoiceId }, '[Membership] Invoice already exists, skipping creation');
    return existing;
  }

  const invoiceNumber = await nextMembershipInvoiceNumber();
  return Invoice.create({
    userId: params.userId,
    userMembershipId: params.membershipId,
    invoiceNumber,
    amount: params.amount,
    currency: params.currency,
    status: 'paid',
    stripeInvoiceId: params.stripeInvoiceId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    billingPeriod: params.billingPeriod,
    paidAt: new Date(),
  });
}

/**
 * Send invoice email with secure access link.
 * Follows the checkout pattern: static imports, tokenHash, logged errors.
 */
async function sendMembershipInvoiceEmail(invoice: any, userId: mongoose.Types.ObjectId): Promise<string | undefined> {
  const user = await User.findById(userId).select('email fullName').lean();
  if (!user?.email) return undefined;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const secureToken = generateSecureToken();
  const tokenHash = hashToken(secureToken);
  await InvoiceAccessToken.create({
    invoiceId: invoice._id,
    userId,
    tokenHash,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    verifiedAt: new Date(),
  });
  const invoiceUrl = `${frontendUrl}/account/invoices/${invoice.invoiceNumber}?token=${secureToken}`;

  const invoiceHtml = await generateInvoiceHtml(invoice._id.toString());
  await sendInvoiceEmail(user.email, user.fullName, invoice.invoiceNumber, invoiceHtml, invoiceUrl, invoice.amount)
    .catch((err) => logger.error({ err, invoiceId: invoice._id }, '[Membership] Failed to send invoice email'));

  return invoiceUrl;
}

interface ChangeTierValidationContext {
  membership: any;
  newTier: any;
  oldTier: any;
  resumedOnUpgrade: boolean;
}

function assertTierChangeAllowed(
  userId: string,
  newTierId: string,
  prorationBehavior: 'now' | 'next_billing_cycle',
): Promise<ChangeTierValidationContext> {
  return (async () => {
    const membership = await UserMembership.findOne({
      userId,
      status: 'active',
    });

    if (!membership) {
      throwMembershipTierError(
        MEMBERSHIP_TIER_CHANGE_CODES.NO_ACTIVE_MEMBERSHIP,
        'No active membership found',
        'No active membership found',
      );
    }

    const newTier = await MembershipTier.findById(newTierId).lean();
    if (!newTier) {
      throwMembershipTierError(
        MEMBERSHIP_TIER_CHANGE_CODES.TIER_NOT_FOUND,
        'Membership tier not found',
        'Membership tier not found',
      );
    }
    if (!newTier.isActive) {
      throwMembershipTierError(
        MEMBERSHIP_TIER_CHANGE_CODES.TIER_UNAVAILABLE,
        'This membership tier is not currently available',
        'This membership tier is not currently available',
      );
    }

    const oldTier = await MembershipTier.findById(membership.tierId).lean();
    if (oldTier?.tier === newTier.tier) {
      throwMembershipTierError(
        MEMBERSHIP_TIER_CHANGE_CODES.ALREADY_ON_TIER,
        'Already on this tier',
        'Already on this tier',
      );
    }

    const isCancelling = Boolean(membership.cancelledAt);
    const resumedOnUpgrade = isCancelling && prorationBehavior === 'now';

    return { membership, newTier, oldTier, resumedOnUpgrade };
  })();
}

async function resolveStripePriceIdForTier(stripe: Stripe, newTier: any, newTierId: string): Promise<string> {
  if (newTier.stripePriceId) return newTier.stripePriceId;

  const priceObj = await stripe.prices.create({
    product_data: {
      name: `${newTier.name} - Annual`,
      metadata: { tier: newTier.tier },
    },
    unit_amount: Math.round(newTier.price * 100),
    currency: STRIPE_CURRENCY_NZD,
    recurring: { interval: 'year' },
    metadata: { tier: newTier.tier },
  });
  await MembershipTier.findByIdAndUpdate(newTierId, { stripePriceId: priceObj.id });
  return priceObj.id;
}

async function applyStripeTierChange(params: {
  membership: any;
  newTier: any;
  oldTier: any;
  newTierId: string;
  prorationBehavior: 'now' | 'next_billing_cycle';
  resumedOnUpgrade: boolean;
}): Promise<{ prorationInvoiceId?: string; prorationAmount?: number; prorationCurrency?: string }> {
  const { membership, newTier, oldTier, newTierId, prorationBehavior, resumedOnUpgrade } = params;

  if (!membership.stripeSubscriptionId || isFakeMode()) {
    return {};
  }

  try {
    const stripe = getStripeClient();

    if (isInvalidStripeSubscriptionId(membership.stripeSubscriptionId)) {
      throwMembershipTierError(
        MEMBERSHIP_TIER_CHANGE_CODES.SUBSCRIPTION_MISSING,
        `Membership ${membership._id} has invalid Stripe subscription id`,
        'We could not find an active billing subscription for this membership. Please subscribe again or contact support.',
        { membershipId: membership._id.toString() },
      );
    }

    const newPriceId = await resolveStripePriceIdForTier(stripe, newTier, newTierId);
    const subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);

    if (stripeSubscriptionEnded(subscription.status)) {
      throwMembershipTierError(
        MEMBERSHIP_TIER_CHANGE_CODES.SUBSCRIPTION_NOT_ACTIVE,
        `Stripe subscription ${membership.stripeSubscriptionId} status=${subscription.status}`,
        'This membership subscription has already ended with the payment provider. Please subscribe again.',
        { stripeSubscriptionStatus: subscription.status },
      );
    }

    const subscriptionItemId = firstSubscriptionItemId(subscription);
    if (!subscriptionItemId) {
      throwMembershipTierError(
        MEMBERSHIP_TIER_CHANGE_CODES.SUBSCRIPTION_INVALID,
        `Stripe subscription ${membership.stripeSubscriptionId} has no billable items`,
        'This membership subscription is incomplete. Please contact support or subscribe again.',
        { stripeSubscriptionStatus: subscription.status },
      );
    }

    const updateParams: Stripe.SubscriptionUpdateParams = {
      items: [{ id: subscriptionItemId, price: newPriceId }],
      proration_behavior: prorationBehavior === 'now' ? 'create_prorations' : 'none',
      expand: ['latest_invoice'],
    };
    if (resumedOnUpgrade) {
      updateParams.cancel_at_period_end = false;
    }

    const updatedSubscription = await stripe.subscriptions.update(
      membership.stripeSubscriptionId,
      updateParams,
    );

    const latestInvoice = updatedSubscription.latest_invoice as any;
    let prorationInvoiceId: string | undefined;
    let prorationAmount: number | undefined;
    let prorationCurrency: string | undefined;
    if (latestInvoice && typeof latestInvoice === 'object') {
      prorationInvoiceId = latestInvoice.id;
      prorationAmount = (latestInvoice.amount_due || 0) / 100;
      prorationCurrency = (latestInvoice.currency || STRIPE_CURRENCY_NZD).toUpperCase();
    }

    logger.info(
      {
        membershipId: membership._id,
        oldTier: oldTier?.tier,
        newTier: newTier.tier,
        prorationBehavior,
        resumedOnUpgrade,
        prorationInvoiceId,
        prorationAmount,
        stripeSubscriptionStatus: subscription.status,
      },
      'Stripe subscription updated',
    );

    return { prorationInvoiceId, prorationAmount, prorationCurrency };
  } catch (err: any) {
    if (err instanceof MembershipTierChangeError) throw err;
    mapStripeSubscriptionFailure(err, membership._id.toString());
  }
}

async function applyLocalMembershipChange(params: {
  membership: any;
  newTier: any;
  userId: string;
  resumedOnUpgrade: boolean;
}): Promise<void> {
  const { membership, newTier, userId, resumedOnUpgrade } = params;
  membership.tierId = newTier._id;
  membership.price = newTier.price;
  if (resumedOnUpgrade) {
    membership.cancelledAt = undefined;
    membership.cancellationReason = undefined;
    membership.autoRenew = true;
  }
  await membership.save();
  await User.findByIdAndUpdate(userId, { membershipTier: newTier.tier });
}

async function runPostTierChangeEffects(params: {
  membership: any;
  userId: string;
  newTier: any;
  oldTier: any;
  prorationInvoiceId?: string;
  prorationAmount?: number;
  prorationCurrency?: string;
  resumedOnUpgrade: boolean;
}): Promise<{ invoice: any; invoiceUrl?: string }> {
  const {
    membership,
    userId,
    newTier,
    oldTier,
    prorationInvoiceId,
    prorationAmount,
    prorationCurrency,
    resumedOnUpgrade,
  } = params;

  try {
    await removeMembershipFromTags(userId, membership._id.toString());
    await extendTagsForMembership(userId, membership._id.toString());
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, '[Membership] Failed to re-evaluate tags after tier change');
  }

  let invoice: any = null;
  let invoiceUrl: string | undefined;
  if (prorationInvoiceId && prorationAmount && prorationAmount > 0) {
    try {
      invoice = await createMembershipInvoice({
        userId: membership.userId,
        membershipId: membership._id,
        stripeSubscriptionId: membership.stripeSubscriptionId,
        stripeInvoiceId: prorationInvoiceId,
        amount: prorationAmount,
        currency: prorationCurrency || membership.currency || 'NZD',
        billingPeriod: {
          start: membership.currentPeriodStart || new Date(),
          end: membership.currentPeriodEnd || new Date(),
        },
      });
      invoiceUrl = await sendMembershipInvoiceEmail(invoice, membership.userId);
    } catch (err) {
      logger.error({ err, membershipId: membership._id, stripeInvoiceId: prorationInvoiceId }, '[Membership] Failed to create/send upgrade invoice');
    }
  }

  try {
    const user = await User.findById(userId).select('email fullName').lean();
    if (user?.email) {
      const { renderMembershipTierChangedEmail } = await import('./email/templates/membership-tier-changed');
      const { sendCmsEmailOrFallback } = await import('./email.service');
      const renewalDate = membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A';
      const html = renderMembershipTierChangedEmail({
        customerName: user.fullName || 'there',
        oldTierName: oldTier?.displayName || 'Unknown',
        newTierName: newTier.displayName,
        newPrice: newTier.price,
        renewalDate,
        dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
      });
      await sendCmsEmailOrFallback({
        slug: 'membership-tier-changed',
        to: user.email,
        vars: {
          customerName: user.fullName || 'there',
          oldTierName: oldTier?.displayName || 'Unknown',
          newTierName: newTier.displayName,
          newPrice: String(newTier.price),
          renewalDate,
          dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
        },
        fallbackSubject: `Membership Changed to ${newTier.displayName}`,
        fallbackHtml: html,
        businessFlow: 'subscriptions',
        relatedEntityType: 'membership',
        relatedEntityId: String(membership._id),
      }).catch((err) => logger.error({ err, membershipId: membership._id }, '[Membership] Failed to send tier change email'));
    }
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, 'Failed to send tier change email');
  }

  try {
    const isUpgrade = newTier.price > (oldTier?.price || 0);
    await createAndDeliverNotification({
      userId: membership.userId.toString(),
      type: isUpgrade ? 'membership_upgraded' : 'membership_downgraded',
      title: isUpgrade ? `Welcome to ${newTier.displayName}!` : `Membership Changed to ${newTier.displayName}`,
      message: isUpgrade
        ? resumedOnUpgrade
          ? `Congratulations! You've upgraded to ${newTier.displayName} and your membership has been resumed. Enjoy your new benefits!`
          : `Congratulations! You've upgraded to ${newTier.displayName}. Enjoy your new benefits!`
        : `Your membership has changed to ${newTier.displayName}. Your new benefits are now active.`,
      priority: 'normal',
      channel: 'info',
      actionUrl: '/account/membership',
    });
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, '[Membership] Failed to send tier change notification');
  }

  await auditMembershipEvent({
    action: resumedOnUpgrade ? 'membership_tier_changed_resumed' : 'membership_tier_changed',
    eventType: resumedOnUpgrade ? 'membership.tier_changed_resumed' : 'membership.tier_changed',
    eventCategory: 'FINANCIAL',
    operationType: 'UPDATE',
    resourceType: 'UserMembership',
    resourceId: membership._id.toString(),
    subjectUserId: membership.userId.toString(),
    outcome: 'SUCCESS',
    severity: 'HIGH',
    metadata: {
      userId,
      oldTier: oldTier?.tier,
      newTier: newTier.tier,
      oldPrice: oldTier?.price,
      newPrice: newTier.price,
      prorationAmount: prorationAmount || 0,
      stripeInvoiceId: prorationInvoiceId || null,
      resumedOnUpgrade,
      cancelledAtCleared: resumedOnUpgrade,
      autoRenewAfter: resumedOnUpgrade ? true : membership.autoRenew,
    },
  });

  return { invoice, invoiceUrl };
}

/**
 * Change membership tier (immediate).
 * Cancelling members: Option A — upgrade also resumes after Stripe success.
 */
export async function changeTier(
  userId: string,
  newTierId: string,
  prorationBehavior: 'now' | 'next_billing_cycle' = 'now',
): Promise<{ membership: any; invoice: any; invoiceUrl?: string; resumedOnUpgrade: boolean }> {
  const { membership, newTier, oldTier, resumedOnUpgrade } = await assertTierChangeAllowed(
    userId,
    newTierId,
    prorationBehavior,
  );

  // Stripe mode: proration upgrades require a real subscription. Fail closed.
  if (
    !isFakeMode() &&
    prorationBehavior === 'now' &&
    isInvalidStripeSubscriptionId(membership.stripeSubscriptionId)
  ) {
    throwMembershipTierError(
      MEMBERSHIP_TIER_CHANGE_CODES.SUBSCRIPTION_MISSING,
      `Membership ${membership._id} has no valid Stripe subscription for tier change`,
      'We could not find an active billing subscription for this membership. Please subscribe again or contact support.',
      { membershipId: membership._id.toString() },
    );
  }

  const stripeResult = await applyStripeTierChange({
    membership,
    newTier,
    oldTier,
    newTierId,
    prorationBehavior,
    resumedOnUpgrade,
  });

  await applyLocalMembershipChange({
    membership,
    newTier,
    userId,
    resumedOnUpgrade,
  });

  const { invoice, invoiceUrl } = await runPostTierChangeEffects({
    membership,
    userId,
    newTier,
    oldTier,
    ...stripeResult,
    resumedOnUpgrade,
  });

  logger.info(
    {
      membershipId: membership._id,
      userId,
      resumedOnUpgrade,
      newTier: newTier.tier,
      prorationAmount: stripeResult.prorationAmount || 0,
    },
    '[Membership] Tier change completed',
  );

  return { membership, invoice, invoiceUrl, resumedOnUpgrade };
}

// ─── Repair upgrade (active membership + dead Stripe sub) ───

/**
 * Complete a paid repair upgrade after Stripe payment succeeds.
 * Membership may already be status 'active' (local benefits kept during payment).
 */
export async function completeRepairUpgrade(membership: any) {
  const targetTierId = membership.pendingTierId;
  if (!targetTierId) return membership;

  const newTier = await MembershipTier.findById(targetTierId).lean();
  if (!newTier) throw new Error('Membership tier not found');

  const oldTier = await MembershipTier.findById(membership.tierId).lean();
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  const previousTier = oldTier?.tier;
  const previousStripeSubscriptionId = membership.stripeSubscriptionId;
  const previousPrice = membership.price;

  membership.tierId = newTier._id;
  membership.price = newTier.price;
  membership.currentPeriodStart = now;
  membership.currentPeriodEnd = periodEnd;
  membership.startDate = membership.startDate || now;
  membership.status = 'active';
  membership.autoRenew = true;
  membership.cancelledAt = undefined;
  membership.cancellationReason = undefined;
  membership.pendingTierId = undefined;
  membership.pendingTierEffectiveAt = undefined;
  membership.downgradeRequestedAt = undefined;
  membership.downgradeTermsAcceptedAt = undefined;
  membership.downgradeTermsVersion = undefined;
  membership.downgradeReason = undefined;
  membership.downgradeCancelledAt = undefined;
  membership.dunningStatus = 'active';
  await membership.save();

  await User.findByIdAndUpdate(membership.userId, {
    membershipTier: newTier.tier,
    membershipId: membership._id,
  });

  try {
    const { membershipEntitlementService } = await import('./membership-entitlement.service');
    membershipEntitlementService.invalidateCache();
  } catch (err) {
    logger.warn({ err, membershipId: membership._id }, '[Membership] Repair upgrade: cache invalidate failed');
  }

  try {
    await removeMembershipFromTags(String(membership.userId), membership._id.toString());
    await extendTagsForMembership(String(membership.userId), membership._id.toString());
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, '[Membership] Repair upgrade: tag re-eval failed');
  }

  let invoice: any = null;
  if (membership.stripeSubscriptionId && !isFakeMode()) {
    try {
      const stripe = getStripeClient();
      const stripeSub = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId, {
        expand: ['latest_invoice'],
      });
      const latestInvoice = stripeSub.latest_invoice as any;
      if (latestInvoice?.id && latestInvoice.amount_due) {
        invoice = await createMembershipInvoice({
          userId: membership.userId,
          membershipId: membership._id,
          stripeSubscriptionId: membership.stripeSubscriptionId,
          stripeInvoiceId: latestInvoice.id,
          amount: (latestInvoice.amount_due || 0) / 100,
          currency: (latestInvoice.currency || STRIPE_CURRENCY_NZD).toUpperCase(),
          billingPeriod: { start: membership.currentPeriodStart, end: membership.currentPeriodEnd },
        });
      }
    } catch (err) {
      logger.error({ err, membershipId: membership._id }, '[Membership] Repair upgrade: invoice failed');
    }
  }

  try {
    const user = await User.findById(membership.userId).select('email fullName').lean();
    if (user?.email) {
      const { renderMembershipTierChangedEmail } = await import('./email/templates/membership-tier-changed');
      const { sendCmsEmailOrFallback } = await import('./email.service');
      const renewalDate = membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A';
      const html = renderMembershipTierChangedEmail({
        customerName: user.fullName || 'there',
        oldTierName: oldTier?.displayName || 'Unknown',
        newTierName: newTier.displayName,
        newPrice: newTier.price,
        renewalDate,
        dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
      });
      await sendCmsEmailOrFallback({
        slug: 'membership-tier-changed',
        to: user.email,
        vars: {
          customerName: user.fullName || 'there',
          oldTierName: oldTier?.displayName || 'Unknown',
          newTierName: newTier.displayName,
          newPrice: String(newTier.price),
          renewalDate,
          dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
        },
        fallbackSubject: `Membership Upgraded to ${newTier.displayName}`,
        fallbackHtml: html,
        businessFlow: 'subscriptions',
        relatedEntityType: 'membership',
        relatedEntityId: String(membership._id),
      }).catch((err) => logger.error({ err, membershipId: membership._id }, '[Membership] Repair upgrade: email failed'));
    }
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, '[Membership] Repair upgrade: email failed');
  }

  try {
    await createAndDeliverNotification({
      userId: membership.userId.toString(),
      type: 'membership_upgraded',
      title: `Welcome to ${newTier.displayName}!`,
      message: `Your membership is now ${newTier.displayName}. A new billing period starts today.`,
      priority: 'normal',
      channel: 'info',
      actionUrl: '/account/membership',
    });
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, '[Membership] Repair upgrade: notification failed');
  }

  await auditMembershipEvent({
    action: 'membership_upgrade_repaired',
    eventType: 'membership.tier_upgraded_paid',
    eventCategory: 'FINANCIAL',
    operationType: 'UPDATE',
    resourceType: 'UserMembership',
    resourceId: membership._id.toString(),
    subjectUserId: String(membership.userId),
    outcome: 'SUCCESS',
    severity: 'HIGH',
    businessOperation: 'Paid repair upgrade — Stripe sub was dead/missing',
    metadata: {
      userId: String(membership.userId),
      previousTier,
      newTier: newTier.tier,
      previousPrice,
      newPrice: newTier.price,
      previousStripeSubscriptionId,
      stripeSubscriptionId: membership.stripeSubscriptionId,
      chargeAmount: newTier.price,
      newPeriodStart: membership.currentPeriodStart,
      newPeriodEnd: membership.currentPeriodEnd,
      reason: 'stripe_subscription_ended',
    },
  });

  logger.info(
    {
      membershipId: membership._id,
      userId: membership.userId,
      previousTier,
      newTier: newTier.tier,
      newPeriodEnd: membership.currentPeriodEnd,
    },
    '[Membership] Repair upgrade completed after payment',
  );

  return membership;
}

/**
 * Active local membership + dead/missing Stripe sub.
 * Charges full target-tier price (no proration). Local benefits stay active
 * until payment succeeds. New period starts after payment.
 */
export async function repairUpgradeToTier(
  userId: string,
  targetTierId: string,
): Promise<RepairUpgradeResponseData> {
  const membership = await UserMembership.findOne({ userId, status: 'active' });
  if (!membership) {
    throw new MembershipTierChangeError(
      MEMBERSHIP_TIER_CHANGE_CODES.NO_ACTIVE_MEMBERSHIP,
      'No active membership found for repair upgrade',
      'No active membership found. Please subscribe to join.',
    );
  }

  const newTier = await MembershipTier.findById(targetTierId).lean();
  if (!newTier) {
    throw new MembershipTierChangeError(
      MEMBERSHIP_TIER_CHANGE_CODES.TIER_NOT_FOUND,
      'Membership tier not found',
      'Membership tier not found',
    );
  }
  if (!newTier.isActive) {
    throw new MembershipTierChangeError(
      MEMBERSHIP_TIER_CHANGE_CODES.TIER_UNAVAILABLE,
      'This membership tier is not currently available',
      'This membership tier is not currently available',
    );
  }

  const oldTier = await MembershipTier.findById(membership.tierId).lean();
  if (oldTier?.tier === newTier.tier) {
    throw new MembershipTierChangeError(
      MEMBERSHIP_TIER_CHANGE_CODES.ALREADY_ON_TIER,
      'Already on this tier',
      'Already on this tier',
    );
  }

  const previousStripeSubscriptionId = membership.stripeSubscriptionId;

  // Idempotent: already waiting on payment for this target tier
  if (membership.pendingTierId && String(membership.pendingTierId) === String(newTier._id)) {
    if (!isFakeMode() && membership.stripeSubscriptionId && !isInvalidStripeSubscriptionId(membership.stripeSubscriptionId)) {
      try {
        const stripe = getStripeClient();
        const stripeSub = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId, {
          expand: ['latest_invoice.payment_intent'],
        });
        const clientSecret = (stripeSub.latest_invoice as any)?.payment_intent?.client_secret;
        if (clientSecret) {
          return {
            clientSecret,
            membershipId: String(membership._id),
            chargeAmount: newTier.price,
            currency: newTier.currency || STRIPE_CURRENCY_NZD.toUpperCase(),
            tierDisplayName: newTier.displayName,
            membershipStatus: membership.status,
          };
        }
      } catch (err) {
        logger.warn({ err, membershipId: membership._id }, '[Membership] Repair upgrade: reload pending payment failed');
      }
    }
  }

  const currency = newTier.currency || STRIPE_CURRENCY_NZD.toUpperCase();
  const chargeAmount = newTier.price;

  if (isFakeMode()) {
    membership.tierId = newTier._id;
    membership.price = chargeAmount;
    membership.pendingTierId = undefined;
    membership.autoRenew = true;
    membership.cancelledAt = undefined;
    await membership.save();
    await User.findByIdAndUpdate(userId, { membershipTier: newTier.tier, membershipId: membership._id });
    try {
      const { membershipEntitlementService } = await import('./membership-entitlement.service');
      membershipEntitlementService.invalidateCache();
    } catch {
      /* ignore */
    }
    await auditMembershipEvent({
      action: 'membership_upgrade_repaired',
      eventType: 'membership.tier_upgraded_paid',
      eventCategory: 'FINANCIAL',
      operationType: 'UPDATE',
      resourceType: 'UserMembership',
      resourceId: membership._id.toString(),
      subjectUserId: userId,
      outcome: 'SUCCESS',
      severity: 'HIGH',
      businessOperation: 'Fake-mode repair upgrade (no Stripe charge)',
      metadata: {
        userId,
        newTier: newTier.tier,
        chargeAmount: 0,
        reason: 'fake_mode_repair_upgrade',
      },
    });
    return {
      clientSecret: '',
      membershipId: String(membership._id),
      chargeAmount,
      currency,
      tierDisplayName: newTier.displayName,
      membershipStatus: 'active',
    };
  }

  if (!membership.stripeCustomerId) {
    const user = await User.findById(userId).select('email fullName stripeCustomerId').lean();
    if (!user) throw new Error('User not found');
    if (!user.stripeCustomerId) {
      const stripe = getStripeClient();
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName || undefined,
        metadata: { userId: userId.toString(), source: 'pawtag-membership-repair' },
      });
      await User.findByIdAndUpdate(userId, { stripeCustomerId: customer.id });
      membership.stripeCustomerId = customer.id;
    } else {
      membership.stripeCustomerId = user.stripeCustomerId;
    }
  }

  const stripe = getStripeClient();
  const priceId = await resolveStripePriceIdForTier(stripe, newTier, String(newTier._id));
  const { getDefaultPaymentMethodIdForUser } = await import('./payment-method.service');
  const defaultPaymentMethodId = await getDefaultPaymentMethodIdForUser(userId).catch(() => null);

  const stripeSub = await stripe.subscriptions.create({
    customer: membership.stripeCustomerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    ...(defaultPaymentMethodId ? { default_payment_method: defaultPaymentMethodId } : {}),
    metadata: {
      userId: userId.toString(),
      membershipId: String(membership._id),
      purpose: 'membership_repair_upgrade',
      targetTier: newTier.tier,
    },
    expand: ['latest_invoice.payment_intent'],
  });

  const latestInvoice = stripeSub.latest_invoice as any;
  let clientSecret = latestInvoice?.payment_intent?.client_secret;
  if (!clientSecret && stripeSub.latest_invoice) {
    const inv = (await stripe.invoices.retrieve(String(stripeSub.latest_invoice))) as any;
    if (inv.amount_due && inv.payment_intent) {
      const pi = await stripe.paymentIntents.retrieve(String(inv.payment_intent));
      clientSecret = pi.client_secret || undefined;
    }
  }
  if (!clientSecret) {
    try {
      await stripe.subscriptions.cancel(stripeSub.id);
    } catch {
      /* best-effort cleanup */
    }
    throw new Error('Unable to initialize payment for membership upgrade. Please try again.');
  }

  membership.pendingTierId = newTier._id as any;
  membership.stripeSubscriptionId = stripeSub.id;
  membership.autoRenew = false;
  await membership.save();

  await auditMembershipEvent({
    action: 'membership_upgrade_repair_started',
    eventType: 'membership.tier_upgrade_repair_started',
    eventCategory: 'FINANCIAL',
    operationType: 'UPDATE',
    resourceType: 'UserMembership',
    resourceId: membership._id.toString(),
    subjectUserId: userId,
    outcome: 'SUCCESS',
    severity: 'HIGH',
    businessOperation: 'Repair upgrade payment started — full target tier price',
    metadata: {
      userId,
      targetTierId: String(newTier._id),
      targetTier: newTier.tier,
      chargeAmount,
      currency,
      stripeSubscriptionId: stripeSub.id,
      previousStripeSubscriptionId,
      reason: 'stripe_subscription_ended',
    },
  });

  logger.info(
    {
      membershipId: membership._id,
      userId,
      targetTier: newTier.tier,
      chargeAmount,
      stripeSubscriptionId: stripeSub.id,
      hasClientSecret: Boolean(clientSecret),
    },
    '[Membership] Repair upgrade payment created (full tier price)',
  );

  return {
    clientSecret,
    membershipId: String(membership._id),
    chargeAmount,
    currency,
    tierDisplayName: newTier.displayName,
    membershipStatus: membership.status,
    newPeriodStart: new Date().toISOString(),
  };
}

// ─── Request Downgrade (Deferred) ────────────────────────────

export interface DowngradeRequestParams {
  tierId: string;
  reason?: string;
  termsAccepted: boolean;
  termsVersion: string;
}

/**
 * Request a deferred downgrade. The customer's current tier remains active
 * until currentPeriodEnd. The pending tier takes effect at renewal.
 *
 * Business rules:
 * - Downgrade is effective at end of current subscription cycle (not immediate)
 * - Customer must explicitly accept terms (points loss, entitlements lost)
 * - Guardian points clawback is applied when the downgrade executes
 * - Stripe subscription price is updated so renewal charges the new tier price
 */
export async function requestDowngrade(userId: string, params: DowngradeRequestParams) {
  const { tierId, reason, termsAccepted, termsVersion } = params;

  if (!termsAccepted) {
    throw new Error('You must accept the downgrade terms to proceed');
  }

  const membership = await UserMembership.findOne({
    userId,
    status: 'active',
  });

  if (!membership) throw new Error('No active membership found');

  // Cannot downgrade if already pending
  if (membership.pendingTierId) {
    throw new Error('A downgrade is already scheduled for your membership');
  }

  const newTier = await MembershipTier.findById(tierId).lean();
  if (!newTier) throw new Error('Membership tier not found');
  if (!newTier.isActive) throw new Error('This membership tier is not currently available');

  const oldTier = await MembershipTier.findById(membership.tierId).lean();
  if (oldTier?.tier === newTier.tier) throw new Error('Already on this tier');

  // Validate this is actually a downgrade (new tier is lower)
  if ((newTier.displayOrder || 0) > (oldTier?.displayOrder || 0)) {
    throw new Error('This is an upgrade, not a downgrade. Use the upgrade flow instead.');
  }

  // Update Stripe subscription price so renewal charges the new tier.
  // Use proration_behavior: 'create_prorations' — Stripe creates a credit
  // item that applies to the next renewal invoice.
  if (membership.stripeSubscriptionId && !isFakeMode()) {
    try {
      const stripe = getStripeClient();

      // Get or create price for new tier
      let newPriceId = newTier.stripePriceId;
      if (!newPriceId) {
        const priceObj = await stripe.prices.create({
          product_data: {
            name: `${newTier.name} - Annual`,
            metadata: { tier: newTier.tier },
          },
          unit_amount: Math.round(newTier.price * 100),
          currency: 'nzd',
          recurring: { interval: 'year' },
          metadata: { tier: newTier.tier },
        });
        newPriceId = priceObj.id;
        await MembershipTier.findByIdAndUpdate(tierId, { stripePriceId: priceObj.id });
      }

      const subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);
      await stripe.subscriptions.update(membership.stripeSubscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: newPriceId,
        }],
        proration_behavior: 'create_prorations',
      });

      logger.info({
        membershipId: membership._id,
        oldTier: oldTier?.tier,
        newTier: newTier.tier,
      }, 'Stripe subscription price updated for deferred downgrade');
    } catch (err) {
      logger.error({ err, membershipId: membership._id }, 'Failed to update Stripe subscription for downgrade');
      throw new Error('Failed to update payment subscription. Please try again or contact support.');
    }
  }

  // Record pending downgrade — current tier remains active
  membership.pendingTierId = newTier._id;
  membership.pendingTierEffectiveAt = membership.currentPeriodEnd;
  membership.downgradeRequestedAt = new Date();
  membership.downgradeTermsAcceptedAt = new Date();
  membership.downgradeTermsVersion = termsVersion;
  membership.downgradeReason = reason;
  await membership.save();

  // Send downgrade-scheduled email
  try {
    const user = await User.findById(userId).select('email fullName').lean();
    if (user?.email && oldTier && newTier) {
      const { sendMail } = await import('./email.service');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const effectiveDate = membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A';

      const html = `
        <p>Hi ${user.fullName || 'there'},</p>
        <p>Your downgrade from <strong>${oldTier.displayName}</strong> to <strong>${newTier.displayName}</strong> has been scheduled.</p>
        <p><strong>Effective date:</strong> ${effectiveDate}</p>
        <p>Until then, you'll continue to enjoy your ${oldTier.displayName} benefits. At renewal, your membership will switch to ${newTier.displayName} at $${newTier.price}/year.</p>
        <p><a href="${frontendUrl}/account/membership">View Your Membership</a></p>
      `;
      await sendMail(user.email, `Downgrade to ${newTier.displayName} Scheduled`, html)
        .catch((err) => logger.error({ err, membershipId: membership._id }, '[Membership] Failed to send downgrade-scheduled email'));
    }
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, '[Membership] Failed to send downgrade-scheduled email');
  }

  // In-app notification
  try {
    await createAndDeliverNotification({
      userId: membership.userId.toString(),
      type: 'membership_downgrade_scheduled',
      title: `Downgrade to ${newTier.displayName} Scheduled`,
      message: `Your downgrade to ${newTier.displayName} will take effect on ${membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'medium' }) || 'renewal'}. Your current benefits remain until then.`,
      priority: 'normal',
      channel: 'info',
      actionUrl: '/account/membership',
    });
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, '[Membership] Failed to send downgrade notification');
  }

  // Audit log
  await auditMembershipEvent({
    action: 'membership_downgrade_requested',
    eventType: 'membership.downgrade_requested',
    eventCategory: 'FINANCIAL',
    operationType: 'UPDATE',
    resourceType: 'UserMembership',
    resourceId: membership._id.toString(),
    outcome: 'SUCCESS',
    severity: 'HIGH',
    metadata: {
      userId,
      oldTier: oldTier?.tier,
      newTier: newTier.tier,
      pendingTierEffectiveAt: membership.pendingTierEffectiveAt,
      termsVersion,
      reason: reason || 'Customer request',
    },
  });

  return membership;
}

// ─── Cancel Pending Downgrade ────────────────────────────────

export async function cancelPendingDowngrade(userId: string) {
  const membership = await UserMembership.findOne({
    userId,
    status: 'active',
    pendingTierId: { $ne: null },
  });

  if (!membership) throw new Error('No pending downgrade found');

  membership.pendingTierId = undefined;
  membership.pendingTierEffectiveAt = undefined;
  membership.downgradeCancelledAt = new Date();
  await membership.save();

  logger.info({ membershipId: membership._id }, 'Pending downgrade cancelled');

  // Audit log
  await auditMembershipEvent({
    action: 'membership_downgrade_cancelled',
    eventType: 'membership.downgrade_cancelled',
    eventCategory: 'UPDATE',
    operationType: 'UPDATE',
    resourceType: 'UserMembership',
    resourceId: membership._id.toString(),
    outcome: 'SUCCESS',
    severity: 'MEDIUM',
    metadata: { userId },
  });

  return membership;
}

// ─── Extend Membership (Admin) ───────────────────────────────

export async function extendMembership(
  membershipId: string,
  adminId: string,
  extensionType: 'charge' | 'grace',
  extensionDays: number = 30,
) {
  const membership = await UserMembership.findById(membershipId);
  if (!membership) throw new Error('Membership not found');

  // Check if grace was already used for this user/tag combination
  if (extensionType === 'grace' && membership.adminExtensionGraceUsed) {
    throw new Error('Grace period already used for this membership');
  }

  const oldPeriodEnd = membership.currentPeriodEnd;
  const newPeriodEnd = new Date(membership.currentPeriodEnd);
  newPeriodEnd.setDate(newPeriodEnd.getDate() + extensionDays);

  membership.currentPeriodEnd = newPeriodEnd;
  membership.lastAdminExtensionAt = new Date();
  membership.adminExtensionCount = (membership.adminExtensionCount || 0) + 1;

  if (extensionType === 'grace') {
    membership.adminExtensionGraceUsed = true;
  }

  // If membership was expired, reactivate it
  if (membership.status === 'expired') {
    membership.status = 'active';
    const tier = await MembershipTier.findById(membership.tierId).lean();
    if (tier) {
      await User.findByIdAndUpdate(membership.userId, {
        membershipTier: tier.tier,
        membershipId: membership._id,
      });
    }
  }

  await membership.save();

  // Send extension email
  try {
    const user = await User.findById(membership.userId).select('email fullName').lean();
    const tier = await MembershipTier.findById(membership.tierId).lean();
    if (user?.email && tier) {
      const { renderMembershipExtendedEmail } = await import('./email/templates/membership-extended');
      const html = renderMembershipExtendedEmail({
        customerName: user.fullName || 'there',
        tierName: tier.displayName,
        extensionType,
        extensionDays,
        newPeriodEnd: newPeriodEnd.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A',
        dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
      });
      await sendMail(user.email, `Your ${tier.name} Has Been Extended`, html).catch(() => {});
    }
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, 'Failed to send extension email');
  }

  // In-app notification
  try {
    const extendTier = await MembershipTier.findById(membership.tierId).lean();
    await createAndDeliverNotification({
      userId: membership.userId.toString(),
      type: 'membership_extended',
      title: `${extendTier?.displayName || 'Membership'} Extended`,
      message: `Your ${extendTier?.displayName || 'membership'} has been extended by ${extensionDays} days. New period ends ${newPeriodEnd.toLocaleDateString('en-NZ', { dateStyle: 'full' })}.`,
      priority: 'normal',
      channel: 'info',
      actionUrl: '/account/membership',
    });
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, '[Membership] Failed to send extension notification');
  }

  // Audit log
  await auditMembershipEvent({
    action: 'membership_extended',
    eventType: 'membership.extended',
    eventCategory: 'UPDATE',
    operationType: 'UPDATE',
    resourceType: 'UserMembership',
    resourceId: membership._id.toString(),
    outcome: 'SUCCESS',
    severity: 'HIGH',
    metadata: {
      userId: membership.userId.toString(),
      adminId,
      extensionType,
      extensionDays,
      oldPeriodEnd,
      newPeriodEnd,
    },
  });

  return membership;
}

// ─── Process Scheduled Downgrades ────────────────────────────

/**
 * Execute pending downgrades whose effective date has arrived.
 *
 * This job runs alongside checkExpiredMemberships. For each membership
 * with a pendingTierId whose pendingTierEffectiveAt has passed:
 *
 * 1. Verify the Stripe renewal succeeded (period was extended)
 * 2. If renewal succeeded: flip tier, apply points clawback, extend period
 * 3. If renewal failed: keep current tier, notify customer
 * 4. Invalidate entitlement cache
 * 5. Send downgrade-executed email
 * 6. Audit log
 *
 * The points clawback is a Phase 3 item — for now, the tier flip and
 * period extension happen. Points clawback will be wired in Phase 3.
 */
export async function processScheduledDowngrades() {
  const now = new Date();
  const pendingDowngrades = await UserMembership.find({
    status: 'active',
    pendingTierId: { $ne: null },
    pendingTierEffectiveAt: { $lte: now },
  });

  let processed = 0;
  let failed = 0;

  for (const membership of pendingDowngrades) {
    try {
      const oldTier = await MembershipTier.findById(membership.tierId).lean();
      const newTier = await MembershipTier.findById(membership.pendingTierId).lean();

      if (!newTier) {
        logger.error({ membershipId: membership._id, pendingTierId: membership.pendingTierId }, 'Pending tier not found — skipping downgrade');
        continue;
      }

      // Check if the membership period was extended (renewal succeeded)
      // If currentPeriodEnd is still in the past, renewal failed
      const renewalSucceeded = membership.currentPeriodEnd > now;

      if (!renewalSucceeded) {
        // Renewal failed — keep current tier, notify customer
        logger.warn({
          membershipId: membership._id,
          currentPeriodEnd: membership.currentPeriodEnd,
          dunningStatus: membership.dunningStatus,
        }, 'Renewal failed — downgrade not executed, keeping current tier');

        // Clear pending state — downgrade cannot proceed without renewal
        membership.pendingTierId = undefined;
        membership.pendingTierEffectiveAt = undefined;
        await membership.save();

        // Notify customer
        try {
          const user = await User.findById(membership.userId).select('email fullName').lean();
          if (user?.email) {
            const { sendMail } = await import('./email.service');
            const html = `
              <p>Hi ${user.fullName || 'there'},</p>
              <p>Your scheduled downgrade to <strong>${newTier.displayName}</strong> could not be completed because your membership renewal payment failed.</p>
              <p>Your current ${oldTier?.displayName || 'membership'} benefits remain active. Please update your payment method to keep your membership active.</p>
              <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership">Update Payment Method</a></p>
            `;
            await sendMail(user.email, `Downgrade to ${newTier.displayName} Not Completed`, html)
              .catch((err) => logger.error({ err, membershipId: membership._id }, 'Failed to send downgrade-failed email'));
          }
        } catch (err) {
          logger.error({ err, membershipId: membership._id }, 'Failed to send downgrade-failed email');
        }

        failed++;
        continue;
      }

      // Renewal succeeded — execute the downgrade
      const previousTierId = membership.tierId;
      const previousPrice = membership.price;

      membership.tierId = newTier._id;
      membership.price = newTier.price;
      membership.pendingTierId = undefined;
      membership.pendingTierEffectiveAt = undefined;
      membership.downgradeCancelledAt = undefined;
      await membership.save();

      // Update User.membershipTier
      await User.findByIdAndUpdate(membership.userId, {
        membershipTier: newTier.tier,
      });

      // Re-evaluate tag coverage for new tier limit
      try {
        await removeMembershipFromTags(membership.userId.toString(), membership._id.toString());
        await extendTagsForMembership(membership.userId.toString(), membership._id.toString());
      } catch (err) {
        logger.error({ err, membershipId: membership._id }, 'Failed to re-evaluate tags after downgrade execution');
      }

      // Apply Guardian Points clawback (Phase 3)
      try {
        const { applyDowngradePointsClawback } = await import('./loyalty/points-earning.service');
        const { membershipEntitlementService } = await import('./membership-entitlement.service');
        const oldMultiplier = Number(await membershipEntitlementService.getTierValue(oldTier?.tier || 'gold', 'points_multiplier') ?? 1) || 1;
        const newMultiplier = Number(await membershipEntitlementService.getTierValue(newTier.tier, 'points_multiplier') ?? 1) || 1;

        if (oldMultiplier > newMultiplier) {
          const clawbackResult = await applyDowngradePointsClawback(
            membership.userId.toString(),
            oldMultiplier,
            newMultiplier,
            membership._id.toString(),
          );
          logger.info({
            membershipId: membership._id,
            ...clawbackResult,
          }, 'Points clawback applied during downgrade execution');
        }

        // Invalidate entitlement cache
        membershipEntitlementService.invalidateCache();
      } catch (err) {
        logger.error({ err, membershipId: membership._id }, 'Failed to apply points clawback during downgrade execution');
      }

      // Send downgrade-executed email
      try {
        const user = await User.findById(membership.userId).select('email fullName').lean();
        if (user?.email) {
          const { sendMail } = await import('./email.service');
          const html = `
            <p>Hi ${user.fullName || 'there'},</p>
            <p>Your membership is now <strong>${newTier.displayName}</strong>. Your new benefits are active.</p>
            <p><strong>New plan:</strong> ${newTier.displayName} — $${newTier.price}/year</p>
            <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership">View Your Membership</a></p>
          `;
          await sendMail(user.email, `Membership Changed to ${newTier.displayName}`, html)
            .catch((err) => logger.error({ err, membershipId: membership._id }, 'Failed to send downgrade-executed email'));
        }
      } catch (err) {
        logger.error({ err, membershipId: membership._id }, 'Failed to send downgrade-executed email');
      }

      // In-app notification
      try {
        await createAndDeliverNotification({
          userId: membership.userId.toString(),
          type: 'membership_downgraded',
          title: `Membership Changed to ${newTier.displayName}`,
          message: `Your membership has been changed to ${newTier.displayName}. Your new benefits are now active.`,
          priority: 'normal',
          channel: 'info',
          actionUrl: '/account/membership',
        });
      } catch (err) {
        logger.error({ err, membershipId: membership._id }, 'Failed to send downgrade notification');
      }

      // Audit log
      await auditMembershipEvent({
        action: 'membership_downgrade_executed',
        eventType: 'membership.downgrade_executed',
        eventCategory: 'FINANCIAL',
        operationType: 'UPDATE',
        resourceType: 'UserMembership',
        resourceId: membership._id.toString(),
        outcome: 'SUCCESS',
        severity: 'HIGH',
        metadata: {
          userId: membership.userId.toString(),
          oldTier: oldTier?.tier,
          newTier: newTier.tier,
          oldPrice: previousPrice,
          newPrice: newTier.price,
          requestedAt: membership.downgradeRequestedAt,
        },
      });

      logger.info({
        membershipId: membership._id,
        oldTier: oldTier?.tier,
        newTier: newTier.tier,
      }, 'Scheduled downgrade executed successfully');

      processed++;
    } catch (err) {
      logger.error({ err, membershipId: membership._id }, 'Failed to process scheduled downgrade');
      failed++;
    }
  }

  logger.info({ processed, failed, total: pendingDowngrades.length }, 'Scheduled downgrade processing complete');
  return { processed, failed, total: pendingDowngrades.length };
}

// ─── Check Expired Memberships ───────────────────────────────

export async function checkExpiredMemberships() {
  const now = new Date();
  const expiredMemberships = await UserMembership.find({
    status: 'active',
    currentPeriodEnd: { $lte: now },
  });

  for (const membership of expiredMemberships) {
    membership.status = 'expired';
    await membership.save();

    // Update user
    await User.findByIdAndUpdate(membership.userId, {
      membershipTier: null,
      membershipId: null,
    });

    // Send expiry email
    try {
      const user = await User.findById(membership.userId).select('email fullName').lean();
      const tier = await MembershipTier.findById(membership.tierId).lean();
      if (user?.email && tier) {
        const { renderMembershipExpiredEmail } = await import('./email/templates/membership-expired');
        const { sendCmsEmailOrFallback } = await import('./email.service');
        const html = renderMembershipExpiredEmail({
          customerName: user.fullName || 'there',
          tierName: tier.displayName,
          expiredAt: now.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A',
          resubscribeUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/membership`,
        });
        await sendCmsEmailOrFallback({
          slug: 'membership-expired',
          to: user.email,
          vars: {
            customerName: user.fullName || 'there',
            tierName: tier.displayName,
            dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/membership`,
          },
          fallbackSubject: `${tier.name} Membership Expired`,
          fallbackHtml: html,
          businessFlow: 'subscriptions',
          relatedEntityType: 'membership',
          relatedEntityId: String(membership._id),
        }).catch(() => {});
      }
    } catch (err) {
      logger.error({ err, membershipId: membership._id }, 'Failed to send expiry email');
    }

    // In-app notification
    try {
      const expireTier = await MembershipTier.findById(membership.tierId).lean();
      await createAndDeliverNotification({
        userId: membership.userId.toString(),
        type: 'membership_expired',
        title: `${expireTier?.displayName || 'Membership'} Expired`,
        message: `Your ${expireTier?.displayName || 'membership'} has expired. Renew now to maintain your benefits and tag coverage.`,
        priority: 'high',
        channel: 'alert',
        actionUrl: '/membership',
      });
    } catch (err) {
      logger.error({ err, membershipId: membership._id }, '[Membership] Failed to send expiry notification');
    }

    // Deactivate tags that depend on this membership
    const tags = await Tag.find({
      ownerId: membership.userId,
      deletedAt: null,
      status: { $ne: 'returned' },
    });
    for (const tag of tags) {
      const tagAccess = await checkTagAccess(tag._id.toString());
      if (!tagAccess.hasAccess) {
        tag.status = 'expired';
        await tag.save();
        logger.info({ tagId: tag._id }, 'Tag deactivated due to expired membership');
      }
    }

    // Audit log
    await auditMembershipEvent({
      action: 'membership_expired',
      eventType: 'membership.expired',
      eventCategory: 'FINANCIAL',
      operationType: 'UPDATE',
      resourceType: 'UserMembership',
      resourceId: membership._id.toString(),
      outcome: 'SUCCESS',
      severity: 'HIGH',
      metadata: {
        userId: membership.userId.toString(),
        tierId: membership.tierId.toString(),
      },
    });
  }

  return expiredMemberships.length;
}

// ─── Send Renewal Reminders ──────────────────────────────────

export async function sendRenewalReminders() {
  const now = new Date();
  const reminderDays = [30, 7];

  for (const days of reminderDays) {
    const reminderDate = new Date(now);
    reminderDate.setDate(reminderDate.getDate() + days);

    const memberships = await UserMembership.find({
      status: 'active',
      autoRenew: true,
      currentPeriodEnd: {
        $gt: now,
        $lte: reminderDate,
      },
    });

    for (const membership of memberships) {
      try {
        const user = await User.findById(membership.userId).select('email fullName').lean();
        const tier = await MembershipTier.findById(membership.tierId).lean();
        if (user?.email && tier) {
          const { renderMembershipRenewalReminderEmail } = await import('./email/templates/membership-renewal-reminder');
          const html = renderMembershipRenewalReminderEmail({
            customerName: user.fullName || 'there',
            tierName: tier.displayName,
            renewalDate: membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A',
            price: membership.price,
            dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
          });
          const { sendCmsEmailOrFallback } = await import('./email.service');
          await sendCmsEmailOrFallback({
            slug: 'membership-renewal-reminder',
            to: user.email,
            vars: {
              customerName: user.fullName || 'there',
              tierName: tier.displayName,
              days: String(days),
              renewalDate: membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A',
              dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
            },
            fallbackSubject: `Your ${tier.name} Renews in ${days} Days`,
            fallbackHtml: html,
            businessFlow: 'subscriptions',
          }).catch(() => {});
        }

        // In-app notification
        try {
          await createAndDeliverNotification({
            userId: membership.userId.toString(),
            type: 'membership_renewal_reminder',
            title: `${tier?.displayName || 'Membership'} Renews in ${days} Days`,
            message: `Your ${tier?.displayName || 'membership'} will automatically renew on ${membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A'} for $${membership.price}/year.`,
            priority: days <= 7 ? 'normal' : 'low',
            channel: 'reminder',
            actionUrl: '/account/membership',
          });
        } catch (err) {
          logger.error({ err, membershipId: membership._id }, '[Membership] Failed to send renewal reminder notification');
        }
      } catch (err) {
        logger.error({ err, membershipId: membership._id }, 'Failed to send renewal reminder');
      }
    }
  }
}

// ─── Extend Tags for Membership (HYBRID 2) ──────────────────

/**
 * Extend tags based on membership tier limit.
 * When a customer purchases membership, their tags get extended.
 *
 * Tier limits:
 * - Gold: 3 tags
 * - Platinum: 10 tags
 * - Black: unlimited (999)
 *
 * Tags are extended oldest-first based on the tier limit.
 * Tags beyond the limit remain in 'limited' status if their active period has expired.
 *
 * @param userId - The user ID
 * @param membershipId - The membership ID
 */
export async function extendTagsForMembership(userId: string, membershipId: string): Promise<void> {
  const now = new Date();

  // Get the user's membership
  const membership = await UserMembership.findById(membershipId).lean();
  if (!membership) {
    logger.error({ membershipId }, '[Membership] Membership not found for tag extension');
    return;
  }

  // Get the tier to check tag limit
  const tier = await MembershipTier.findById(membership.tierId).lean();
  if (!tier) {
    logger.error({ tierId: membership.tierId }, '[Membership] Tier not found for tag extension');
    return;
  }

  // Get tag limit from entitlement registry (admin-configurable)
  const { membershipEntitlementService } = await import('./membership-entitlement.service');
  const tagLimit = await membershipEntitlementService.getValue<number>(userId, 'tag_limit') ?? tier.tagLimit;

  // Get all user's tags (active or limited, not deleted)
  const tags = await Tag.find({
    ownerId: userId,
    status: { $in: ['active', 'limited'] },
    deletedAt: null,
  }).sort({ createdAt: 1 }); // Oldest first

  // Apply tier limit
  const tagsToExtend = tags.slice(0, tagLimit);
  const tagsNotExtended = tags.slice(tagLimit);

  // Extend tags within limit
  for (const tag of tagsToExtend) {
    // Set membership start date if not already set
    if (!tag.membershipStartsAt) {
      tag.membershipStartsAt = now;
    }
    
    // Restore to active if it was limited
    if (tag.status === 'limited') {
      tag.status = 'active';
    }
    
    await tag.save();
    
    logger.info({
      tagId: tag.tagId,
      userId,
      membershipId,
      tier: tier.tier,
    }, '[Membership] Tag extended by membership');
  }

  // Update membership with extended tag IDs
  await UserMembership.findByIdAndUpdate(membershipId, {
    extendedTagIds: tagsToExtend.map(t => t._id),
  });

  // For tags beyond limit, ensure they're limited if active period expired
  for (const tag of tagsNotExtended) {
    if (tag.activePeriodEndsAt && now > tag.activePeriodEndsAt && tag.status === 'active') {
      tag.status = 'limited';
      await tag.save();
      
      logger.info({
        tagId: tag.tagId,
        userId,
        tier: tier.tier,
        tagLimit: tier.tagLimit,
      }, '[Membership] Tag remains limited (exceeds tier limit)');
    }
  }

  logger.info({
    userId,
    membershipId,
    tier: tier.tier,
    tagLimit,
    totalTags: tags.length,
    tagsExtended: tagsToExtend.length,
    tagsLimited: tagsNotExtended.length,
  }, '[Membership] Tag extension completed');
}

/**
 * Remove membership extension from tags when membership is cancelled/expired.
 *
 * @param userId - The user ID
 * @param membershipId - The membership ID
 */
export async function removeMembershipFromTags(userId: string, membershipId: string): Promise<void> {
  const now = new Date();

  // Get all user's tags with membership set
  const tags = await Tag.find({
    ownerId: userId,
    membershipStartsAt: { $exists: true, $ne: null },
    deletedAt: null,
  });

  for (const tag of tags) {
    // Check if tag's active period has expired
    if (tag.activePeriodEndsAt && now > tag.activePeriodEndsAt) {
      // Active period expired - set to limited
      tag.status = 'limited';
      tag.membershipStartsAt = undefined;
      await tag.save();
      
      logger.info({
        tagId: tag.tagId,
        userId,
        membershipId,
      }, '[Membership] Tag set to limited after membership removal');
    } else {
      // Active period still valid - just remove membership reference
      tag.membershipStartsAt = undefined;
      await tag.save();
    }
  }

  // Update membership to clear extended tag IDs
  await UserMembership.findByIdAndUpdate(membershipId, {
    extendedTagIds: [],
  });

  logger.info({
    userId,
    membershipId,
    tagsProcessed: tags.length,
  }, '[Membership] Membership removed from tags');
}

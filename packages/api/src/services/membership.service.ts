import { MembershipTier, UserMembership, User, Tag, Invoice } from '@pawtag/db';
import { isFakeMode } from '../commerce/payment-mode';
import Stripe from 'stripe';
import { sendMail } from './email.service';
import { createAndDeliverNotification } from './notification-delivery.service';
import { auditService, type AuditContext } from './audit';
import logger from '../lib/logger';

// Lazy-init Stripe client
let _stripe: Stripe | null = null;
function getStripeClient(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  _stripe = new Stripe(key, { apiVersion: '2026-08-26.dahlia' as any });
  return _stripe;
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
    const context: AuditContext = {
      requestId: 'membership-service',
      correlationId: 'membership-service',
      traceId: 'membership-service',
      transactionId: 'membership-service',
      sourceIp: 'system',
      userAgent: 'membership-service',
      applicationName: 'pawtag-api',
      applicationVersion: '1.0.0',
      apiVersion: 'v1',
      environment: process.env.NODE_ENV || 'development',
      actorType: 'SERVICE',
      ...overrides,
    };
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
    status: { $in: ['active', 'cancelled', 'expired'] },
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

export async function checkTagAccess(tagId: string): Promise<{
  hasAccess: boolean;
  reason: string;
  warrantyEndsAt?: Date;
  membershipEndsAt?: Date;
}> {
  const tag = await Tag.findById(tagId).lean();
  if (!tag) {
    return { hasAccess: false, reason: 'Tag not found' };
  }

  // Get the product to check warranty
  // Tag doesn't have productId directly - we need to look up via Order
  // For now, use default warranty of 12 months
  const warrantyMonths = 12; // TODO: Get from product via order

  // Calculate warranty end date from tag activation
  const tagActivatedAt = tag.activatedAt || new Date();
  const warrantyEndsAt = new Date(tagActivatedAt);
  warrantyEndsAt.setMonth(warrantyEndsAt.getMonth() + warrantyMonths);

  // Check if within warranty period
  const now = new Date();
  if (now <= warrantyEndsAt) {
    return {
      hasAccess: true,
      reason: 'Within warranty period',
      warrantyEndsAt,
    };
  }

  // Warranty expired — check for active membership
  const ownerId = tag.ownerId?.toString();
  if (!ownerId) {
    return { hasAccess: false, reason: 'No owner found', warrantyEndsAt };
  }

  const membership = await UserMembership.findOne({
    userId: ownerId,
    status: 'active',
  }).lean();

  if (membership) {
    return {
      hasAccess: true,
      reason: 'Covered by membership',
      warrantyEndsAt,
      membershipEndsAt: membership.currentPeriodEnd,
    };
  }

  return {
    hasAccess: false,
    reason: 'Warranty expired and no active membership',
    warrantyEndsAt,
  };
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
  const existingMembership = await UserMembership.findOne({
    userId,
    status: 'active',
  });
  if (existingMembership) {
    throw new Error('You already have an active membership');
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

      // Create Stripe Subscription
      const stripeSubscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: stripePriceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        metadata: { userId: userId.toString(), tier: tier.tier },
        expand: ['latest_invoice.payment_intent'],
      });

      stripeSubscriptionId = stripeSubscription.id;

      // Extract client secret for frontend
      const latestInvoice = stripeSubscription.latest_invoice as any;
      if (latestInvoice?.payment_intent) {
        clientSecret = latestInvoice.payment_intent.client_secret;
      }

      logger.info({
        userId,
        stripeCustomerId,
        stripeSubscriptionId,
      }, '[Membership] Created Stripe subscription');
    } catch (err) {
      logger.error({ err, userId }, '[Membership] Stripe subscription creation failed');
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Payment processing failed. Please try again.');
      }
      // In dev/test, continue without Stripe
    }
  }

  // Calculate period end (1 year from now)
  const currentPeriodEnd = new Date(now);
  currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);

  // Create UserMembership
  const membership = await UserMembership.create({
    userId,
    tierId,
    status: 'pending_payment',
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
  if (membership.status === 'active') return membership;

  membership.status = 'active';
  await membership.save();

  // Update user's membershipTier
  const tier = await MembershipTier.findById(membership.tierId).lean();
  if (tier) {
    await User.findByIdAndUpdate(membership.userId, {
      membershipTier: tier.tier,
      membershipId: membership._id,
    });
  }

  // Send welcome email
  try {
    const user = await User.findById(membership.userId).select('email fullName').lean();
    if (user?.email && tier) {
      const { renderMembershipWelcomeEmail } = await import('./email/templates/membership-welcome');
      const html = renderMembershipWelcomeEmail({
        customerName: user.fullName || 'there',
        tierName: tier.displayName,
        price: membership.price,
        renewalDate: membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A',
        dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
      });
      await sendMail(user.email, `Welcome to ${tier.name}!`, html).catch(() => {});
    }
  } catch (err) {
    logger.error({ err, membershipId }, '[Membership] Failed to send welcome email');
  }

  // In-app notification
  try {
    await createAndDeliverNotification({
      userId: membership.userId.toString(),
      type: 'subscription_expiring',
      title: `${tier?.displayName || 'Gold'} Membership Activated`,
      message: `Welcome to ${tier?.displayName || 'Gold'}! Your membership is now active.`,
      priority: 'normal',
      channel: 'info',
      actionUrl: '/account/membership',
    });
  } catch (err) {
    logger.error({ err, membershipId }, '[Membership] Failed to create in-app notification');
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

  // Cancel Stripe subscription if it exists
  if (membership.stripeSubscriptionId && !isFakeMode()) {
    try {
      const stripe = getStripeClient();
      await stripe.subscriptions.cancel(membership.stripeSubscriptionId);
      logger.info({ membershipId: membership._id }, 'Stripe subscription cancelled');
    } catch (err) {
      logger.error({ err, membershipId: membership._id }, 'Failed to cancel Stripe subscription');
    }
  }

  membership.status = 'cancelled';
  membership.cancelledAt = new Date();
  membership.cancellationReason = reason;
  membership.autoRenew = false;
  await membership.save();

  // Update user
  await User.findByIdAndUpdate(userId, {
    membershipTier: null,
    membershipId: null,
  });

  // Send cancellation email
  try {
    const user = await User.findById(userId).select('email fullName').lean();
    const tier = await MembershipTier.findById(membership.tierId).lean();
    if (user?.email && tier) {
      const { renderMembershipCancelledEmail } = await import('./email/templates/membership-cancelled');
      const html = renderMembershipCancelledEmail({
        customerName: user.fullName || 'there',
        tierName: tier.displayName,
        cancelledAt: membership.cancelledAt?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A',
        benefitsUntil: membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A',
        resubscribeUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/membership`,
      });
      await sendMail(user.email, `${tier.name} Membership Cancelled`, html).catch(() => {});
    }
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, 'Failed to send cancellation email');
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
    },
  });

  return membership;
}

// ─── Change Tier ─────────────────────────────────────────────

export async function changeTier(userId: string, newTierId: string) {
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

  // Update Stripe subscription if needed
  if (membership.stripeSubscriptionId && !isFakeMode()) {
    try {
      const stripe = getStripeClient();

      // Get or create new price for new tier
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
        await MembershipTier.findByIdAndUpdate(newTierId, { stripePriceId: priceObj.id });
      }

      // Update subscription
      const subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);
      await stripe.subscriptions.update(membership.stripeSubscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: newPriceId,
        }],
      });

      logger.info({ membershipId: membership._id, oldTier: oldTier?.tier, newTier: newTier.tier }, 'Stripe subscription updated');
    } catch (err) {
      logger.error({ err, membershipId: membership._id }, 'Failed to update Stripe subscription');
    }
  }

  // Update membership
  membership.tierId = newTier._id;
  membership.price = newTier.price;
  await membership.save();

  // Update user
  await User.findByIdAndUpdate(userId, { membershipTier: newTier.tier });

  // Send tier change email
  try {
    const user = await User.findById(userId).select('email fullName').lean();
    if (user?.email) {
      const { renderMembershipTierChangedEmail } = await import('./email/templates/membership-tier-changed');
      const html = renderMembershipTierChangedEmail({
        customerName: user.fullName || 'there',
        oldTierName: oldTier?.displayName || 'Unknown',
        newTierName: newTier.displayName,
        newPrice: newTier.price,
        renewalDate: membership.currentPeriodEnd?.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A',
        dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
      });
      await sendMail(user.email, `Membership Changed to ${newTier.displayName}`, html).catch(() => {});
    }
  } catch (err) {
    logger.error({ err, membershipId: membership._id }, 'Failed to send tier change email');
  }

  // Audit log
  await auditMembershipEvent({
    action: 'membership_tier_changed',
    eventType: 'membership.tier_changed',
    eventCategory: 'UPDATE',
    operationType: 'UPDATE',
    resourceType: 'UserMembership',
    resourceId: membership._id.toString(),
    outcome: 'SUCCESS',
    severity: 'HIGH',
    metadata: {
      userId,
      oldTier: oldTier?.tier,
      newTier: newTier.tier,
      oldPrice: oldTier?.price,
      newPrice: newTier.price,
    },
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
        const html = renderMembershipExpiredEmail({
          customerName: user.fullName || 'there',
          tierName: tier.displayName,
          expiredAt: now.toLocaleDateString('en-NZ', { dateStyle: 'full' }) || 'N/A',
          resubscribeUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/membership`,
        });
        await sendMail(user.email, `${tier.name} Membership Expired`, html).catch(() => {});
      }
    } catch (err) {
      logger.error({ err, membershipId: membership._id }, 'Failed to send expiry email');
    }

    // Deactivate tags that depend on this membership
    const tags = await Tag.find({ ownerId: membership.userId });
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
          await sendMail(user.email, `Your ${tier.name} Renews in ${days} Days`, html).catch(() => {});
        }
      } catch (err) {
        logger.error({ err, membershipId: membership._id }, 'Failed to send renewal reminder');
      }
    }
  }
}

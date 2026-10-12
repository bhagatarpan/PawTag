/**
 * Saved payment methods on Stripe Customer (multiple cards + one default).
 *
 * Source of truth: Stripe Customer PaymentMethods.
 * Never store raw PAN/CVC. Display only brand/last4/expiry.
 */
import { User, UserMembership } from '@pawtag/db';
import type Stripe from 'stripe';
import {
  SAVED_PAYMENT_METHOD_ERROR_CODES,
  type SavedPaymentMethod,
  type SavedPaymentMethodErrorCode,
} from '@pawtag/shared';
import { isFakeMode } from '../commerce/payment-mode';
import { getStripeClient } from '../lib/stripe-client';
import { systemAuditContext } from '../lib/app-meta';
import { auditService } from './audit';
import logger from '../lib/logger';

export class PaymentMethodError extends Error {
  readonly membershipCode: SavedPaymentMethodErrorCode;
  readonly httpStatus: number;

  constructor(
    membershipCode: SavedPaymentMethodErrorCode,
    message: string,
    userMessage: string,
    httpStatus = 400,
  ) {
    super(message);
    this.name = 'PaymentMethodError';
    this.membershipCode = membershipCode;
    this.httpStatus = httpStatus;
    this.message = userMessage;
  }
}

async function auditPaymentMethodEvent(
  action: string,
  userId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await auditService.log(systemAuditContext('SERVICE', { actorId: userId, actorUsername: userId }), {
      action,
      eventType: `payment_method.${action}`,
      eventCategory: 'FINANCIAL',
      operationType: 'UPDATE',
      resourceType: 'PaymentMethod',
      resourceId: String(metadata.paymentMethodId || ''),
      subjectUserId: userId,
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata,
    });
  } catch (err) {
    logger.error({ err, userId, action }, '[PaymentMethod] audit failed');
  }
}

export async function getStripeCustomerIdForUser(userId: string): Promise<string | null> {
  const user = await User.findById(userId).select('stripeCustomerId').lean();
  return user?.stripeCustomerId || null;
}

async function resolveDefaultPaymentMethodId(
  stripeCustomerId: string,
  paymentMethods: any[],
): Promise<string | null> {
  const stripe = getStripeClient();
  try {
    const customer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ['invoice_settings.default_payment_method'],
    });
    const invoiceDefault = (customer as any)?.invoice_settings?.default_payment_method;
    if (typeof invoiceDefault === 'string' && invoiceDefault) return invoiceDefault;
    if (invoiceDefault && typeof invoiceDefault === 'object' && (invoiceDefault as any).id) {
      return (invoiceDefault as any).id;
    }
  } catch (err) {
    logger.warn({ err, stripeCustomerId }, '[PaymentMethod] failed to read invoice_settings default');
  }

  if (paymentMethods.length === 1) return String(paymentMethods[0].id);
  return null;
}

export async function listSavedPaymentMethods(userId: string): Promise<{
  data: SavedPaymentMethod[];
  defaultPaymentMethodId: string | null;
  hasStripeCustomer: boolean;
}> {
  const stripeCustomerId = await getStripeCustomerIdForUser(userId);
  if (!stripeCustomerId || isFakeMode()) {
    return { data: [], defaultPaymentMethodId: null, hasStripeCustomer: Boolean(stripeCustomerId) };
  }

  const stripe = getStripeClient();
  const listed = await stripe.customers.listPaymentMethods(stripeCustomerId, { type: 'card' });
  const defaultId = await resolveDefaultPaymentMethodId(stripeCustomerId, listed.data || []);

  const data: SavedPaymentMethod[] = (listed.data || []).map((pm) => ({
    id: pm.id,
    brand: pm.card?.brand || null,
    last4: pm.card?.last4 || null,
    expMonth: pm.card?.exp_month || null,
    expYear: pm.card?.exp_year || null,
    isDefault: defaultId ? pm.id === defaultId : listed.data.length === 1,
  }));

  return { data, defaultPaymentMethodId: defaultId, hasStripeCustomer: true };
}

/**
 * First valid PM id when a default exists but Stripe default is missing.
 */
export async function getDefaultPaymentMethodIdForUser(userId: string): Promise<string | null> {
  const { defaultPaymentMethodId, data } = await listSavedPaymentMethods(userId);
  if (defaultPaymentMethodId) return defaultPaymentMethodId;
  const def = data.find((p) => p.isDefault) || data[0];
  return def?.id || null;
}

/**
 * Validate that a payment method id belongs to this user's Stripe Customer.
 * Returns the id when owned; null when missing/foreign/fake-mode.
 * Use before charging a client-supplied pm_ id — never trust it unscoped.
 */
export async function userOwnsPaymentMethod(
  userId: string,
  paymentMethodId: string,
): Promise<string | null> {
  if (!paymentMethodId || !String(paymentMethodId).startsWith('pm_')) return null;
  const { data } = await listSavedPaymentMethods(userId);
  return data.some((pm) => pm.id === paymentMethodId) ? paymentMethodId : null;
}

// ─── Duplicate prevention (provider fingerprint based) ───────────────────────
//
// Stripe does not dedupe PaymentMethods on attach: re-entering the same card
// (checkout setup_future_usage, or the add-card SetupIntent) creates a new
// pm_ object with the SAME card.fingerprint. The fingerprint is the provider's
// stable card identifier — brand/last4/expiry alone is NEVER treated as proof
// of duplication. Cards without a fingerprint are ambiguous and untouched.

export interface DedupeRedundantPlan {
  paymentMethodId: string;
  /** References that point at the redundant card and must be repointed first. */
  repointsInvoiceDefault: boolean;
  repointsSubscriptionDefault: boolean;
  repointsMembershipReference: boolean;
}

export interface DedupeGroupPlan {
  fingerprint: string;
  canonicalPaymentMethodId: string;
  canonicalReason: 'invoice_default' | 'membership_reference' | 'oldest_attached';
  brand?: string | null;
  last4?: string | null;
  redundant: DedupeRedundantPlan[];
}

export interface DedupeSavedCardsResult {
  /** False when skipped (fake mode / no Stripe customer). */
  checked: boolean;
  /** True when this run planned but performed no mutations. */
  dryRun: boolean;
  duplicateGroups: number;
  removedPaymentMethodIds: string[];
  /** Canonical surviving card for the candidate's duplicate group, when one existed. */
  canonicalPaymentMethodId: string | null;
  /** True when the candidate card's fingerprint was already on file. */
  alreadySaved: boolean;
  /** Per-group plan — populated identically in dry-run and live mode. */
  groups: DedupeGroupPlan[];
  /** Cards without a provider fingerprint (ambiguous — never actioned). */
  ambiguousCards: number;
}

const EMPTY_DEDUPE_RESULT: DedupeSavedCardsResult = {
  checked: false,
  dryRun: false,
  duplicateGroups: 0,
  removedPaymentMethodIds: [],
  canonicalPaymentMethodId: null,
  alreadySaved: false,
  groups: [],
  ambiguousCards: 0,
};

/** Coalesce concurrent dedupe runs for the same user (webhook + confirm races). */
const inflightDedupes = new Map<string, Promise<DedupeSavedCardsResult>>();

/** Raw card PMs (with fingerprint) — internal dedupe use only; never sent to clients. */
async function listRawCardPaymentMethods(stripeCustomerId: string): Promise<Stripe.PaymentMethod[]> {
  const stripe = getStripeClient();
  const listed = await stripe.customers.listPaymentMethods(stripeCustomerId, {
    type: 'card',
    limit: 100,
  });
  return (listed.data || []) as Stripe.PaymentMethod[];
}

function isAlreadyDetachedError(err: any): boolean {
  return (
    err?.code === 'resource_missing' ||
    /previously detached|was detached/i.test(err?.message || '')
  );
}

/**
 * Converge each fingerprint group on the customer to ONE canonical card.
 *
 * Canonical selection (deterministic so concurrent runs agree):
 *   1. the current invoice default, when in the group;
 *   2. else the card referenced by the active membership, when in the group;
 *   3. else the oldest attached (ties → lowest pm id).
 *
 * Before detaching a redundant card, billing references are repointed to the
 * canonical card: Stripe invoice default → Stripe subscription default →
 * local UserMembership.paymentMethodId. Historical PaymentTransaction /
 * Invoice records are NEVER touched. A detach that reports the card was
 * already detached is treated as success (idempotent).
 *
 * dryRun plans every action (same canonical selection) without mutating
 * anything — used by the cleanup script's review pass.
 */
export async function dedupeSavedCards(
  userId: string,
  options: { reason: string; candidatePaymentMethodId?: string | null; dryRun?: boolean },
): Promise<DedupeSavedCardsResult> {
  if (options.dryRun) return performDedupeSavedCards(userId, options); // no coalescing — read-only
  const inflight = inflightDedupes.get(userId);
  if (inflight) return inflight;
  const run = performDedupeSavedCards(userId, options).finally(() => inflightDedupes.delete(userId));
  inflightDedupes.set(userId, run);
  return run;
}

async function performDedupeSavedCards(
  userId: string,
  options: { reason: string; candidatePaymentMethodId?: string | null; dryRun?: boolean },
): Promise<DedupeSavedCardsResult> {
  const dryRun = options.dryRun === true;
  if (isFakeMode()) return { ...EMPTY_DEDUPE_RESULT, dryRun };

  const stripeCustomerId = await getStripeCustomerIdForUser(userId);
  if (!stripeCustomerId) return { ...EMPTY_DEDUPE_RESULT, dryRun };

  const stripe = getStripeClient();
  const cards = await listRawCardPaymentMethods(stripeCustomerId);
  if (cards.length < 2) return { ...EMPTY_DEDUPE_RESULT, dryRun, checked: true };

  // Group by provider fingerprint; cards without one are ambiguous → untouched.
  const groups = new Map<string, Stripe.PaymentMethod[]>();
  let ambiguousCards = 0;
  for (const pm of cards) {
    const fingerprint = pm.card?.fingerprint;
    if (!fingerprint) {
      ambiguousCards++;
      continue;
    }
    const group = groups.get(fingerprint);
    if (group) group.push(pm);
    else groups.set(fingerprint, [pm]);
  }
  const duplicateGroups = [...groups.values()].filter((group) => group.length > 1);
  if (duplicateGroups.length === 0) {
    return { ...EMPTY_DEDUPE_RESULT, dryRun, checked: true, ambiguousCards };
  }

  // Invoice default (re-read fresh; updated locally as groups are processed).
  let invoiceDefaultId: string | null = null;
  try {
    const customer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ['invoice_settings.default_payment_method'],
    });
    const d = (customer as any)?.invoice_settings?.default_payment_method;
    invoiceDefaultId = typeof d === 'string' ? d : d?.id || null;
  } catch (err) {
    logger.warn({ err, stripeCustomerId }, '[PaymentMethod] dedupe: failed to read invoice default');
  }

  // Active membership: local reference + Stripe subscription default.
  const membership = await UserMembership.findOne({ userId, status: 'active' }).lean();
  let subscriptionDefaultId: string | null | undefined;
  if (membership?.stripeSubscriptionId) {
    try {
      const sub: any = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);
      const d = sub?.default_payment_method;
      subscriptionDefaultId = typeof d === 'string' ? d : d?.id || null;
    } catch (err) {
      logger.warn({ err, userId }, '[PaymentMethod] dedupe: failed to read subscription default');
      subscriptionDefaultId = null;
    }
  }

  // ── Phase 1: plan (pure; identical in dry-run and live mode) ──────────────
  const groupPlans: DedupeGroupPlan[] = [];
  const removedPaymentMethodIds: string[] = [];
  let canonicalPaymentMethodId: string | null = null;
  let alreadySaved = false;

  for (const group of duplicateGroups) {
    const memberIds = new Set(group.map((p) => p.id));

    let canonicalReason: DedupeGroupPlan['canonicalReason'] = 'oldest_attached';
    let canonicalId: string | null = null;
    if (invoiceDefaultId && memberIds.has(invoiceDefaultId)) {
      canonicalId = invoiceDefaultId;
      canonicalReason = 'invoice_default';
    } else if (membership?.paymentMethodId && memberIds.has(membership.paymentMethodId)) {
      canonicalId = membership.paymentMethodId;
      canonicalReason = 'membership_reference';
    } else {
      canonicalId = [...group].sort(
        (a, b) => (a.created || 0) - (b.created || 0) || (a.id < b.id ? -1 : 1),
      )[0].id;
    }
    const canonicalPm = group.find((p) => p.id === canonicalId)!;
    const redundant = group.filter((p) => p.id !== canonicalId);

    const candidateId = options.candidatePaymentMethodId
      ? String(options.candidatePaymentMethodId)
      : null;
    if (candidateId && memberIds.has(candidateId)) {
      canonicalPaymentMethodId = canonicalId;
      alreadySaved = group.length > 1;
    }

    groupPlans.push({
      fingerprint: String(group[0].card?.fingerprint),
      canonicalPaymentMethodId: canonicalId,
      canonicalReason,
      brand: canonicalPm.card?.brand,
      last4: canonicalPm.card?.last4,
      redundant: redundant.map((rm) => ({
        paymentMethodId: rm.id,
        repointsInvoiceDefault: invoiceDefaultId === rm.id,
        repointsSubscriptionDefault: subscriptionDefaultId === rm.id,
        repointsMembershipReference: membership?.paymentMethodId === rm.id,
      })),
    });
  }

  if (dryRun) {
    return {
      checked: true,
      dryRun: true,
      duplicateGroups: groupPlans.length,
      removedPaymentMethodIds: groupPlans.flatMap((g) => g.redundant.map((r) => r.paymentMethodId)),
      canonicalPaymentMethodId,
      alreadySaved,
      groups: groupPlans,
      ambiguousCards,
    };
  }

  // ── Phase 2: execute ──────────────────────────────────────────────────────
  for (const plan of groupPlans) {
    const canonicalPm = cards.find((p) => p.id === plan.canonicalPaymentMethodId)!;

    for (const rm of plan.redundant) {
      // Repoint billing references BEFORE detaching so a renewal can never
      // point at a detached card.
      if (rm.repointsInvoiceDefault) {
        try {
          await stripe.customers.update(stripeCustomerId, {
            invoice_settings: { default_payment_method: plan.canonicalPaymentMethodId },
          });
          invoiceDefaultId = plan.canonicalPaymentMethodId;
        } catch (err) {
          logger.error({ err, userId, paymentMethodId: rm.paymentMethodId }, '[PaymentMethod] dedupe: failed to repoint invoice default');
        }
      }

      if (rm.repointsSubscriptionDefault && membership?.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.update(membership.stripeSubscriptionId, {
            default_payment_method: plan.canonicalPaymentMethodId,
          });
          subscriptionDefaultId = plan.canonicalPaymentMethodId;
        } catch (err) {
          logger.error({ err, userId, paymentMethodId: rm.paymentMethodId }, '[PaymentMethod] dedupe: failed to repoint subscription default');
        }
      }

      if (rm.repointsMembershipReference && membership) {
        try {
          await UserMembership.updateOne(
            { _id: membership._id },
            {
              $set: {
                paymentMethodId: plan.canonicalPaymentMethodId,
                cardBrand: canonicalPm.card?.brand,
                cardLast4: canonicalPm.card?.last4,
                cardExpMonth: canonicalPm.card?.exp_month,
                cardExpYear: canonicalPm.card?.exp_year,
              },
            },
          );
          (membership as any).paymentMethodId = plan.canonicalPaymentMethodId;
        } catch (err) {
          logger.error({ err, userId, paymentMethodId: rm.paymentMethodId }, '[PaymentMethod] dedupe: failed to repoint membership reference');
        }
      }

      let detached = false;
      try {
        await stripe.paymentMethods.detach(rm.paymentMethodId);
        detached = true;
      } catch (err: any) {
        if (isAlreadyDetachedError(err)) {
          detached = true; // state already achieved — idempotent success
        } else {
          logger.error({ err, userId, paymentMethodId: rm.paymentMethodId }, '[PaymentMethod] dedupe: detach failed');
        }
      }
      if (detached) removedPaymentMethodIds.push(rm.paymentMethodId);

      await auditPaymentMethodEvent('duplicate_removed', userId, {
        paymentMethodId: rm.paymentMethodId,
        canonicalPaymentMethodId: plan.canonicalPaymentMethodId,
        fingerprint: plan.fingerprint,
        brand: plan.brand,
        last4: plan.last4,
        stripeCustomerId,
        detached,
        reason: options.reason,
      });
    }
  }

  if (removedPaymentMethodIds.length > 0) {
    logger.info(
      {
        userId,
        stripeCustomerId,
        duplicateGroups: groupPlans.length,
        removed: removedPaymentMethodIds.length,
        reason: options.reason,
      },
      '[PaymentMethod] duplicate saved cards collapsed',
    );
  }

  return {
    checked: true,
    dryRun: false,
    duplicateGroups: groupPlans.length,
    removedPaymentMethodIds,
    canonicalPaymentMethodId,
    alreadySaved,
    groups: groupPlans,
    ambiguousCards,
  };
}

/**
 * Called after a SetupIntent attaches a card. Collapses duplicate cards and
 * reports whether the card was already on file, so the UI can tell the
 * customer instead of silently keeping two records.
 */
export async function confirmAttachedPaymentMethod(
  userId: string,
  paymentMethodId?: string,
): Promise<{
  alreadySaved: boolean;
  canonicalPaymentMethodId: string | null;
  defaultPaymentMethodId: string | null;
  data: SavedPaymentMethod[];
}> {
  if (paymentMethodId && !String(paymentMethodId).startsWith('pm_')) {
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.NOT_FOUND,
      'Invalid payment method id',
      'Payment method not found.',
    );
  }

  const dedupe = await dedupeSavedCards(userId, {
    reason: 'confirm_attached',
    candidatePaymentMethodId: paymentMethodId || null,
  });
  const list = await listSavedPaymentMethods(userId);

  return {
    alreadySaved: dedupe.alreadySaved,
    canonicalPaymentMethodId: dedupe.canonicalPaymentMethodId,
    defaultPaymentMethodId: list.defaultPaymentMethodId,
    data: list.data,
  };
}

export async function createSetupIntentForUser(userId: string): Promise<{
  clientSecret: string;
  stripeCustomerId: string;
}> {
  const stripeCustomerId = await getStripeCustomerIdForUser(userId);
  if (!stripeCustomerId) {
    const user = await User.findById(userId).select('email fullName').lean();
    if (!user) {
      throw new PaymentMethodError(
        SAVED_PAYMENT_METHOD_ERROR_CODES.NOT_FOUND,
        'User not found',
        'Account not found',
        404,
      );
    }
    if (isFakeMode()) {
      throw new PaymentMethodError(
        SAVED_PAYMENT_METHOD_ERROR_CODES.NO_STRIPE_CUSTOMER,
        'Stripe not configured in fake mode',
        'Payment methods are not available in demo mode.',
        400,
      );
    }
    const stripe = getStripeClient();
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.fullName || undefined,
      metadata: { userId: userId.toString(), source: 'pawtag-payment-methods' },
    });
    await User.findByIdAndUpdate(userId, { stripeCustomerId: customer.id });
    return createSetupIntentForUser(userId);
  }

  if (isFakeMode()) {
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.NO_STRIPE_CUSTOMER,
      'Stripe not configured in fake mode',
      'Payment methods are not available in demo mode.',
      400,
    );
  }

  const stripe = getStripeClient();
  const intent = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    usage: 'off_session',
    payment_method_types: ['card'],
    metadata: { userId: userId.toString(), purpose: 'save_payment_method' },
  });

  if (!intent.client_secret) {
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.STRIPE_ERROR,
      'SetupIntent missing client secret',
      'Unable to start adding a payment method. Please try again.',
      502,
    );
  }

  await auditPaymentMethodEvent('setup_intent_created', userId, {
    setupIntentId: intent.id,
    stripeCustomerId,
  });

  return { clientSecret: intent.client_secret, stripeCustomerId };
}

export async function setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<SavedPaymentMethod[]> {
  if (!paymentMethodId || !String(paymentMethodId).startsWith('pm_')) {
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.NOT_FOUND,
      'Invalid payment method id',
      'Payment method not found.',
    );
  }

  const stripeCustomerId = await getStripeCustomerIdForUser(userId);
  if (!stripeCustomerId || isFakeMode()) {
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.NO_STRIPE_CUSTOMER,
      'No Stripe customer',
      'No payment methods on file.',
      400,
    );
  }

  const stripe = getStripeClient();
  try {
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  } catch (err: any) {
    logger.error({ err, userId, paymentMethodId }, '[PaymentMethod] set default failed');
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.STRIPE_ERROR,
      err?.message || 'Stripe set default failed',
      'Unable to set default payment method. Please try again.',
      502,
    );
  }

  // Best-effort: also set on active membership subscription default
  try {
    const membership = await UserMembership.findOne({ userId, status: 'active' }).lean();
    if (membership?.stripeSubscriptionId) {
      await stripe.subscriptions.update(membership.stripeSubscriptionId, {
        default_payment_method: paymentMethodId,
      });
    }
  } catch (err) {
    logger.warn({ err, userId }, '[PaymentMethod] failed to set subscription default (non-fatal)');
  }

  await auditPaymentMethodEvent('default_changed', userId, { paymentMethodId, stripeCustomerId });

  const { data } = await listSavedPaymentMethods(userId);
  return data;
}

export async function detachPaymentMethod(userId: string, paymentMethodId: string): Promise<SavedPaymentMethod[]> {
  if (!paymentMethodId || !String(paymentMethodId).startsWith('pm_')) {
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.NOT_FOUND,
      'Invalid payment method id',
      'Payment method not found.',
    );
  }

  const stripeCustomerId = await getStripeCustomerIdForUser(userId);
  if (!stripeCustomerId || isFakeMode()) {
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.NO_STRIPE_CUSTOMER,
      'No Stripe customer',
      'No payment methods on file.',
      400,
    );
  }

  const list = await listSavedPaymentMethods(userId);
  const target = list.data.find((p) => p.id === paymentMethodId);
  if (!target) {
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.NOT_FOUND,
      'Payment method not found for customer',
      'Payment method not found.',
      404,
    );
  }

  const remaining = list.data.filter((p) => p.id !== paymentMethodId);
  const membership = await UserMembership.findOne({ userId, status: 'active' }).lean();
  const membershipRequiresCard = Boolean(membership?.autoRenew);

  if (target.isDefault && membershipRequiresCard && remaining.length === 0) {
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.MEMBERSHIP_REQUIRES_CARD,
      'Cannot remove last payment method while membership requires billing',
      'Your membership needs a payment method for renewals. Add another card before removing this one.',
      409,
    );
  }

  const stripe = getStripeClient();
  try {
    await stripe.paymentMethods.detach(paymentMethodId);
  } catch (err: any) {
    logger.error({ err, userId, paymentMethodId }, '[PaymentMethod] detach failed');
    throw new PaymentMethodError(
      SAVED_PAYMENT_METHOD_ERROR_CODES.STRIPE_ERROR,
      err?.message || 'Stripe detach failed',
      'Unable to remove payment method. Please try again.',
      502,
    );
  }

  // If removed default and others remain, promote first remaining (deterministic)
  if (target.isDefault && remaining.length > 0) {
    try {
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: remaining[0].id },
      });
      await auditPaymentMethodEvent('default_changed', userId, {
        paymentMethodId: remaining[0].id,
        reason: 'default_removed',
        stripeCustomerId,
      });
    } catch (err) {
      logger.warn({ err, userId }, '[PaymentMethod] failed to promote new default after detach');
    }
  }

  await auditPaymentMethodEvent('removed', userId, { paymentMethodId, stripeCustomerId });

  const { data } = await listSavedPaymentMethods(userId);
  return data;
}

/**
 * Post-purchase confirm-save: promote first PM to default only when PMs exist.
 * Never reports success when nothing is on file.
 */
export async function confirmSavePaymentMethod(
  userId: string,
  paymentMethodId?: string,
): Promise<{
  saved: boolean;
  defaultPaymentMethodId: string | null;
  data: SavedPaymentMethod[];
  reason?: string;
}> {
  // Collapse same-fingerprint duplicates before promoting defaults.
  // Non-fatal: confirm-save must not fail on a dedupe hiccup — the daily
  // saved-card job retries as backstop.
  await dedupeSavedCards(userId, { reason: 'confirm_save' }).catch((err) =>
    logger.warn({ err, userId }, '[PaymentMethod] dedupe during confirm-save failed (non-fatal)'),
  );

  const list = await listSavedPaymentMethods(userId);
  if (list.data.length === 0) {
    await auditPaymentMethodEvent('saved_after_purchase', userId, {
      saved: false,
      reason: 'no_payment_methods_on_stripe_customer',
    });
    return {
      saved: false,
      defaultPaymentMethodId: null,
      data: [],
      reason: 'no_payment_methods',
    };
  }

  const targetId = paymentMethodId || list.defaultPaymentMethodId || list.data[0]?.id;
  if (!targetId) {
    return { saved: false, defaultPaymentMethodId: null, data: list.data, reason: 'no_target' };
  }

  if (list.defaultPaymentMethodId && list.defaultPaymentMethodId === targetId) {
    await auditPaymentMethodEvent('saved_after_purchase', userId, {
      paymentMethodId: targetId,
      alreadyDefault: true,
      saved: true,
    });
    return {
      saved: true,
      defaultPaymentMethodId: list.defaultPaymentMethodId,
      data: list.data,
    };
  }

  if (!list.defaultPaymentMethodId) {
    const data = await setDefaultPaymentMethod(userId, targetId);
    await auditPaymentMethodEvent('saved_after_purchase', userId, {
      paymentMethodId: targetId,
      becameDefault: true,
      saved: true,
    });
    return { saved: true, defaultPaymentMethodId: targetId, data };
  }

  // Default already exists — card is already on file; do not silently replace default
  await auditPaymentMethodEvent('saved_after_purchase', userId, {
    paymentMethodId: targetId,
    becameDefault: false,
    existingDefault: list.defaultPaymentMethodId,
    saved: true,
  });
  return {
    saved: true,
    defaultPaymentMethodId: list.defaultPaymentMethodId,
    data: list.data,
  };
}

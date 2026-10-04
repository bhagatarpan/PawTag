// ============================================================
// PawTag Membership Tier-Change Contracts
// Shared by API and customer web. Single source of truth for
// machine-readable codes and tier-change estimate/error DTOs.
// ============================================================

export const MEMBERSHIP_TIER_CHANGE_CODES = {
  NO_ACTIVE_MEMBERSHIP: 'membership.no_active_membership',
  TIER_NOT_FOUND: 'membership.tier_not_found',
  TIER_UNAVAILABLE: 'membership.tier_unavailable',
  ALREADY_ON_TIER: 'membership.already_on_tier',
  TIER_REQUIRED: 'membership.tier_required',
  SUBSCRIPTION_MISSING: 'membership.subscription_missing',
  SUBSCRIPTION_NOT_ACTIVE: 'membership.subscription_not_active',
  SUBSCRIPTION_INVALID: 'membership.subscription_invalid',
  PAYMENT_METHOD_REQUIRED: 'membership.payment_method_required',
  STRIPE_UPDATE_FAILED: 'membership.stripe_update_failed',
  DOWNGRADE_ALREADY_SCHEDULED: 'membership.downgrade_already_scheduled',
  NOT_CANCELLING: 'membership.not_cancelling',
  TERMS_REQUIRED: 'membership.terms_required',
  GOLD_PRICE_NOT_CONFIGURED: 'membership.gold_price_not_configured',
} as const;

export type MembershipTierChangeCode =
  (typeof MEMBERSHIP_TIER_CHANGE_CODES)[keyof typeof MEMBERSHIP_TIER_CHANGE_CODES];

/** HTTP status for each membership tier-change code (route mapping table). */
export const MEMBERSHIP_TIER_CHANGE_HTTP_STATUS: Record<MembershipTierChangeCode, number> = {
  [MEMBERSHIP_TIER_CHANGE_CODES.NO_ACTIVE_MEMBERSHIP]: 400,
  [MEMBERSHIP_TIER_CHANGE_CODES.TIER_NOT_FOUND]: 404,
  [MEMBERSHIP_TIER_CHANGE_CODES.TIER_UNAVAILABLE]: 400,
  [MEMBERSHIP_TIER_CHANGE_CODES.ALREADY_ON_TIER]: 409,
  [MEMBERSHIP_TIER_CHANGE_CODES.TIER_REQUIRED]: 400,
  [MEMBERSHIP_TIER_CHANGE_CODES.SUBSCRIPTION_MISSING]: 409,
  [MEMBERSHIP_TIER_CHANGE_CODES.SUBSCRIPTION_NOT_ACTIVE]: 409,
  [MEMBERSHIP_TIER_CHANGE_CODES.SUBSCRIPTION_INVALID]: 409,
  [MEMBERSHIP_TIER_CHANGE_CODES.PAYMENT_METHOD_REQUIRED]: 402,
  [MEMBERSHIP_TIER_CHANGE_CODES.STRIPE_UPDATE_FAILED]: 502,
  [MEMBERSHIP_TIER_CHANGE_CODES.DOWNGRADE_ALREADY_SCHEDULED]: 409,
  [MEMBERSHIP_TIER_CHANGE_CODES.NOT_CANCELLING]: 400,
  [MEMBERSHIP_TIER_CHANGE_CODES.TERMS_REQUIRED]: 400,
  [MEMBERSHIP_TIER_CHANGE_CODES.GOLD_PRICE_NOT_CONFIGURED]: 409,
};

export interface MembershipTierSummary {
  tier: string;
  displayName: string;
  price: number;
  displayOrder?: number;
  currency?: string;
}

export interface TierChangeEstimate {
  currentTier: MembershipTierSummary;
  newTier: MembershipTierSummary;
  remainingDays: number;
  totalDays: number;
  proratedAmount: number;
  currency: string;
  isUpgrade: boolean;
  /** ISO date string — clients format for display */
  renewalDate: string;
  pointsAtRisk: number;
  currentPointsBalance: number;
  entitlementsLost: Array<{ key: string; name: string; currentValue: unknown; newValue: unknown }>;
  downgradeEffectiveDate: string;
  isCancelling: boolean;
  willResumeOnUpgrade: boolean;
}

export interface MembershipChangeErrorBody {
  success?: false;
  error?: string;
  code?: MembershipTierChangeCode | string;
}

export interface MembershipChangeTierResponseData {
  membership: unknown;
  invoice: unknown;
  invoiceUrl?: string;
  resumedOnUpgrade: boolean;
}

/** True when an error body should offer Billing Portal recovery. */
export function requiresPaymentMethodRecovery(code: string | undefined | null): boolean {
  return code === MEMBERSHIP_TIER_CHANGE_CODES.PAYMENT_METHOD_REQUIRED;
}

// ============================================================
// Stripe cancel_at_period_end sync (Billing Portal cancel/resume)
// One domain rule for UserMembership and tag Subscription.
// ============================================================

export type StripeCancelSyncAction = 'none' | 'cancel' | 'resume' | 'expire';

export interface StripeCancelSyncInput {
  stripeStatus: string;
  cancelAtPeriodEnd: boolean;
  localCancelledAt: Date | string | null | undefined;
  localStatus: string;
}

/**
 * Resolve how local cancel fields should follow Stripe.
 * Stripe is authoritative for Billing Portal cancel/resume.
 */
export function resolveStripeCancelSyncAction(input: StripeCancelSyncInput): StripeCancelSyncAction {
  const localStatus = input.localStatus;
  if (localStatus !== 'active' && localStatus !== 'cancelled') return 'none';

  const stripeCanceled =
    input.stripeStatus === 'canceled' || input.stripeStatus === 'incomplete_expired';
  const localCancelling = Boolean(input.localCancelledAt);

  if (stripeCanceled) {
    return localStatus === 'active' ? 'expire' : 'none';
  }
  if (input.cancelAtPeriodEnd && !localCancelling && localStatus === 'active') {
    return 'cancel';
  }
  if (!input.cancelAtPeriodEnd && localCancelling && localStatus === 'active') {
    return 'resume';
  }
  return 'none';
}

// ============================================================
// Gold tag-subscription billing interval (monthly ↔ annual)
// planType stays 'gold'; only renewalMethod/price change.
// ============================================================

export const GOLD_BILLING_SETTING_KEYS = {
  monthlyPrice: 'guardian.goldPrice',
  annualPrice: 'guardian.goldAnnualPrice',
  stripeProductId: 'gold.stripeProductId',
} as const;

export type GoldBillingInterval = 'monthly' | 'annual';

/** Single convention for cached Stripe price IDs per gold billing interval. */
export function goldStripePriceSettingKey(interval: GoldBillingInterval): string {
  return `gold.stripePriceId.${interval}`;
}

export const DEFAULT_CURRENCY = 'NZD';
export { STRIPE_DEFAULT_CURRENCY as STRIPE_CURRENCY_NZD } from './stripe';

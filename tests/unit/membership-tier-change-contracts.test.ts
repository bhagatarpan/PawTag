import { describe, it, expect } from 'vitest';
import {
  MEMBERSHIP_TIER_CHANGE_CODES,
  MEMBERSHIP_TIER_CHANGE_HTTP_STATUS,
  goldStripePriceSettingKey,
  isMembershipTierChangeCode,
  requiresPaymentMethodRecovery,
  requiresResubscribeRecovery,
  resolveStripeCancelSyncAction,
} from '../../packages/shared/src/membership';

describe('resolveStripeCancelSyncAction', () => {
  it('returns none when local status is not active/cancelled', () => {
    expect(
      resolveStripeCancelSyncAction({
        stripeStatus: 'active',
        cancelAtPeriodEnd: true,
        localCancelledAt: null,
        localStatus: 'pending_payment',
      }),
    ).toBe('none');
  });

  it('expires active membership when Stripe subscription is canceled', () => {
    expect(
      resolveStripeCancelSyncAction({
        stripeStatus: 'canceled',
        cancelAtPeriodEnd: false,
        localCancelledAt: null,
        localStatus: 'active',
      }),
    ).toBe('expire');
  });

  it('cancels when Stripe sets cancel_at_period_end and local is not cancelling', () => {
    expect(
      resolveStripeCancelSyncAction({
        stripeStatus: 'active',
        cancelAtPeriodEnd: true,
        localCancelledAt: null,
        localStatus: 'active',
      }),
    ).toBe('cancel');
  });

  it('resumes when Stripe clears cancel_at_period_end and local is cancelling', () => {
    expect(
      resolveStripeCancelSyncAction({
        stripeStatus: 'active',
        cancelAtPeriodEnd: false,
        localCancelledAt: new Date(),
        localStatus: 'active',
      }),
    ).toBe('resume');
  });

  it('returns none when states already match', () => {
    expect(
      resolveStripeCancelSyncAction({
        stripeStatus: 'active',
        cancelAtPeriodEnd: true,
        localCancelledAt: new Date(),
        localStatus: 'active',
      }),
    ).toBe('none');
  });
});

describe('membership tier-change contracts', () => {
  it('maps payment_method_required to 402', () => {
    expect(MEMBERSHIP_TIER_CHANGE_HTTP_STATUS[MEMBERSHIP_TIER_CHANGE_CODES.PAYMENT_METHOD_REQUIRED]).toBe(402);
  });

  it('detects payment method recovery codes', () => {
    expect(requiresPaymentMethodRecovery(MEMBERSHIP_TIER_CHANGE_CODES.PAYMENT_METHOD_REQUIRED)).toBe(true);
    expect(requiresPaymentMethodRecovery(MEMBERSHIP_TIER_CHANGE_CODES.STRIPE_UPDATE_FAILED)).toBe(false);
  });

  it('detects resubscribe recovery codes for broken billing subscriptions', () => {
    expect(requiresResubscribeRecovery(MEMBERSHIP_TIER_CHANGE_CODES.SUBSCRIPTION_MISSING)).toBe(true);
    expect(requiresResubscribeRecovery(MEMBERSHIP_TIER_CHANGE_CODES.SUBSCRIPTION_NOT_ACTIVE)).toBe(true);
    expect(requiresResubscribeRecovery(MEMBERSHIP_TIER_CHANGE_CODES.SUBSCRIPTION_INVALID)).toBe(true);
    expect(requiresResubscribeRecovery(MEMBERSHIP_TIER_CHANGE_CODES.PAYMENT_METHOD_REQUIRED)).toBe(false);
  });

  it('recognizes membership tier-change codes', () => {
    expect(isMembershipTierChangeCode(MEMBERSHIP_TIER_CHANGE_CODES.SUBSCRIPTION_MISSING)).toBe(true);
    expect(isMembershipTierChangeCode('not_a_code')).toBe(false);
  });

  it('uses one gold stripe price setting key convention', () => {
    expect(goldStripePriceSettingKey('monthly')).toBe('gold.stripePriceId.monthly');
    expect(goldStripePriceSettingKey('annual')).toBe('gold.stripePriceId.annual');
  });
});

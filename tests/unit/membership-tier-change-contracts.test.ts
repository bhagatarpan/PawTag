import { describe, it, expect } from 'vitest';
import {
  MEMBERSHIP_TIER_CHANGE_CODES,
  MEMBERSHIP_TIER_CHANGE_HTTP_STATUS,
  goldStripePriceSettingKey,
  requiresPaymentMethodRecovery,
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

  it('uses one gold stripe price setting key convention', () => {
    expect(goldStripePriceSettingKey('monthly')).toBe('gold.stripePriceId.monthly');
    expect(goldStripePriceSettingKey('annual')).toBe('gold.stripePriceId.annual');
  });
});

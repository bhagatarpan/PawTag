import { describe, it, expect } from 'vitest';
import {
  isCancellingMembership,
  requiresPaymentForKeep,
  KEEP_MEMBERSHIP_OUTCOMES,
} from '../../packages/shared/src/membership';

describe('requiresPaymentForKeep', () => {
  const now = new Date('2026-10-05T12:00:00Z');

  it('returns false when benefits are still active', () => {
    const result = requiresPaymentForKeep(
      { currentPeriodEnd: new Date('2027-10-02T00:00:00Z') },
      now,
    );
    expect(result.requiresPayment).toBe(false);
    expect(result.reason).toBe('benefits_active');
  });

  it('returns true when benefits period has ended', () => {
    const result = requiresPaymentForKeep(
      { currentPeriodEnd: new Date('2026-10-04T00:00:00Z') },
      now,
    );
    expect(result.requiresPayment).toBe(true);
    expect(result.reason).toBe('benefits_exhausted');
  });

  it('returns true when period end is missing', () => {
    expect(requiresPaymentForKeep({}, now).requiresPayment).toBe(true);
  });
});

describe('isCancellingMembership', () => {
  it('is true when cancelledAt is set', () => {
    expect(isCancellingMembership({ cancelledAt: new Date(), status: 'active' })).toBe(true);
  });

  it('is true when status is cancelled', () => {
    expect(isCancellingMembership({ status: 'cancelled' })).toBe(true);
  });

  it('is false for ordinary active membership', () => {
    expect(isCancellingMembership({ status: 'active' })).toBe(false);
  });
});

describe('KEEP_MEMBERSHIP_OUTCOMES', () => {
  it('exposes stable outcome constants', () => {
    expect(KEEP_MEMBERSHIP_OUTCOMES.RESUMED).toBe('resumed');
    expect(KEEP_MEMBERSHIP_OUTCOMES.PAYMENT_REQUIRED).toBe('payment_required');
    expect(KEEP_MEMBERSHIP_OUTCOMES.ALREADY_ACTIVE).toBe('already_active');
  });
});

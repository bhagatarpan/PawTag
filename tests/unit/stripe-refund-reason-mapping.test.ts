import { describe, it, expect } from 'vitest';
import {
  mapStripeRefundReason,
  STRIPE_REFUND_REASONS,
} from '../../packages/api/src/commerce/providers/stripe';

describe('mapStripeRefundReason', () => {
  it('passes through valid Stripe refund reasons', () => {
    for (const r of STRIPE_REFUND_REASONS) {
      expect(mapStripeRefundReason(r)).toBe(r);
      expect(mapStripeRefundReason(r.toUpperCase())).toBe(r);
    }
  });

  it('maps free-text CSR reasons to requested_by_customer', () => {
    expect(mapStripeRefundReason('order damaged in shipping, customer want refund')).toBe('requested_by_customer');
    expect(mapStripeRefundReason('Too expensive')).toBe('requested_by_customer');
    expect(mapStripeRefundReason('')).toBe('requested_by_customer');
    expect(mapStripeRefundReason(undefined)).toBe('requested_by_customer');
  });

  it('does not invent Stripe enum values outside the allowed set', () => {
    const mapped = mapStripeRefundReason('fraudulent chargeback');
    expect(STRIPES_REFUND_REASONS_ALLOW(mapped)).toBe(true);
  });
});

function STRIPES_REFUND_REASONS_ALLOW(v: string): boolean {
  return ['duplicate', 'fraudulent', 'requested_by_customer'].includes(v);
}

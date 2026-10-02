import { describe, it, expect } from 'vitest';
import { StripePaymentProvider } from '../../packages/api/src/commerce/providers/stripe';

describe('Stripe mapRefund ARN/arrival extraction', () => {
  const provider = new StripePaymentProvider();

  it('extracts arn and expectedArrival from Stripe refund objects', () => {
    const mapped = (provider as any).mapRefund({
      id: 're_test_arn',
      status: 'succeeded',
      amount: 849,
      arn: 'ARN_12345',
      arrival_date: 1760000000,
    });

    expect(mapped.success).toBe(true);
    expect(mapped.refundId).toBe('re_test_arn');
    expect(mapped.amount).toBe(8.49);
    expect(mapped.arn).toBe('ARN_12345');
    expect(mapped.expectedArrival).toBeInstanceOf(Date);
    expect(mapped.expectedArrival.toISOString()).toBe(new Date(1760000000 * 1000).toISOString());
  });

  it('leaves arn/arrival undefined when Stripe omits them', () => {
    const mapped = (provider as any).mapRefund({
      id: 're_test_noarn',
      status: 'pending',
      amount: 1000,
    });

    expect(mapped.arn).toBeUndefined();
    expect(mapped.expectedArrival).toBeUndefined();
  });
});

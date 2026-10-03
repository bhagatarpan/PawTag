import { describe, it, expect } from 'vitest';
import {
  toCents,
  fromCents,
  computeRemainingRefundCents,
  isFullRefundAmount,
} from '../../packages/api/src/commerce/services/return-refund.service';

describe('return refund balance helpers', () => {
  it('converts dollars to cents safely', () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0)).toBe(0);
    expect(fromCents(1999)).toBe(19.99);
  });

  it('computes remaining refundable balance', () => {
    expect(computeRemainingRefundCents(10000, 0)).toBe(10000);
    expect(computeRemainingRefundCents(10000, 3000)).toBe(7000);
    expect(computeRemainingRefundCents(10000, 12000)).toBe(0);
  });

  it('detects full refund only when capture is exhausted', () => {
    expect(isFullRefundAmount(10000, 0, 10000)).toBe(true);
    expect(isFullRefundAmount(10000, 0, 3000)).toBe(false);
    expect(isFullRefundAmount(10000, 7000, 3000)).toBe(true);
    expect(isFullRefundAmount(10000, 7000, 2999)).toBe(false);
  });
});

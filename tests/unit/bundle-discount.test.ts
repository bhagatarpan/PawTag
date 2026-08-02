import { describe, it, expect } from 'vitest';
import { getBundleDiscount, BUNDLE_DISCOUNTS } from '@pawtag/shared';

describe('getBundleDiscount (shared)', () => {
  it('returns 0 for 0 items', () => {
    expect(getBundleDiscount(0)).toBe(0);
  });

  it('returns 0 for 1 item', () => {
    expect(getBundleDiscount(1)).toBe(0);
  });

  it('returns 10% for 2 items', () => {
    expect(getBundleDiscount(2)).toBe(10);
  });

  it('returns 15% for 3 items', () => {
    expect(getBundleDiscount(3)).toBe(15);
  });

  it('returns 15% for 4+ items', () => {
    expect(getBundleDiscount(5)).toBe(15);
    expect(getBundleDiscount(10)).toBe(15);
    expect(getBundleDiscount(100)).toBe(15);
  });

  it('BUNDLE_DISCOUNTS has correct values', () => {
    expect(BUNDLE_DISCOUNTS[2]).toBe(10);
    expect(BUNDLE_DISCOUNTS[3]).toBe(15);
  });
});

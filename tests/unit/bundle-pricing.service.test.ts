import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateBundleDiscount, clearBundlePricingCache } from '../../packages/api/src/services/bundle-pricing.service';

vi.mock('@pawtag/db', () => ({
  Setting: {
    findOne: vi.fn(),
  },
}));

import { Setting } from '@pawtag/db';

const mockSettingFindOne = vi.mocked(Setting.findOne);

beforeEach(() => {
  vi.clearAllMocks();
  clearBundlePricingCache();
});

describe('calculateBundleDiscount', () => {
  it('returns 0% for empty cart', async () => {
    const result = await calculateBundleDiscount([]);
    expect(result.percent).toBe(0);
    expect(result.amount).toBe(0);
    expect(result.subscriptionItemCount).toBe(0);
  });

  it('returns 0% for single subscription item', async () => {
    const items = [
      { productId: 'p1', isSubscription: true, unitPrice: 9.99, quantity: 1 },
    ];
    const result = await calculateBundleDiscount(items);
    expect(result.percent).toBe(0);
    expect(result.amount).toBe(0);
    expect(result.subscriptionItemCount).toBe(1);
  });

  it('returns 10% for 2 subscription items', async () => {
    const items = [
      { productId: 'p1', isSubscription: true, unitPrice: 9.99, quantity: 1 },
      { productId: 'p2', isSubscription: true, unitPrice: 19.99, quantity: 1 },
    ];
    const result = await calculateBundleDiscount(items);
    expect(result.percent).toBe(10);
    expect(result.subscriptionItemCount).toBe(2);
    expect(result.amount).toBeCloseTo(2.998, 1);
  });

  it('returns 15% for 3 subscription items', async () => {
    const items = [
      { productId: 'p1', isSubscription: true, unitPrice: 9.99, quantity: 1 },
      { productId: 'p2', isSubscription: true, unitPrice: 19.99, quantity: 1 },
      { productId: 'p3', isSubscription: true, unitPrice: 39.99, quantity: 1 },
    ];
    const result = await calculateBundleDiscount(items);
    expect(result.percent).toBe(15);
    expect(result.subscriptionItemCount).toBe(3);
    expect(result.amount).toBeCloseTo(10.497, 1);
  });

  it('ignores non-subscription items in count', async () => {
    const items = [
      { productId: 'p1', isSubscription: true, unitPrice: 9.99, quantity: 1 },
      { productId: 'p2', isSubscription: false, unitPrice: 19.99, quantity: 1 },
    ];
    const result = await calculateBundleDiscount(items);
    expect(result.subscriptionItemCount).toBe(1);
    expect(result.percent).toBe(0);
  });

  it('handles quantity > 1', async () => {
    const items = [
      { productId: 'p1', isSubscription: true, unitPrice: 9.99, quantity: 2 },
    ];
    const result = await calculateBundleDiscount(items);
    expect(result.subscriptionItemCount).toBe(2);
    expect(result.percent).toBe(10);
  });

  it('rounds discount amount to 2 decimal places', async () => {
    const items = [
      { productId: 'p1', isSubscription: true, unitPrice: 33.33, quantity: 1 },
      { productId: 'p2', isSubscription: true, unitPrice: 33.33, quantity: 1 },
    ];
    const result = await calculateBundleDiscount(items);
    // 66.66 * 0.10 = 6.666, rounded to 6.67
    expect(result.amount).toBe(6.67);
  });

  it('returns reason string when discount applies', async () => {
    const items = [
      { productId: 'p1', isSubscription: true, unitPrice: 9.99, quantity: 1 },
      { productId: 'p2', isSubscription: true, unitPrice: 19.99, quantity: 1 },
    ];
    const result = await calculateBundleDiscount(items);
    expect(result.reason).toContain('Bundle discount');
    expect(result.reason).toContain('2 tags');
  });
});

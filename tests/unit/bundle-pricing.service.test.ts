import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLean, mockFindOne } = vi.hoisted(() => ({
  mockLean: vi.fn().mockResolvedValue(null),
  mockFindOne: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
}));

vi.mock('@pawtag/db', () => ({
  Setting: {
    findOne: mockFindOne,
  },
}));

import { calculateBundleDiscount, clearBundlePricingCache } from '../../packages/api/src/services/bundle-pricing.service';

beforeEach(() => {
  vi.clearAllMocks();
  clearBundlePricingCache();
  mockLean.mockResolvedValue(null);
  mockFindOne.mockReturnValue({ lean: mockLean });
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

  it('returns 10% for 2 subscription items (default)', async () => {
    const items = [
      { productId: 'p1', isSubscription: true, unitPrice: 9.99, quantity: 1 },
      { productId: 'p2', isSubscription: true, unitPrice: 19.99, quantity: 1 },
    ];
    const result = await calculateBundleDiscount(items);
    expect(result.percent).toBe(10);
    expect(result.subscriptionItemCount).toBe(2);
    expect(result.amount).toBeCloseTo(2.998, 1);
  });

  it('returns 15% for 3 subscription items (default)', async () => {
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

  it('uses custom discount from settings', async () => {
    mockFindOne.mockImplementation((query: any) => {
      if (query.key === 'pricing.bundle2Discount') {
        return { lean: vi.fn().mockResolvedValue({ value: '20' }) };
      }
      if (query.key === 'pricing.bundle3Discount') {
        return { lean: vi.fn().mockResolvedValue({ value: '25' }) };
      }
      return { lean: vi.fn().mockResolvedValue(null) };
    });

    const items = [
      { productId: 'p1', isSubscription: true, unitPrice: 10, quantity: 1 },
      { productId: 'p2', isSubscription: true, unitPrice: 10, quantity: 1 },
    ];
    const result = await calculateBundleDiscount(items);
    expect(result.percent).toBe(20);
    expect(result.amount).toBe(4);
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

  it('caches settings for 1 minute', async () => {
    const items = [
      { productId: 'p1', isSubscription: true, unitPrice: 10, quantity: 1 },
      { productId: 'p2', isSubscription: true, unitPrice: 10, quantity: 1 },
    ];

    await calculateBundleDiscount(items);
    await calculateBundleDiscount(items);

    // Setting.findOne called twice per call (bundle2Discount, bundle3Discount)
    // But second call should use cache
    expect(mockFindOne).toHaveBeenCalledTimes(2);
  });
});

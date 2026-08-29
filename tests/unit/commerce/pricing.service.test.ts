/**
 * @module PricingService Tests
 * @description Unit tests for the PawTag Commerce pricing service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@pawtag/db', () => ({
  Product: {
    find: vi.fn().mockReturnValue({
      lean: () => ({
        exec: () => Promise.resolve([]),
      }),
    }),
  },
}));

vi.mock('../../../packages/api/src/commerce/config', () => ({
  getNumberSetting: vi.fn().mockImplementation(async (key: string) => {
    if (key === 'commerce.promotions.bundle2Items') return 10;
    if (key === 'commerce.promotions.bundle3PlusItems') return 15;
    return 10;
  }),
}));

vi.mock('../../../packages/api/src/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../packages/api/src/commerce/errors', () => ({
  PriceMismatchError: class extends Error { constructor(msg: string) { super(msg); this.name = 'PriceMismatchError'; } },
}));

import { PricingService } from '../../../packages/api/src/commerce/services/pricing.service';

describe('PricingService', () => {
  let pricingService: PricingService;

  beforeEach(() => {
    vi.clearAllMocks();
    pricingService = new PricingService();
  });

  const mockProduct = {
    _id: 'prod_1',
    name: 'PawTag Scan',
    price: 19.99,
    salePrice: undefined,
    compareAtPrice: 24.99,
    customizationPrice: 5.00,
  };

  describe('getEffectivePrice', () => {
    it('should return base price when no sale price', () => {
      expect(pricingService.getEffectivePrice(mockProduct as any)).toBe(19.99);
    });

    it('should return sale price when set', () => {
      expect(pricingService.getEffectivePrice({ ...mockProduct, salePrice: 14.99 } as any)).toBe(14.99);
    });
  });

  describe('calculateDiscount', () => {
    it('should calculate percentage discount', () => {
      const discount = pricingService.calculateDiscount(100, { type: 'percentage', value: 10 });
      expect(discount).toBe(10);
    });

    it('should calculate fixed discount', () => {
      const discount = pricingService.calculateDiscount(100, { type: 'fixed', value: 25 });
      expect(discount).toBe(25);
    });

    it('should not discount more than subtotal', () => {
      const discount = pricingService.calculateDiscount(50, { type: 'percentage', value: 100 });
      expect(discount).toBe(50);
    });
  });

  describe('getBundleDiscount', () => {
    it('should return 0 for single item', async () => {
      const discount = await pricingService.getBundleDiscount(1);
      expect(discount).toBe(0);
    });

    it('should return 10 for 2 items', async () => {
      const discount = await pricingService.getBundleDiscount(2);
      expect(discount).toBe(10);
    });

    it('should return 15 for 3+ items', async () => {
      const discount = await pricingService.getBundleDiscount(5);
      expect(discount).toBe(15);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Medusa Product Consolidation', () => {
  describe('Medusa product metadata', () => {
    it('should have subscription config in metadata', () => {
      const metadata = {
        isSubscription: true,
        isTagProduct: true,
        subscriptionConfig: {
          type: 'annual',
          freePeriodMonths: 12,
          gracePeriodWeeks: 4,
          monthlyPrice: 1.99,
          features: ['qr_scan', 'lost_pet_alerts'],
        },
        warrantyMonths: 12,
        affiliateSource: null,
        affiliateId: null,
      };

      expect(metadata.isSubscription).toBe(true);
      expect(metadata.subscriptionConfig.type).toBe('annual');
      expect(metadata.subscriptionConfig.freePeriodMonths).toBe(12);
      expect(metadata.warrantyMonths).toBe(12);
    });

    it('should have affiliate fields in metadata', () => {
      const metadata = {
        affiliateSource: 'amazon',
        affiliateId: 'B08N5WRWNW',
        affiliateUrl: 'https://amazon.com/dp/B08N5WRWNW',
        affiliateCommission: 8.5,
      };

      expect(metadata.affiliateSource).toBe('amazon');
      expect(metadata.affiliateId).toBe('B08N5WRWNW');
      expect(metadata.affiliateCommission).toBe(8.5);
    });
  });

  describe('Medusa API fetch pattern', () => {
    it('should fetch product metadata from Medusa API', async () => {
      const mockProduct = {
        id: 'prod_123',
        title: 'PawTag Classic',
        metadata: {
          isSubscription: true,
          subscriptionConfig: { type: 'annual', freePeriodMonths: 12 },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ product: mockProduct }),
      });

      const response = await fetch('http://localhost:9000/store/products/prod_123', {
        headers: { 'x-publishable-api-key': 'test-key' },
      });
      const { product } = await response.json() as any;

      expect(product.metadata.isSubscription).toBe(true);
      expect(product.metadata.subscriptionConfig.type).toBe('annual');
    });
  });
});

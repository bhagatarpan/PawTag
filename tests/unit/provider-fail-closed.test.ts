import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalEnv = { ...process.env };

describe('Phase 01 — Provider fail-closed (production)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    delete process.env.SHIPPING_PROVIDER_API_KEY;
    delete process.env.SMS_PROVIDER;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('push-notification.service', () => {
    it('does not report push as delivered in production when Firebase is unconfigured', async () => {
      process.env.NODE_ENV = 'production';

      vi.doMock('@pawtag/db', () => ({
        PushToken: {
          find: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([{ token: 'tok_1', platform: 'web' }]),
          }),
        },
      }));

      const { sendPushToUser } = await import('../../packages/api/src/services/push-notification.service');
      const result = await sendPushToUser('user1', 'Title', 'Body');

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.error).toMatch(/not configured in production/i);
    });

    it('still uses demo path only outside production when Firebase unconfigured', async () => {
      process.env.NODE_ENV = 'development';

      vi.doMock('@pawtag/db', () => ({
        PushToken: {
          find: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([{ token: 'tok_1', platform: 'web' }]),
          }),
        },
      }));

      const { sendPushToUser } = await import('../../packages/api/src/services/push-notification.service');
      const result = await sendPushToUser('user1', 'Title', 'Body');

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);
    });
  });

  describe('shipping.service createShipment', () => {
    it('fails closed in production without a shipping API key (no fake tracking)', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SHIPPING_PROVIDER_API_KEY;

      const { createShipment } = await import('../../packages/api/src/services/shipping.service');
      const result = await createShipment({
        orderNumber: 'ORD-1',
        shippingAddress: { line1: '1 St', city: 'AKL', state: 'AKL', zip: '1010', country: 'NZ' },
        items: [{ productName: 'Tag', quantity: 1 }],
      });

      expect(result.success).toBe(false);
      expect(result.trackingNumber).toBeUndefined();
      expect(result.error).toMatch(/not configured in production/i);
    });

    it('allows demo tracking outside production for local CI', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.SHIPPING_PROVIDER_API_KEY;

      const { createShipment } = await import('../../packages/api/src/services/shipping.service');
      const result = await createShipment({
        orderNumber: 'ORD-2',
        shippingAddress: { line1: '1 St', city: 'AKL', state: 'AKL', zip: '1010', country: 'NZ' },
        items: [{ productName: 'Tag', quantity: 1 }],
      });

      expect(result.success).toBe(true);
      expect(result.trackingNumber).toMatch(/^NZ/);
    });
  });

  describe('sms.service DemoSMSProvider', () => {
    it('fails closed in production when SMS provider is not configured', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SMS_PROVIDER;

      vi.doMock('@pawtag/db', () => ({
        CmsSmsTemplate: { findOne: vi.fn().mockResolvedValue(null) },
      }));

      const { sendSMS } = await import('../../packages/api/src/services/sms.service');
      const result = await sendSMS('+64211111111', 'Your code is 123456');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not configured in production/i);
    });
  });
});

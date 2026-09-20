import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  resolvePaymentMode,
  isValidPaymentMode,
  isFakeMode,
  isStripeTestMode,
  isStripeLiveMode,
  isStripeEnabled,
  isFakePaymentIntentId,
  getPaymentModeLabel,
} from '../../packages/api/src/commerce/payment-mode';

describe('PaymentMode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PAYMENT_MODE;
    delete process.env.STRIPE_SECRET_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('resolvePaymentMode', () => {
    it('returns fake when no env vars set', () => {
      expect(resolvePaymentMode()).toBe('fake');
    });

    it('returns fake when STRIPE_SECRET_KEY is sk_test_demo_key', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_demo_key';
      expect(resolvePaymentMode()).toBe('fake');
    });

    it('returns stripe_test when STRIPE_SECRET_KEY starts with sk_test_', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_abc123';
      expect(resolvePaymentMode()).toBe('stripe_test');
    });

    it('returns stripe_test when STRIPE_SECRET_KEY starts with rk_test_', () => {
      process.env.STRIPE_SECRET_KEY = 'rk_test_abc123';
      expect(resolvePaymentMode()).toBe('stripe_test');
    });

    it('returns stripe_live when STRIPE_SECRET_KEY starts with sk_live_', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_live_abc123';
      expect(resolvePaymentMode()).toBe('stripe_live');
    });

    it('returns stripe_live when STRIPE_SECRET_KEY starts with rk_live_', () => {
      process.env.STRIPE_SECRET_KEY = 'rk_live_abc123';
      expect(resolvePaymentMode()).toBe('stripe_live');
    });

    it('PAYMENT_MODE=stripe_live overrides key detection', () => {
      process.env.PAYMENT_MODE = 'stripe_live';
      process.env.STRIPE_SECRET_KEY = 'sk_test_abc123';
      expect(resolvePaymentMode()).toBe('stripe_live');
    });

    it('PAYMENT_MODE=fake overrides key detection', () => {
      process.env.PAYMENT_MODE = 'fake';
      process.env.STRIPE_SECRET_KEY = 'sk_live_abc123';
      expect(resolvePaymentMode()).toBe('fake');
    });

    it('PAYMENT_MODE=stripe_test overrides key detection', () => {
      process.env.PAYMENT_MODE = 'stripe_test';
      process.env.STRIPE_SECRET_KEY = 'sk_live_abc123';
      expect(resolvePaymentMode()).toBe('stripe_test');
    });

    it('falls back to key detection when PAYMENT_MODE is invalid', () => {
      process.env.PAYMENT_MODE = 'invalid_mode';
      process.env.STRIPE_SECRET_KEY = 'sk_live_abc123';
      expect(resolvePaymentMode()).toBe('stripe_live');
    });

    it('returns fake for unknown key prefix', () => {
      process.env.STRIPE_SECRET_KEY = 'unknown_prefix_abc';
      expect(resolvePaymentMode()).toBe('fake');
    });
  });

  describe('isValidPaymentMode', () => {
    it('accepts fake', () => {
      expect(isValidPaymentMode('fake')).toBe(true);
    });

    it('accepts stripe_test', () => {
      expect(isValidPaymentMode('stripe_test')).toBe(true);
    });

    it('accepts stripe_live', () => {
      expect(isValidPaymentMode('stripe_live')).toBe(true);
    });

    it('rejects invalid values', () => {
      expect(isValidPaymentMode('test')).toBe(false);
      expect(isValidPaymentMode('live')).toBe(false);
      expect(isValidPaymentMode('production')).toBe(false);
      expect(isValidPaymentMode('')).toBe(false);
    });
  });

  describe('mode check helpers', () => {
    it('isFakeMode returns true when PAYMENT_MODE=fake', () => {
      process.env.PAYMENT_MODE = 'fake';
      expect(isFakeMode()).toBe(true);
    });

    it('isFakeMode returns false when PAYMENT_MODE=stripe_live', () => {
      process.env.PAYMENT_MODE = 'stripe_live';
      expect(isFakeMode()).toBe(false);
    });

    it('isStripeTestMode returns true when PAYMENT_MODE=stripe_test', () => {
      process.env.PAYMENT_MODE = 'stripe_test';
      expect(isStripeTestMode()).toBe(true);
    });

    it('isStripeLiveMode returns true when PAYMENT_MODE=stripe_live', () => {
      process.env.PAYMENT_MODE = 'stripe_live';
      expect(isStripeLiveMode()).toBe(true);
    });

    it('isStripeEnabled returns true for stripe_test', () => {
      process.env.PAYMENT_MODE = 'stripe_test';
      expect(isStripeEnabled()).toBe(true);
    });

    it('isStripeEnabled returns true for stripe_live', () => {
      process.env.PAYMENT_MODE = 'stripe_live';
      expect(isStripeEnabled()).toBe(true);
    });

    it('isStripeEnabled returns false for fake', () => {
      process.env.PAYMENT_MODE = 'fake';
      expect(isStripeEnabled()).toBe(false);
    });
  });

  describe('isFakePaymentIntentId', () => {
    it('returns true for pi_demo_ prefix', () => {
      expect(isFakePaymentIntentId('pi_demo_1234567890_fake')).toBe(true);
    });

    it('returns true for re_demo_ prefix', () => {
      expect(isFakePaymentIntentId('re_demo_1234567890')).toBe(true);
    });

    it('returns false for real pi_ prefix', () => {
      expect(isFakePaymentIntentId('pi_abc123')).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isFakePaymentIntentId(null)).toBe(false);
      expect(isFakePaymentIntentId(undefined)).toBe(false);
    });
  });

  describe('getPaymentModeLabel', () => {
    it('returns correct label for fake', () => {
      expect(getPaymentModeLabel('fake')).toContain('Fake');
    });

    it('returns correct label for stripe_test', () => {
      expect(getPaymentModeLabel('stripe_test')).toContain('Stripe Test');
    });

    it('returns correct label for stripe_live', () => {
      expect(getPaymentModeLabel('stripe_live')).toContain('Stripe Live');
    });
  });
});

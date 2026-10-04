import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getStripeClient,
  resetStripeClientCache,
  setStripeClientForTests,
  hasCachedStripeClient,
} from '../../packages/api/src/lib/stripe-client';
import {
  STRIPE_DEFAULT_API_VERSION,
  isStripeDemoSubscriptionId,
  isStripeTestSecretKey,
  isStripeLiveSecretKey,
} from '../../packages/shared/src/stripe';

describe('central Stripe client factory', () => {
  const prev = {
    mode: process.env.PAYMENT_MODE,
    key: process.env.STRIPE_SECRET_KEY,
    apiVersion: process.env.STRIPE_API_VERSION,
  };

  beforeEach(() => {
    resetStripeClientCache();
  });

  afterEach(() => {
    resetStripeClientCache();
    if (prev.mode === undefined) delete process.env.PAYMENT_MODE;
    else process.env.PAYMENT_MODE = prev.mode;
    if (prev.key === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = prev.key;
    if (prev.apiVersion === undefined) delete process.env.STRIPE_API_VERSION;
    else process.env.STRIPE_API_VERSION = prev.apiVersion;
  });

  it('throws in fake mode instead of constructing Stripe', () => {
    process.env.PAYMENT_MODE = 'fake';
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
    expect(() => getStripeClient()).toThrow(/PAYMENT_MODE=fake/i);
  });

  it('throws when secret key is missing in stripe mode', () => {
    process.env.PAYMENT_MODE = 'stripe_test';
    delete process.env.STRIPE_SECRET_KEY;
    expect(() => getStripeClient()).toThrow(/STRIPE_SECRET_KEY is not configured/);
  });

  it('uses injected client for tests without real SDK construction', () => {
    process.env.PAYMENT_MODE = 'stripe_test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    const mock = { id: 'mock-stripe' } as any;
    setStripeClientForTests(mock);
    expect(hasCachedStripeClient()).toBe(true);
    expect(getStripeClient()).toBe(mock);
  });

  it('shared stripe constants expose default API version and demo helpers', () => {
    expect(STRIPE_DEFAULT_API_VERSION).toBeTruthy();
    expect(isStripeTestSecretKey('sk_test_abc')).toBe(true);
    expect(isStripeLiveSecretKey('sk_live_abc')).toBe(true);
    expect(isStripeDemoSubscriptionId('demo')).toBe(true);
    expect(isStripeDemoSubscriptionId('sub_123')).toBe(false);
  });
});

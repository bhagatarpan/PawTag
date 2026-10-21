import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Card brand acceptance — founder decision (Oct 2026):
 * PawTag accepts Visa, Mastercard and American Express, all under Stripe's
 * single 'card' payment method type. Klarna/BNPL and wallets are NOT offered
 * (server-side `payment_method_types` is authoritative, not just the
 * Payment Element display), and Amex is included in the card processing
 * fee schedule.
 */

const mocks = vi.hoisted(() => ({
  getSetting: vi.fn(async () => ''),
}));

vi.mock('../../packages/api/src/commerce/config', () => ({
  getSetting: mocks.getSetting,
}));

vi.mock('../../packages/api/src/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { PAWTAG_PAYMENT_METHOD_TYPES } from '@pawtag/shared';
import { stripePaymentProvider } from '../../packages/api/src/commerce/providers/stripe';
import {
  setStripeClientForTests,
  resetStripeClientCache,
} from '../../packages/api/src/lib/stripe-client';

describe('PAWTAG_PAYMENT_METHOD_TYPES', () => {
  it('offers card only — Visa/Mastercard/Amex accepted, Klarna/BNPL and wallets not offered', () => {
    expect([...PAWTAG_PAYMENT_METHOD_TYPES]).toEqual(['card']);
  });
});

describe('CPF appliesTo registry default', () => {
  it('includes American Express alongside visa and mastercard', async () => {
    const { COMMERCE_SETTINGS } = await vi.importActual<typeof import('../../packages/api/src/commerce/config')>(
      '../../packages/api/src/commerce/config',
    );
    expect(COMMERCE_SETTINGS['commerce.cpf.appliesTo'].default).toBe('visa,mastercard,amex');
  });
});

describe('StripePaymentProvider.createPaymentIntent', () => {
  const stripeCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYMENT_MODE = 'stripe_test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
    stripeCreate.mockResolvedValue({ id: 'pi_test_1', client_secret: 'pi_test_1_secret', status: 'succeeded', metadata: {} });
    setStripeClientForTests({ paymentIntents: { create: stripeCreate } } as any);
  });

  afterEach(() => {
    resetStripeClientCache();
    process.env.PAYMENT_MODE = 'fake';
    delete process.env.STRIPE_SECRET_KEY;
  });

  it('creates intents with payment_method_types: ["card"] and never automatic_payment_methods', async () => {
    await stripePaymentProvider.createPaymentIntent({
      amount: 59.99,
      currency: 'NZD',
      orderId: 'order_1',
      orderNumber: 'PT-000001',
      customerEmail: 'customer@example.com',
    });

    expect(stripeCreate).toHaveBeenCalledTimes(1);
    const params = stripeCreate.mock.calls[0][0];
    expect(params.payment_method_types).toEqual(['card']);
    expect(params.automatic_payment_methods).toBeUndefined();
  });
});

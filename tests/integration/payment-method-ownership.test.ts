import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, UserMembership, MembershipTier } from '@pawtag/db';

/**
 * Saved-card ownership: a client-supplied pm_ id must only be used for charges
 * when it is attached to that user's own Stripe Customer.
 */
describe('Saved payment method ownership + subscribe selection', () => {
  let mongoServer: MongoMemoryServer;
  const originalEnv = { ...process.env };
  let userId: string;

  const OWNED_CARDS = [
    { id: 'pm_owned_default', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } },
    { id: 'pm_owned_second', card: { brand: 'mastercard', last4: '5555', exp_month: 1, exp_year: 2031 } },
  ];

  function mockStripe(listData = OWNED_CARDS) {
    const listPaymentMethods = vi.fn().mockResolvedValue({ data: listData });
    const retrieve = vi.fn().mockResolvedValue({
      invoice_settings: { default_payment_method: 'pm_owned_default' },
    });
    const subscriptionsCreate = vi.fn().mockResolvedValue({
      id: 'sub_test_1',
      latest_invoice: { payment_intent: { client_secret: 'pi_test_secret_1' } },
    });
    return {
      subscriptionsCreate,
      client: {
        customers: { listPaymentMethods, retrieve },
        subscriptions: { create: subscriptionsCreate },
        paymentMethods: { retrieve: vi.fn() },
      } as any,
    };
  }

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    process.env = originalEnv;
  }, 10000);

  beforeEach(async () => {
    await User.deleteMany({});
    await UserMembership.deleteMany({});
    await MembershipTier.deleteMany({});
    process.env.PAYMENT_MODE = 'stripe_test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_ownership';
    const user = await User.create({
      email: 'pm-own@example.com',
      passwordHash: 'x',
      fullName: 'PM Own',
      phoneNumber: '+64210001111',
      role: 'customer',
      status: 'active',
      stripeCustomerId: 'cus_own_test',
    });
    userId = user._id.toString();
  });

  afterEach(async () => {
    process.env.PAYMENT_MODE = originalEnv.PAYMENT_MODE || 'fake';
    const stripeClient = await import('../../packages/api/src/lib/stripe-client');
    stripeClient.resetStripeClientCache();
  });

  describe('userOwnsPaymentMethod', () => {
    it('returns the id when the card is attached to the user', async () => {
      const { client } = mockStripe();
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);
      const { userOwnsPaymentMethod } = await import(
        '../../packages/api/src/services/payment-method.service'
      );

      await expect(userOwnsPaymentMethod(userId, 'pm_owned_second')).resolves.toBe('pm_owned_second');
    });

    it('rejects a card id that is not on the user (foreign or unknown)', async () => {
      const { client } = mockStripe();
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);
      const { userOwnsPaymentMethod } = await import(
        '../../packages/api/src/services/payment-method.service'
      );

      await expect(userOwnsPaymentMethod(userId, 'pm_someone_elses_card')).resolves.toBeNull();
    });

    it('rejects non payment-method identifiers', async () => {
      const { client } = mockStripe();
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);
      const { userOwnsPaymentMethod } = await import(
        '../../packages/api/src/services/payment-method.service'
      );

      await expect(userOwnsPaymentMethod(userId, 'ch_123_not_a_pm')).resolves.toBeNull();
      await expect(userOwnsPaymentMethod(userId, '')).resolves.toBeNull();
    });

    it('returns null in fake mode (no Stripe list to validate against)', async () => {
      process.env.PAYMENT_MODE = 'fake';
      const { userOwnsPaymentMethod } = await import(
        '../../packages/api/src/services/payment-method.service'
      );
      await expect(userOwnsPaymentMethod(userId, 'pm_owned_default')).resolves.toBeNull();
    });
  });

  describe('subscribeToTier card selection', () => {
    async function seedTier() {
      return MembershipTier.create({
        tier: 'gold',
        displayName: 'Gold',
        name: 'Gold',
        description: 'Gold membership tier',
        price: 89,
        tagLimit: 3,
        isActive: true,
        stripePriceId: 'price_test_gold',
      });
    }

    it('charges the customer-chosen card when it belongs to them', async () => {
      const { client, subscriptionsCreate } = mockStripe();
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);
      const { subscribeToTier } = await import('../../packages/api/src/services/membership.service');
      const tier = await seedTier();

      const result = await subscribeToTier(userId, tier._id.toString(), 'pm_owned_second');

      expect(subscriptionsCreate).toHaveBeenCalledTimes(1);
      const params = subscriptionsCreate.mock.calls[0][0];
      expect(params.customer).toBe('cus_own_test');
      expect(params.default_payment_method).toBe('pm_owned_second');
      expect(result.clientSecret).toBe('pi_test_secret_1');
    });

    it('falls back to the default card when the chosen id is foreign', async () => {
      const { client, subscriptionsCreate } = mockStripe();
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);
      const { subscribeToTier } = await import('../../packages/api/src/services/membership.service');
      const tier = await seedTier();

      await subscribeToTier(userId, tier._id.toString(), 'pm_someone_elses_card');

      const params = subscriptionsCreate.mock.calls[0][0];
      expect(params.default_payment_method).toBe('pm_owned_default');
    });

    it('preselects the default card when no choice is supplied', async () => {
      const { client, subscriptionsCreate } = mockStripe();
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);
      const { subscribeToTier } = await import('../../packages/api/src/services/membership.service');
      const tier = await seedTier();

      await subscribeToTier(userId, tier._id.toString());

      const params = subscriptionsCreate.mock.calls[0][0];
      expect(params.default_payment_method).toBe('pm_owned_default');
    });
  });
});

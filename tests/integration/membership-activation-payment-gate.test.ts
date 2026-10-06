import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { UserMembership, MembershipTier, User } from '@pawtag/db';

describe('Phase 03 — Membership activation requires Stripe payment state', () => {
  let mongoServer: MongoMemoryServer;
  const originalEnv = { ...process.env };

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
    await UserMembership.deleteMany({});
    await MembershipTier.deleteMany({});
    await User.deleteMany({});
    process.env.PAYMENT_MODE = 'stripe_test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_phase03';
  });

  afterEach(() => {
    process.env.PAYMENT_MODE = originalEnv.PAYMENT_MODE || 'fake';
  });

  async function seedMembership(email: string) {
    const tier = await MembershipTier.create({
      tier: 'gold',
      displayName: 'Gold',
      name: 'Gold',
      description: 'Gold membership tier',
      price: 19.99,
      tagLimit: 3,
      isActive: true,
    });
    const user = await User.create({
      email,
      passwordHash: 'x',
      fullName: 'Memb User',
      phoneNumber: '+64210005555',
      role: 'customer',
      status: 'active',
    });
    return UserMembership.create({
      userId: user._id,
      tierId: tier._id,
      status: 'pending_payment',
      billingCycle: 'annual',
      price: 19.99,
      currency: 'NZD',
      startDate: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      stripeSubscriptionId: 'sub_gate_test',
      autoRenew: true,
    });
  }

  it('refuses to activate pending membership when Stripe subscription is not payable', async () => {
    const membership = await seedMembership('memb@example.com');

    const stripeClient = await import('../../packages/api/src/lib/stripe-client');
    stripeClient.setStripeClientForTests({
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({ id: 'sub_gate_test', status: 'incomplete' }),
      },
      paymentMethods: { retrieve: vi.fn() },
    } as any);

    const { activateMembership } = await import('../../packages/api/src/services/membership.service');

    await expect(activateMembership(membership._id.toString())).rejects.toThrow(/not complete|incomplete/i);

    const after = await UserMembership.findById(membership._id).lean();
    expect(after!.status).toBe('pending_payment');

    stripeClient.resetStripeClientCache();
  });

  it('activates when Stripe subscription is active', async () => {
    const membership = await seedMembership('memb2@example.com');

    const stripeClient = await import('../../packages/api/src/lib/stripe-client');
    stripeClient.setStripeClientForTests({
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: 'sub_gate_test',
          status: 'active',
          default_payment_method: null,
        }),
      },
      paymentMethods: { retrieve: vi.fn() },
    } as any);

    const { activateMembership } = await import('../../packages/api/src/services/membership.service');
    const activated = await activateMembership(membership._id.toString());
    expect(activated.status).toBe('active');

    stripeClient.resetStripeClientCache();
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, MembershipTier, UserMembership, SavedCardExpiryNotice, Notification } from '@pawtag/db';

const { mockSendCmsEmail } = vi.hoisted(() => ({ mockSendCmsEmail: vi.fn() }));

vi.mock('../../packages/api/src/services/email.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../packages/api/src/services/email.service')>();
  return { ...actual, sendCmsEmailOrFallback: mockSendCmsEmail };
});

/**
 * Saved-card expiry notifications.
 *
 * A card is valid THROUGH the last instant of its expiry month. A card
 * expiring 11/2026 becomes eligible on 11/3 (28 days before 12/1 00:00 UTC).
 * Each card receives ONE notification per expiration period (unique index on
 * {userId, paymentMethodId, expMonth, expYear}); failed sends retry up to 3
 * attempts. Duplicate cards (same fingerprint) notify once.
 */
describe('Saved card expiry check', () => {
  let mongoServer: MongoMemoryServer;
  const originalEnv = { ...process.env };

  // Frozen run time: 3 November 2026 UTC. A card expiring 11/2026 has
  // exactly 28 days remaining (expiryEndExclusive = 1 Dec 2026 00:00 UTC).
  const NOW_28D = new Date('2026-11-03T00:00:00Z');

  function card(
    id: string,
    expMonth: number,
    expYear: number,
    opts: { fingerprint?: string; created?: number; last4?: string } = {},
  ) {
    const { fingerprint = `fp_${id}`, created = 1_700_000_000, last4 = '4242' } = opts;
    return {
      id,
      created,
      card: { brand: 'visa', last4, exp_month: expMonth, exp_year: expYear, fingerprint },
    };
  }

  function mockStripe(cards: any[]) {
    const listPaymentMethods = vi.fn().mockResolvedValue({ data: cards });
    return {
      listPaymentMethods,
      client: {
        customers: { listPaymentMethods },
      } as any,
    };
  }

  async function runCheck(now: Date = NOW_28D) {
    const { runSavedCardExpiryCheck } = await import(
      '../../packages/api/src/services/saved-card-expiry.service'
    );
    return runSavedCardExpiryCheck(now);
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
    await SavedCardExpiryNotice.deleteMany({});
    await Notification.deleteMany({});
    mockSendCmsEmail.mockReset();
    mockSendCmsEmail.mockResolvedValue({ messageId: 'msg_test' });
    process.env.PAYMENT_MODE = 'stripe_test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_expiry';
    process.env.FRONTEND_URL = 'https://app.pawtag.test';
  });

  afterEach(async () => {
    process.env.PAYMENT_MODE = originalEnv.PAYMENT_MODE || 'fake';
    const stripeClient = await import('../../packages/api/src/lib/stripe-client');
    stripeClient.resetStripeClientCache();
  });

  async function seedUser() {
    const user = await User.create({
      email: 'card-expiry@example.com',
      passwordHash: 'x',
      fullName: 'Card Expiry',
      phoneNumber: '+64210003333',
      role: 'customer',
      status: 'active',
      stripeCustomerId: 'cus_expiry_test',
    });
    return user._id.toString();
  }

  describe('28-day window boundaries', () => {
    it('does NOT notify at 29 days remaining', async () => {
      await seedUser();
      const { listPaymentMethods, client } = mockStripe([card('pm_a', 11, 2026)]);
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);

      const result = await runCheck(new Date('2026-11-02T00:00:00Z')); // 29 days

      expect(result.eligibleCards).toBe(0);
      expect(mockSendCmsEmail).not.toHaveBeenCalled();
      expect(await SavedCardExpiryNotice.countDocuments()).toBe(0);
      expect(listPaymentMethods).toHaveBeenCalled();
    });

    it('notifies at exactly 28 days remaining', async () => {
      const userId = await seedUser();
      const { client } = mockStripe([card('pm_a', 11, 2026)]);
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);

      const result = await runCheck(NOW_28D); // 28 days

      expect(result.notified).toBe(1);
      expect(mockSendCmsEmail).toHaveBeenCalledTimes(1);
      const emailArgs = mockSendCmsEmail.mock.calls[0][0];
      expect(emailArgs.slug).toBe('saved-card-expiring');
      expect(emailArgs.vars.cardLast4).toBe('4242');
      expect(emailArgs.vars.expiryLabel).toBe('November 2026');
      expect(emailArgs.to).toBe('card-expiry@example.com');

      const notice = await SavedCardExpiryNotice.findOne({ userId, paymentMethodId: 'pm_a' }).lean();
      expect(notice?.status).toBe('sent');

      const inApp = await Notification.findOne({ userId, type: 'saved_card_expiring' }).lean();
      expect(inApp?.actionUrl).toBe('/account/settings');
    });

    it('notifies a card already inside the window on the first run (deploy backfill)', async () => {
      await seedUser();
      const { client } = mockStripe([card('pm_a', 11, 2026)]);
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);

      const result = await runCheck(new Date('2026-11-24T00:00:00Z')); // 7 days left

      expect(result.notified).toBe(1);
    });

    it('skips already-expired cards', async () => {
      await seedUser();
      const { client } = mockStripe([card('pm_a', 11, 2026)]);
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);

      const result = await runCheck(new Date('2026-12-05T00:00:00Z')); // expired 4 days ago

      expect(result.expiredSkipped).toBe(1);
      expect(result.notified).toBe(0);
      expect(mockSendCmsEmail).not.toHaveBeenCalled();
      expect(await SavedCardExpiryNotice.countDocuments()).toBe(0);
    });

    it('does not notify a card far from expiry', async () => {
      await seedUser();
      const { client } = mockStripe([card('pm_a', 6, 2027)]); // ~7 months away
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);

      const result = await runCheck(NOW_28D);

      expect(result.eligibleCards).toBe(0);
      expect(mockSendCmsEmail).not.toHaveBeenCalled();
    });
  });

  describe('idempotency and retries', () => {
    it('sends only once across repeated daily runs', async () => {
      await seedUser();
      const { client } = mockStripe([card('pm_a', 11, 2026)]);
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);

      const first = await runCheck(NOW_28D);
      const second = await runCheck(new Date('2026-11-04T00:00:00Z'));
      const third = await runCheck(new Date('2026-11-05T00:00:00Z'));

      expect(first.notified).toBe(1);
      expect(second.alreadyNotified).toBe(1);
      expect(third.alreadyNotified).toBe(1);
      expect(mockSendCmsEmail).toHaveBeenCalledTimes(1);
    });

    it('retries a failed notification on the next run, then succeeds', async () => {
      await seedUser();
      const { client } = mockStripe([card('pm_a', 11, 2026)]);
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);

      mockSendCmsEmail.mockRejectedValueOnce(new Error('provider down'));
      const first = await runCheck(NOW_28D);
      expect(first.failedAttempts).toBe(1);
      let notice = await SavedCardExpiryNotice.findOne({ paymentMethodId: 'pm_a' }).lean();
      expect(notice?.status).toBe('failed');
      expect(notice?.attempts).toBe(1);

      const second = await runCheck(new Date('2026-11-04T00:00:00Z'));
      expect(second.notified).toBe(1);
      notice = await SavedCardExpiryNotice.findOne({ paymentMethodId: 'pm_a' }).lean();
      expect(notice?.status).toBe('sent');
      expect(notice?.attempts).toBe(2);
      expect(mockSendCmsEmail).toHaveBeenCalledTimes(2);
    });

    it('stops retrying after 3 attempts (manual follow-up)', async () => {
      const userId = await seedUser();
      await SavedCardExpiryNotice.create({
        userId,
        stripeCustomerId: 'cus_expiry_test',
        paymentMethodId: 'pm_a',
        expMonth: 11,
        expYear: 2026,
        status: 'failed',
        attempts: 3,
        lastError: 'provider down',
      });
      const { client } = mockStripe([card('pm_a', 11, 2026)]);
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);

      const result = await runCheck(NOW_28D);

      expect(result.failedAttempts).toBe(0);
      expect(mockSendCmsEmail).not.toHaveBeenCalled();
    });

    it('notifies nothing when the card was removed before the run', async () => {
      await seedUser();
      const { client } = mockStripe([]); // card removed from Stripe
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);

      const result = await runCheck(NOW_28D);

      expect(result.eligibleCards).toBe(0);
      expect(mockSendCmsEmail).not.toHaveBeenCalled();
    });

    it('recalculates when the expiry is updated (new expiration period)', async () => {
      await seedUser();
      const cards = [card('pm_a', 11, 2026)];
      const { client } = mockStripe(cards);
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);

      await runCheck(NOW_28D); // notify for 11/2026

      // Account Updater refreshed the expiry to 03/2027 → new period, new notice
      cards.length = 0;
      cards.push(card('pm_a', 3, 2027));
      await runCheck(new Date('2027-03-04T00:00:00Z')); // 28 days before 1 Apr 2027

      expect(mockSendCmsEmail).toHaveBeenCalledTimes(2);
      expect(await SavedCardExpiryNotice.countDocuments({ paymentMethodId: 'pm_a' })).toBe(2);
    });
  });

  describe('duplicate cards and membership awareness', () => {
    it('notifies once for duplicate cards sharing a fingerprint', async () => {
      await seedUser();
      const { client } = mockStripe([
        card('pm_old', 11, 2026, { fingerprint: 'fp_same', created: 1_700_000_100 }),
        card('pm_dup', 11, 2026, { fingerprint: 'fp_same', created: 1_700_000_900 }),
      ]);
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);

      const result = await runCheck(NOW_28D);

      expect(result.notified).toBe(1);
      expect(mockSendCmsEmail).toHaveBeenCalledTimes(1);
      // canonical = oldest attached card of the physical card
      expect(await SavedCardExpiryNotice.countDocuments()).toBe(1);
      const notice = await SavedCardExpiryNotice.findOne({}).lean();
      expect(notice?.paymentMethodId).toBe('pm_old');
    });

    it('includes membership renewal context when the card is the billing card', async () => {
      const userId = await seedUser();
      const tier = await MembershipTier.create({
        tier: 'gold',
        displayName: 'Gold',
        name: 'Gold',
        description: 'Gold membership tier',
        price: 89,
        tagLimit: 3,
        isActive: true,
      });
      const renewalDate = new Date('2026-12-12T00:00:00Z');
      await UserMembership.create({
        userId,
        tierId: tier._id,
        status: 'active',
        price: 89,
        startDate: new Date('2025-12-12'),
        currentPeriodStart: new Date('2025-12-12'),
        currentPeriodEnd: renewalDate,
        stripeSubscriptionId: 'sub_test_1',
        paymentMethodId: 'pm_a',
      });
      const { client } = mockStripe([card('pm_a', 11, 2026)]);
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);

      const result = await runCheck(NOW_28D);

      expect(result.notified).toBe(1);
      const emailArgs = mockSendCmsEmail.mock.calls[0][0];
      expect(emailArgs.vars.membershipAffected).toBe('yes');
      expect(emailArgs.vars.membershipRenewalDate).toContain('2026');
      // membership is preserved — never cancelled or switched
      const membership = await UserMembership.findOne({ userId }).lean();
      expect(membership?.status).toBe('active');
      expect(membership?.paymentMethodId).toBe('pm_a');
    });

    it('no membership context for a non-billing card', async () => {
      const userId = await seedUser();
      const tier = await MembershipTier.create({
        tier: 'gold',
        displayName: 'Gold',
        name: 'Gold',
        description: 'Gold membership tier',
        price: 89,
        tagLimit: 3,
        isActive: true,
      });
      await UserMembership.create({
        userId,
        tierId: tier._id,
        status: 'active',
        price: 89,
        startDate: new Date('2025-12-12'),
        currentPeriodStart: new Date('2025-12-12'),
        currentPeriodEnd: new Date('2026-12-12'),
        stripeSubscriptionId: 'sub_test_1',
        paymentMethodId: 'pm_other',
      });
      const { client } = mockStripe([
        card('pm_a', 11, 2026),
        card('pm_other', 8, 2028, { last4: '9999' }),
      ]);
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);

      await runCheck(NOW_28D);

      const emailArgs = mockSendCmsEmail.mock.calls[0][0];
      expect(emailArgs.vars.membershipAffected).toBe('');
    });
  });

  describe('guards', () => {
    it('does nothing in fake mode', async () => {
      await seedUser();
      process.env.PAYMENT_MODE = 'fake';
      const { client } = mockStripe([card('pm_a', 11, 2026)]);
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);

      const result = await runCheck(NOW_28D);

      expect(result.usersChecked).toBe(0);
      expect(client.customers.listPaymentMethods).not.toHaveBeenCalled();
      expect(mockSendCmsEmail).not.toHaveBeenCalled();
    });

    it('continues scanning after a per-user Stripe error', async () => {
      await User.create({
        email: 'a@example.com',
        passwordHash: 'x',
        fullName: 'User A',
        phoneNumber: '+64210003334',
        role: 'customer',
        status: 'active',
        stripeCustomerId: 'cus_a',
      });
      await User.create({
        email: 'b@example.com',
        passwordHash: 'x',
        fullName: 'User B',
        phoneNumber: '+64210003335',
        role: 'customer',
        status: 'active',
        stripeCustomerId: 'cus_b',
      });
      const listPaymentMethods = vi
        .fn()
        .mockRejectedValueOnce(new Error('stripe down'))
        .mockResolvedValue({ data: [card('pm_b', 11, 2026)] });
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests({ customers: { listPaymentMethods } } as any);

      const result = await runCheck(NOW_28D);

      expect(result.errors).toBe(1);
      expect(result.notified).toBe(1);
    });

    it('job wrapper returns a JobResult', async () => {
      await seedUser();
      const { client } = mockStripe([card('pm_a', 11, 2026)]);
      const stripeClient = await import('../../packages/api/src/lib/stripe-client');
      stripeClient.setStripeClientForTests(client);
      const { runSavedCardExpiryCheckJob } = await import(
        '../../packages/api/src/jobs/savedCardExpiryCheck'
      );

      const jobResult = await runSavedCardExpiryCheckJob(NOW_28D);

      expect(jobResult.success).toBe(true);
      expect(jobResult.itemsProcessed).toBe(1);
    });
  });
});

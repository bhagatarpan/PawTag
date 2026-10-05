import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';
import { setupTestDb, teardownTestDb } from './setup';

let userId: string;
let token: string;
let goldTierId: string;
let platinumTierId: string;
let blackTierId: string;

beforeAll(async () => {
  // Existing upgrade tests exercise local/fake-mode paths (no live Stripe calls).
  process.env.PAYMENT_MODE = 'fake';
  await setupTestDb();

  const userRes = await mongoose.connection.collections.users.insertOne({
    email: 'upgrade-test@example.com',
    passwordHash: '$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
    fullName: 'Upgrade Tester',
    phoneNumber: '+64210000010',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  userId = userRes.insertedId.toString();
  token = jwt.sign({ id: userId, email: 'upgrade-test@example.com', role: 'customer' }, config.jwtSecret, { expiresIn: '1h' });

  const goldRes = await mongoose.connection.collections.membershiptiers.insertOne({
    tier: 'gold',
    name: 'Gold',
    displayName: 'Gold',
    description: 'Gold membership',
    price: 89,
    currency: 'NZD',
    tagLimit: 3,
    isActive: true,
    comingSoon: false,
    displayOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  goldTierId = goldRes.insertedId.toString();

  const platinumRes = await mongoose.connection.collections.membershiptiers.insertOne({
    tier: 'platinum',
    name: 'Platinum',
    displayName: 'Platinum',
    description: 'Platinum membership',
    price: 99,
    currency: 'NZD',
    tagLimit: 10,
    isActive: true,
    comingSoon: false,
    displayOrder: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  platinumTierId = platinumRes.insertedId.toString();

  const blackRes = await mongoose.connection.collections.membershiptiers.insertOne({
    tier: 'black',
    name: 'Black',
    displayName: 'Black',
    description: 'Black membership',
    price: 199,
    currency: 'NZD',
    tagLimit: 999,
    isActive: true,
    comingSoon: true,
    displayOrder: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  blackTierId = blackRes.insertedId.toString();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await mongoose.connection.collections.usermemberships?.deleteMany({});
  await mongoose.connection.collections.invoices?.deleteMany({});
});

/**
 * Helper: create an active Gold membership for the test user.
 * Starts 90 days ago, ends in ~275 days (total 365).
 */
async function createActiveGoldMembership(opts?: {
  cancelledAt?: Date | null;
  autoRenew?: boolean;
  stripeSubscriptionId?: string | null;
}) {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - 90);
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 275);

  const res = await mongoose.connection.collections.usermemberships.insertOne({
    userId: new mongoose.Types.ObjectId(userId),
    tierId: new mongoose.Types.ObjectId(goldTierId),
    status: 'active',
    billingCycle: 'annual',
    price: 89,
    currency: 'NZD',
    startDate: periodStart,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    autoRenew: opts?.autoRenew ?? true,
    cancelledAt: opts?.cancelledAt ?? null,
    cancellationReason: opts?.cancelledAt ? 'Too expensive' : undefined,
    stripeSubscriptionId: opts?.stripeSubscriptionId ?? null,
    adminExtensionGraceUsed: false,
    adminExtensionCount: 0,
    createdAt: periodStart,
    updatedAt: now,
  });

  return { membershipId: res.insertedId.toString(), periodStart, periodEnd };
}

describe('Membership Upgrade Flow', () => {
  describe('GET /api/membership/change-tier/estimate', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .get(`/api/membership/change-tier/estimate?tierId=${platinumTierId}`);

      expect(res.status).toBe(401);
    });

    it('returns 400 when tierId is missing', async () => {
      const res = await request(app)
        .get('/api/membership/change-tier/estimate')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('tierId is required');
    });

    it('returns 400 when user has no active membership', async () => {
      const res = await request(app)
        .get(`/api/membership/change-tier/estimate?tierId=${platinumTierId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No active membership found');
    });

    it('returns proration estimate for Gold → Platinum upgrade', async () => {
      await createActiveGoldMembership();

      const res = await request(app)
        .get(`/api/membership/change-tier/estimate?tierId=${platinumTierId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const estimate = res.body.data;
      expect(estimate.currentTier.tier).toBe('gold');
      expect(estimate.newTier.tier).toBe('platinum');
      expect(estimate.isUpgrade).toBe(true);
      expect(estimate.currency).toBe('NZD');
      expect(estimate.isCancelling).toBe(false);
      expect(estimate.willResumeOnUpgrade).toBe(false);

      expect(estimate.remainingDays).toBeGreaterThan(270);
      expect(estimate.remainingDays).toBeLessThanOrEqual(276);
      expect(estimate.totalDays).toBe(365);
      expect(estimate.proratedAmount).toBeGreaterThan(7);
      expect(estimate.proratedAmount).toBeLessThan(8);

      expect(estimate.renewalDate).toBeDefined();
      expect(new Date(estimate.renewalDate).getTime()).not.toBeNaN();
      expect(estimate.renewalDate).not.toContain('Sep');
      expect(estimate.message).toBeUndefined();
    });

    it('flags cancelling membership with willResumeOnUpgrade for upgrades', async () => {
      await createActiveGoldMembership({ cancelledAt: new Date(), autoRenew: false });

      const res = await request(app)
        .get(`/api/membership/change-tier/estimate?tierId=${platinumTierId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isCancelling).toBe(true);
      expect(res.body.data.willResumeOnUpgrade).toBe(true);
    });

    it('returns 400 when target tier is same as current tier', async () => {
      await createActiveGoldMembership();

      const res = await request(app)
        .get(`/api/membership/change-tier/estimate?tierId=${goldTierId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Already on this tier');
    });

    it('returns 400 for nonexistent tier', async () => {
      await createActiveGoldMembership();

      const res = await request(app)
        .get(`/api/membership/change-tier/estimate?tierId=${new mongoose.Types.ObjectId().toString()}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Membership tier not found');
    });
  });

  describe('POST /api/membership/change-tier', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/membership/change-tier')
        .send({ tierId: platinumTierId });

      expect(res.status).toBe(401);
    });

    it('returns 400 when tierId is missing', async () => {
      const res = await request(app)
        .post('/api/membership/change-tier')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('tierId is required');
      expect(res.body.code).toBe('membership.tier_required');
    });

    it('returns 400 when user has no active membership', async () => {
      const res = await request(app)
        .post('/api/membership/change-tier')
        .set('Authorization', `Bearer ${token}`)
        .send({ tierId: platinumTierId });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No active membership found');
      expect(res.body.code).toBe('membership.no_active_membership');
    });

    it('successfully upgrades Gold → Platinum', async () => {
      const { membershipId } = await createActiveGoldMembership();

      const res = await request(app)
        .post('/api/membership/change-tier')
        .set('Authorization', `Bearer ${token}`)
        .send({ tierId: platinumTierId, prorationBehavior: 'now' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.membership).toBeDefined();
      expect(res.body.data.invoice).toBeDefined();
      expect(res.body.data.resumedOnUpgrade).toBe(false);
      expect(res.body.data.invoice).toBeNull();

      const updated = await mongoose.connection.collections.usermemberships
        .findOne({ _id: new mongoose.Types.ObjectId(membershipId) });
      expect(updated).toBeTruthy();
      expect(updated!.tierId.toString()).toBe(platinumTierId);
      expect(updated!.price).toBe(99);

      const now = new Date();
      const periodEnd = updated!.currentPeriodEnd;
      const daysUntilRenewal = Math.ceil((periodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      expect(daysUntilRenewal).toBeGreaterThan(270);
      expect(daysUntilRenewal).toBeLessThanOrEqual(276);
    });

    it('returns 409 when trying to change to same tier', async () => {
      await createActiveGoldMembership();

      const res = await request(app)
        .post('/api/membership/change-tier')
        .set('Authorization', `Bearer ${token}`)
        .send({ tierId: goldTierId });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Already on this tier');
      expect(res.body.code).toBe('membership.already_on_tier');
    });

    it('creates only one membership document after upgrade (no duplicates)', async () => {
      await createActiveGoldMembership();

      await request(app)
        .post('/api/membership/change-tier')
        .set('Authorization', `Bearer ${token}`)
        .send({ tierId: platinumTierId });

      const memberships = await mongoose.connection.collections.usermemberships
        .find({ userId: new mongoose.Types.ObjectId(userId) })
        .toArray();

      expect(memberships.length).toBe(1);
      expect(memberships[0].tierId.toString()).toBe(platinumTierId);
    });

    describe('Option A — upgrade while cancelling resumes membership', () => {
      it('resumes cancelling membership on upgrade (fake mode)', async () => {
        const { membershipId } = await createActiveGoldMembership({
          cancelledAt: new Date(),
          autoRenew: false,
        });

        const res = await request(app)
          .post('/api/membership/change-tier')
          .set('Authorization', `Bearer ${token}`)
          .send({ tierId: platinumTierId, prorationBehavior: 'now' });

        expect(res.status).toBe(200);
        expect(res.body.data.resumedOnUpgrade).toBe(true);

        const updated = await mongoose.connection.collections.usermemberships
          .findOne({ _id: new mongoose.Types.ObjectId(membershipId) });
        expect(updated!.tierId.toString()).toBe(platinumTierId);
        expect(updated!.price).toBe(99);
        expect(updated!.cancelledAt).toBeFalsy();
        expect(updated!.autoRenew).toBe(true);
      });

      it('returns membership.subscription_missing in stripe mode without a valid subscription', async () => {
        process.env.PAYMENT_MODE = 'stripe_test';
        try {
          await createActiveGoldMembership({
            cancelledAt: new Date(),
            autoRenew: false,
            stripeSubscriptionId: null,
          });

          const res = await request(app)
            .post('/api/membership/change-tier')
            .set('Authorization', `Bearer ${token}`)
            .send({ tierId: platinumTierId, prorationBehavior: 'now' });

          expect(res.status).toBe(409);
          expect(res.body.code).toBe('membership.subscription_missing');

          const updated = await mongoose.connection.collections.usermemberships.findOne({});
          expect(updated!.cancelledAt).toBeTruthy();
          expect(updated!.autoRenew).toBe(false);
          expect(updated!.tierId.toString()).toBe(goldTierId);
        } finally {
          process.env.PAYMENT_MODE = 'fake';
        }
      });

      it('rejects demo subscription ids in stripe mode (never calls Stripe with demo)', async () => {
        process.env.PAYMENT_MODE = 'stripe_test';
        try {
          await createActiveGoldMembership({
            cancelledAt: new Date(),
            autoRenew: false,
            stripeSubscriptionId: 'demo',
          });

          const res = await request(app)
            .post('/api/membership/change-tier')
            .set('Authorization', `Bearer ${token}`)
            .send({ tierId: platinumTierId, prorationBehavior: 'now' });

          expect(res.status).toBe(409);
          expect(res.body.code).toBe('membership.subscription_missing');
        } finally {
          process.env.PAYMENT_MODE = 'fake';
        }
      });

      it('keeps cancel state when Stripe update fails (stripe mode + mocked Stripe)', async () => {
        process.env.PAYMENT_MODE = 'stripe_test';
        process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_for_membership_upgrade';
        const membershipService = await import('../../packages/api/src/services/membership.service');

        const retrieve = vi.fn().mockResolvedValue({
          id: 'sub_mock_123',
          status: 'active',
          cancel_at_period_end: true,
          default_payment_method: 'pm_mock',
          items: { data: [{ id: 'si_mock_1', price: { id: 'price_gold' } }] },
        });
        const update = vi.fn().mockRejectedValue(
          Object.assign(new Error('This card was declined.'), {
            type: 'StripeCardError',
            code: 'card_error',
          }),
        );

        membershipService.setStripeClientForTests({
          subscriptions: { retrieve, update },
          prices: { create: vi.fn() },
        } as any);

        try {
          const { membershipId } = await createActiveGoldMembership({
            cancelledAt: new Date(),
            autoRenew: false,
            stripeSubscriptionId: 'sub_mock_123',
          });
          await mongoose.connection.collections.membershiptiers.updateOne(
            { _id: new mongoose.Types.ObjectId(platinumTierId) },
            { $set: { stripePriceId: 'price_platinum_mock' } },
          );

          const res = await request(app)
            .post('/api/membership/change-tier')
            .set('Authorization', `Bearer ${token}`)
            .send({ tierId: platinumTierId, prorationBehavior: 'now' });

          expect(res.status).toBe(402);
          expect(res.body.code).toBe('membership.payment_method_required');
          expect(update).toHaveBeenCalled();
          expect(update.mock.calls[0][1].cancel_at_period_end).toBe(false);

          const updated = await mongoose.connection.collections.usermemberships
            .findOne({ _id: new mongoose.Types.ObjectId(membershipId) });
          expect(updated!.cancelledAt).toBeTruthy();
          expect(updated!.autoRenew).toBe(false);
          expect(updated!.tierId.toString()).toBe(goldTierId);
        } finally {
          membershipService.setStripeClientForTests(null);
          process.env.PAYMENT_MODE = 'fake';
          delete process.env.STRIPE_SECRET_KEY;
        }
      });

      it('resumes when Stripe accepts resume+upgrade (stripe mode + mocked Stripe)', async () => {
        process.env.PAYMENT_MODE = 'stripe_test';
        process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_for_membership_upgrade';
        const membershipService = await import('../../packages/api/src/services/membership.service');

        const retrieve = vi.fn().mockResolvedValue({
          id: 'sub_mock_ok',
          status: 'active',
          cancel_at_period_end: true,
          default_payment_method: 'pm_mock',
          items: { data: [{ id: 'si_mock_ok', price: { id: 'price_gold' } }] },
        });
        const update = vi.fn().mockResolvedValue({
          id: 'sub_mock_ok',
          status: 'active',
          cancel_at_period_end: false,
          latest_invoice: {
            id: 'in_proration_mock',
            amount_due: 995,
            currency: 'nzd',
          },
        });

        membershipService.setStripeClientForTests({
          subscriptions: { retrieve, update },
          prices: { create: vi.fn() },
        } as any);

        try {
          const { membershipId } = await createActiveGoldMembership({
            cancelledAt: new Date(),
            autoRenew: false,
            stripeSubscriptionId: 'sub_mock_ok',
          });
          await mongoose.connection.collections.membershiptiers.updateOne(
            { _id: new mongoose.Types.ObjectId(platinumTierId) },
            { $set: { stripePriceId: 'price_platinum_mock' } },
          );

          const res = await request(app)
            .post('/api/membership/change-tier')
            .set('Authorization', `Bearer ${token}`)
            .send({ tierId: platinumTierId, prorationBehavior: 'now' });

          expect(res.status).toBe(200);
          expect(res.body.data.resumedOnUpgrade).toBe(true);
          expect(res.body.data.invoice).toBeTruthy();
          expect(res.body.data.invoice.amount).toBe(9.95);
          expect(update.mock.calls[0][1].cancel_at_period_end).toBe(false);
          expect(update.mock.calls[0][1].proration_behavior).toBe('create_prorations');

          const updated = await mongoose.connection.collections.usermemberships
            .findOne({ _id: new mongoose.Types.ObjectId(membershipId) });
          expect(updated!.tierId.toString()).toBe(platinumTierId);
          expect(updated!.cancelledAt).toBeFalsy();
          expect(updated!.autoRenew).toBe(true);
        } finally {
          membershipService.setStripeClientForTests(null);
          process.env.PAYMENT_MODE = 'fake';
          delete process.env.STRIPE_SECRET_KEY;
        }
      });
    });

    describe('Repair upgrade — active membership + dead Stripe sub', () => {
      it('returns membership.subscription_not_active on proration change-tier when sub is dead', async () => {
        process.env.PAYMENT_MODE = 'stripe_test';
        process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_repair';
        const membershipService = await import('../../packages/api/src/services/membership.service');
        membershipService.setStripeClientForTests({
          subscriptions: {
            retrieve: vi.fn().mockResolvedValue({
              id: 'sub_dead',
              status: 'canceled',
              items: { data: [{ id: 'si_dead' }] },
            }),
            update: vi.fn(),
            create: vi.fn(),
          },
          prices: { create: vi.fn() },
        } as any);

        try {
          const { membershipId } = await createActiveGoldMembership({
            stripeSubscriptionId: 'sub_dead',
          });
          await mongoose.connection.collections.membershiptiers.updateOne(
            { _id: new mongoose.Types.ObjectId(platinumTierId) },
            { $set: { stripePriceId: 'price_platinum_mock' } },
          );

          const res = await request(app)
            .post('/api/membership/change-tier')
            .set('Authorization', `Bearer ${token}`)
            .send({ tierId: platinumTierId, prorationBehavior: 'now' });

          expect(res.status).toBe(409);
          expect(res.body.code).toBe('membership.subscription_not_active');

          const updated = await mongoose.connection.collections.usermemberships
            .findOne({ _id: new mongoose.Types.ObjectId(membershipId) });
          expect(updated!.tierId.toString()).toBe(goldTierId);
        } finally {
          membershipService.setStripeClientForTests(null);
          process.env.PAYMENT_MODE = 'fake';
          delete process.env.STRIPE_SECRET_KEY;
        }
      });

      it('fake mode: repair upgrade applies full target tier price immediately', async () => {
        const { membershipId } = await createActiveGoldMembership({
          stripeSubscriptionId: 'sub_dead',
        });
        await mongoose.connection.collections.membershiptiers.updateOne(
          { _id: new mongoose.Types.ObjectId(platinumTierId) },
          { $set: { stripePriceId: 'price_platinum_mock' } },
        );

        const res = await request(app)
          .post('/api/membership/change-tier/repair')
          .set('Authorization', `Bearer ${token}`)
          .send({ tierId: platinumTierId });

        expect(res.status).toBe(200);
        expect(res.body.data.chargeAmount).toBe(99);
        expect(res.body.data.tierDisplayName).toBe('Platinum');

        const updated = await mongoose.connection.collections.usermemberships
          .findOne({ _id: new mongoose.Types.ObjectId(membershipId) });
        expect(updated!.tierId.toString()).toBe(platinumTierId);
        expect(updated!.price).toBe(99);
      });

      it('repair upgrade rejects same tier', async () => {
        await createActiveGoldMembership({ stripeSubscriptionId: 'sub_dead' });

        const res = await request(app)
          .post('/api/membership/change-tier/repair')
          .set('Authorization', `Bearer ${token}`)
          .send({ tierId: goldTierId });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('membership.already_on_tier');
      });
    });
  });

  describe('GET /api/membership/status after upgrade', () => {
    it('reflects the new tier after upgrade', async () => {
      await createActiveGoldMembership();

      await request(app)
        .post('/api/membership/change-tier')
        .set('Authorization', `Bearer ${token}`)
        .send({ tierId: platinumTierId });

      const res = await request(app)
        .get('/api/membership/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.hasMembership).toBe(true);
      expect(res.body.data.tier.tier).toBe('platinum');
      expect(res.body.data.tier.price).toBe(99);
    });
  });

  describe('GET /api/membership/invoices after upgrade', () => {
    it('returns invoice list (empty in fake mode — no proration charge)', async () => {
      await createActiveGoldMembership();

      await request(app)
        .post('/api/membership/change-tier')
        .set('Authorization', `Bearer ${token}`)
        .send({ tierId: platinumTierId });

      const res = await request(app)
        .get('/api/membership/invoices')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .get('/api/membership/invoices');

      expect(res.status).toBe(401);
    });
  });
});

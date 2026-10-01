import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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
  await setupTestDb();

  // Create customer user
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

  // Create membership tiers
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
  // Clean membership data between tests, keep tiers
  await mongoose.connection.collections.usermemberships?.deleteMany({});
  await mongoose.connection.collections.invoices?.deleteMany({});
});

/**
 * Helper: create an active Gold membership for the test user.
 * Starts 90 days ago, ends in ~275 days (total 365).
 */
async function createActiveGoldMembership() {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - 90); // 90 days ago
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 275); // 275 days remaining

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
    autoRenew: true,
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

      // Price difference: $99 - $89 = $10
      // Remaining ~275 of 365 days → prorated ≈ $10 * 275/365 ≈ $7.53
      expect(estimate.remainingDays).toBeGreaterThan(270);
      expect(estimate.remainingDays).toBeLessThanOrEqual(276);
      expect(estimate.totalDays).toBe(365);
      expect(estimate.proratedAmount).toBeGreaterThan(7);
      expect(estimate.proratedAmount).toBeLessThan(8);

      // renewalDate should be an ISO string (data-only response, no pre-formatting)
      expect(estimate.renewalDate).toBeDefined();
      expect(new Date(estimate.renewalDate).getTime()).not.toBeNaN();
      // Should NOT be a pre-formatted display string
      expect(estimate.renewalDate).not.toContain('Sep');

      // Response should NOT contain a pre-formatted message (frontend builds its own copy)
      expect(estimate.message).toBeUndefined();
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

  describe('POST /api/membership/subscribe with existing membership', () => {
    it('rejects subscribe when user already has an active membership', async () => {
      await createActiveGoldMembership();

      const res = await request(app)
        .post('/api/membership/subscribe')
        .set('Authorization', `Bearer ${token}`)
        .send({ tierId: platinumTierId });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('You already have an active membership');
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
    });

    it('returns 400 when user has no active membership', async () => {
      const res = await request(app)
        .post('/api/membership/change-tier')
        .set('Authorization', `Bearer ${token}`)
        .send({ tierId: platinumTierId });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No active membership found');
    });

    it('successfully upgrades Gold → Platinum', async () => {
      const { membershipId } = await createActiveGoldMembership();

      const res = await request(app)
        .post('/api/membership/change-tier')
        .set('Authorization', `Bearer ${token}`)
        .send({ tierId: platinumTierId, prorationBehavior: 'now' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Response should include membership + invoice fields
      expect(res.body.data.membership).toBeDefined();
      expect(res.body.data.invoice).toBeDefined();

      // In fake mode (no Stripe), invoice is null — no proration charge occurred
      // In Stripe mode, invoice would contain the proration record
      expect(res.body.data.invoice).toBeNull();

      // Verify the membership document was updated
      const updated = await mongoose.connection.collections.usermemberships
        .findOne({ _id: new mongoose.Types.ObjectId(membershipId) });
      expect(updated).toBeTruthy();
      expect(updated!.tierId.toString()).toBe(platinumTierId);
      expect(updated!.price).toBe(99);

      // Renewal date should NOT change (same billing period)
      const now = new Date();
      const periodEnd = updated!.currentPeriodEnd;
      const daysUntilRenewal = Math.ceil((periodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      expect(daysUntilRenewal).toBeGreaterThan(270);
      expect(daysUntilRenewal).toBeLessThanOrEqual(276);
    });

    it('returns 400 when trying to change to same tier', async () => {
      await createActiveGoldMembership();

      const res = await request(app)
        .post('/api/membership/change-tier')
        .set('Authorization', `Bearer ${token}`)
        .send({ tierId: goldTierId });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Already on this tier');
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

      // In fake mode, no Stripe proration invoice is created, so the list is empty.
      // In Stripe mode, the upgrade proration invoice would appear here.
      // The endpoint itself works and returns the correct shape.
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .get('/api/membership/invoices');

      expect(res.status).toBe(401);
    });
  });
});

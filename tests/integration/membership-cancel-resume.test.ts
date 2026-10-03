import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';
import { setupTestDb, teardownTestDb } from './setup';
import { UserMembership } from '@pawtag/db';

let userId: string;
let otherUserId: string;
let token: string;
let otherToken: string;
let goldTierId: string;

beforeAll(async () => {
  await setupTestDb();

  const userRes = await mongoose.connection.collections.users.insertOne({
    email: 'membership-resume@example.com',
    passwordHash: '$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
    fullName: 'Resume Tester',
    phoneNumber: '+64210000011',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  userId = userRes.insertedId.toString();
  token = jwt.sign(
    { id: userId, email: 'membership-resume@example.com', role: 'customer' },
    config.jwtSecret,
    { expiresIn: '1h' },
  );

  const otherRes = await mongoose.connection.collections.users.insertOne({
    email: 'membership-resume-other@example.com',
    passwordHash: '$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
    fullName: 'Other Tester',
    phoneNumber: '+64210000012',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  otherUserId = otherRes.insertedId.toString();
  otherToken = jwt.sign(
    { id: otherUserId, email: 'membership-resume-other@example.com', role: 'customer' },
    config.jwtSecret,
    { expiresIn: '1h' },
  );

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
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await mongoose.connection.collections.usermemberships?.deleteMany({});
  await mongoose.connection.collections.invoices?.deleteMany({});
});

async function createActiveGoldMembership(opts?: { cancelledAt?: Date | null; autoRenew?: boolean; periodEndDaysFromNow?: number }) {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - 90);
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + (opts?.periodEndDaysFromNow ?? 275));

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
    adminExtensionGraceUsed: false,
    adminExtensionCount: 0,
    createdAt: periodStart,
    updatedAt: now,
  });

  return { membershipId: res.insertedId.toString(), periodStart, periodEnd };
}

describe('Membership Cancel + Resume Flow', () => {
  describe('POST /api/membership/cancel', () => {
    it('sets cancelledAt and disables auto-renew while keeping status active', async () => {
      const { membershipId } = await createActiveGoldMembership();

      const res = await request(app)
        .post('/api/membership/cancel')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Too expensive' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const membership = await UserMembership.findById(membershipId).lean();
      expect(membership?.status).toBe('active');
      expect(membership?.cancelledAt).toBeTruthy();
      expect(membership?.autoRenew).toBe(false);
      expect(membership?.cancellationReason).toBe('Too expensive');
    });

    it('rejects double cancel', async () => {
      await createActiveGoldMembership({ cancelledAt: new Date(), autoRenew: false });

      const res = await request(app)
        .post('/api/membership/cancel')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Too expensive' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already scheduled/i);
    });
  });

  describe('POST /api/membership/resume', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).post('/api/membership/resume');
      expect(res.status).toBe(401);
    });

    it('returns 400 when membership is not cancelling', async () => {
      await createActiveGoldMembership();

      const res = await request(app)
        .post('/api/membership/resume')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not scheduled for cancellation/i);
    });

    it('returns 400 when user has no active membership', async () => {
      const res = await request(app)
        .post('/api/membership/resume')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not scheduled for cancellation/i);
    });

    it('clears cancelledAt and restores auto-renew after cancel', async () => {
      await createActiveGoldMembership();

      const cancelRes = await request(app)
        .post('/api/membership/cancel')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Not using the benefits' });
      expect(cancelRes.status).toBe(200);

      const resumeRes = await request(app)
        .post('/api/membership/resume')
        .set('Authorization', `Bearer ${token}`);

      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.success).toBe(true);

      const membership = await UserMembership.findOne({ userId }).lean();
      expect(membership?.status).toBe('active');
      expect(membership?.cancelledAt).toBeFalsy();
      expect(membership?.autoRenew).toBe(true);
      expect(membership?.cancellationReason).toBeFalsy();
    });

    it('is idempotent-unsafe: second resume after successful resume fails', async () => {
      await createActiveGoldMembership({ cancelledAt: new Date(), autoRenew: false });

      const first = await request(app)
        .post('/api/membership/resume')
        .set('Authorization', `Bearer ${token}`);
      expect(first.status).toBe(200);

      const second = await request(app)
        .post('/api/membership/resume')
        .set('Authorization', `Bearer ${token}`);
      expect(second.status).toBe(400);
      expect(second.body.error).toMatch(/not scheduled for cancellation/i);
    });

    it('rejects resume when benefits period already ended', async () => {
      await createActiveGoldMembership({
        cancelledAt: new Date(Date.now() - 86400000),
        autoRenew: false,
        periodEndDaysFromNow: -1,
      });

      const res = await request(app)
        .post('/api/membership/resume')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already ended|subscribe again/i);
    });

    it('does not allow another user to resume your membership', async () => {
      await createActiveGoldMembership({ cancelledAt: new Date(), autoRenew: false });

      const res = await request(app)
        .post('/api/membership/resume')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not scheduled for cancellation/i);

      const membership = await UserMembership.findOne({ userId }).lean();
      expect(membership?.cancelledAt).toBeTruthy();
      expect(membership?.autoRenew).toBe(false);
    });

    it('status API still reports hasMembership true while cancelling', async () => {
      await createActiveGoldMembership({ cancelledAt: new Date(), autoRenew: false });

      const res = await request(app)
        .get('/api/membership/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.hasMembership).toBe(true);
      expect(res.body.data.membership.cancelledAt).toBeTruthy();
      expect(res.body.data.membership.autoRenew).toBe(false);
    });
  });
});

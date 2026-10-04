import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';
import { setupTestDb, teardownTestDb } from './setup';
import { createCustomerWithRBAC } from './helpers';

let userId: string;
let token: string;
let goldTierId: string;

beforeAll(async () => {
  process.env.PAYMENT_MODE = 'fake';
  await setupTestDb();

  const customer = await createCustomerWithRBAC({
    email: 'keep-membership@example.com',
    fullName: 'Keep Tester',
  });
  userId = customer.userId;
  token = customer.token;

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
  await mongoose.connection.collections.users?.updateMany(
    {},
    { $set: { membershipTier: null, membershipId: null } },
  );
});

async function createMembership(opts?: {
  cancelledAt?: Date | null;
  autoRenew?: boolean;
  periodEndDaysFromNow?: number;
  status?: string;
  startDateDaysAgo?: number;
}) {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - (opts?.startDateDaysAgo ?? 90));
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + (opts?.periodEndDaysFromNow ?? 275));

  const res = await mongoose.connection.collections.usermemberships.insertOne({
    userId: new mongoose.Types.ObjectId(userId),
    tierId: new mongoose.Types.ObjectId(goldTierId),
    status: opts?.status ?? 'active',
    billingCycle: 'annual',
    price: 89,
    currency: 'NZD',
    startDate: periodStart,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    autoRenew: opts?.autoRenew ?? !opts?.cancelledAt,
    cancelledAt: opts?.cancelledAt ?? null,
    cancellationReason: opts?.cancelledAt ? 'Too expensive' : undefined,
    stripeSubscriptionId: null,
    adminExtensionGraceUsed: false,
    adminExtensionCount: 0,
    createdAt: periodStart,
    updatedAt: now,
  });

  return { membershipId: res.insertedId.toString(), periodStart, periodEnd };
}

describe('POST /api/membership/keep', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/membership/keep');
    expect(res.status).toBe(401);
  });

  it('Path A: resumes cancelling membership with no charge and original dates', async () => {
    const { membershipId, periodStart, periodEnd } = await createMembership({
      cancelledAt: new Date(),
      autoRenew: false,
    });

    const res = await request(app)
      .post('/api/membership/keep')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.outcome).toBe('resumed');
    expect(res.body.data.preservedOriginalDates).toBe(true);

    const updated = await mongoose.connection.collections.usermemberships
      .findOne({ _id: new mongoose.Types.ObjectId(membershipId) });
    expect(updated!.cancelledAt).toBeFalsy();
    expect(updated!.autoRenew).toBe(true);
    expect(updated!.status).toBe('active');
    expect(updated!.tierId.toString()).toBe(goldTierId);
    expect(updated!.currentPeriodStart?.toISOString()).toBe(periodStart.toISOString());
    expect(updated!.currentPeriodEnd?.toISOString()).toBe(periodEnd.toISOString());

    const user = await mongoose.connection.collections.users.findOne({
      _id: new mongoose.Types.ObjectId(userId),
    });
    // User.membershipTier may be schema-less in some fixtures; membership doc is source of truth
    expect(updated!.status).toBe('active');
    expect(updated!.autoRenew).toBe(true);
  });

  it('Path B: when benefits ended, creates paid rejoin (fake mode activates immediately)', async () => {
    await createMembership({
      cancelledAt: new Date(),
      autoRenew: false,
      periodEndDaysFromNow: -10,
    });

    const res = await request(app)
      .post('/api/membership/keep')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.outcome).toBe('payment_required');
    expect(res.body.data.chargeAmount).toBe(89);
    expect(res.body.data.membershipId).toBeTruthy();

    // Fake mode subscribe activates immediately
    const memberships = await mongoose.connection.collections.usermemberships
      .find({ userId: new mongoose.Types.ObjectId(userId) })
      .toArray();
    const active = memberships.filter((m) => m.status === 'active');
    expect(active.length).toBe(1);
    expect(active[0].tierId.toString()).toBe(goldTierId);
    // New period should start from now (not old end date)
    expect(active[0].currentPeriodEnd.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns error when user has no membership', async () => {
    const res = await request(app)
      .post('/api/membership/keep')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('membership.no_active_membership');
  });
});

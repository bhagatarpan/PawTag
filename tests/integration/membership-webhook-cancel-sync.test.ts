import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';

import app from '../../packages/api/src/index';
import { setupTestDb, teardownTestDb } from './setup';
import { createCustomerWithRBAC } from './helpers';
import { handleStripeSubscriptionUpdated } from '../../packages/api/src/routes/stripe-webhooks';

let userId: string;
let token: string;
let goldTierId: string;

beforeAll(async () => {
  process.env.PAYMENT_MODE = 'fake';
  await setupTestDb();

  const customer = await createCustomerWithRBAC({
    email: 'webhook-cancel-sync@example.com',
    fullName: 'Webhook Sync Tester',
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
  await mongoose.connection.collections.subscriptions?.deleteMany({});
  await mongoose.connection.collections.invoices?.deleteMany({});
  await mongoose.connection.collections.settings?.deleteMany({});
});

async function createMembership(opts?: {
  cancelledAt?: Date | null;
  autoRenew?: boolean;
  stripeSubscriptionId?: string;
  status?: string;
}) {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - 90);
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 275);

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
    autoRenew: opts?.autoRenew ?? true,
    cancelledAt: opts?.cancelledAt ?? null,
    cancellationReason: opts?.cancelledAt ? 'Too expensive' : undefined,
    stripeSubscriptionId: opts?.stripeSubscriptionId ?? 'sub_webhook_sync_1',
    adminExtensionGraceUsed: false,
    adminExtensionCount: 0,
    createdAt: periodStart,
    updatedAt: now,
  });

  return res.insertedId.toString();
}

describe('Stripe webhook cancel_at_period_end sync (UserMembership)', () => {
  it('sets cancelledAt when Billing Portal sets cancel_at_period_end', async () => {
    const membershipId = await createMembership({ cancelledAt: null, autoRenew: true });

    await handleStripeSubscriptionUpdated({
      id: 'sub_webhook_sync_1',
      status: 'active',
      cancel_at_period_end: true,
    });

    const membership = await mongoose.connection.collections.usermemberships
      .findOne({ _id: new mongoose.Types.ObjectId(membershipId) });
    expect(membership!.cancelledAt).toBeTruthy();
    expect(membership!.autoRenew).toBe(false);
    expect(membership!.status).toBe('active');
  });

  it('clears cancelledAt when Billing Portal resumes (cancel_at_period_end false)', async () => {
    const membershipId = await createMembership({
      cancelledAt: new Date(),
      autoRenew: false,
      stripeSubscriptionId: 'sub_webhook_sync_2',
    });

    await handleStripeSubscriptionUpdated({
      id: 'sub_webhook_sync_2',
      status: 'active',
      cancel_at_period_end: false,
    });

    const membership = await mongoose.connection.collections.usermemberships
      .findOne({ _id: new mongoose.Types.ObjectId(membershipId) });
    expect(membership!.cancelledAt).toBeFalsy();
    expect(membership!.autoRenew).toBe(true);
    expect(membership!.status).toBe('active');
  });

  it('marks membership cancelled when Stripe subscription is fully canceled', async () => {
    const membershipId = await createMembership({
      cancelledAt: new Date(),
      autoRenew: false,
      stripeSubscriptionId: 'sub_webhook_sync_3',
    });

    await handleStripeSubscriptionUpdated({
      id: 'sub_webhook_sync_3',
      status: 'canceled',
      cancel_at_period_end: false,
    });

    const membership = await mongoose.connection.collections.usermemberships
      .findOne({ _id: new mongoose.Types.ObjectId(membershipId) });
    expect(membership!.status).toBe('cancelled');
    expect(membership!.autoRenew).toBe(false);
  });

  it('activates pending membership when Stripe is active, then syncs cancel_at_period_end', async () => {
    const membershipId = await createMembership({
      status: 'pending_payment',
      stripeSubscriptionId: 'sub_webhook_pending',
    });

    await handleStripeSubscriptionUpdated({
      id: 'sub_webhook_pending',
      status: 'active',
      cancel_at_period_end: true,
    });

    const membership = await mongoose.connection.collections.usermemberships
      .findOne({ _id: new mongoose.Types.ObjectId(membershipId) });
    expect(membership!.status).toBe('active');
    expect(membership!.cancelledAt).toBeTruthy();
    expect(membership!.autoRenew).toBe(false);
  });
});

describe('POST /api/customer/subscriptions/:id/change-plan (gold)', () => {
  async function createGoldTagSubscription(renewalMethod: 'monthly' | 'annual') {
    const now = new Date();
    const periodEnd = new Date(now);
    if (renewalMethod === 'annual') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await mongoose.connection.collections.settings.insertMany([
      { key: 'guardian.goldPrice', value: '3.99', createdAt: now, updatedAt: now },
      { key: 'guardian.goldAnnualPrice', value: '39.99', createdAt: now, updatedAt: now },
    ]);

    const res = await mongoose.connection.collections.subscriptions.insertOne({
      userId: new mongoose.Types.ObjectId(userId),
      planType: 'gold',
      planName: 'Gold Membership',
      status: 'active',
      price: renewalMethod === 'annual' ? 39.99 : 3.99,
      renewalMethod,
      startDate: now,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      autoRenew: true,
      stripeSubscriptionId: 'sub_gold_plan_change',
      createdAt: now,
      updatedAt: now,
    });

    return res.insertedId.toString();
  }

  it('changes gold billing interval without rewriting planType to annual/monthly', async () => {
    const subscriptionId = await createGoldTagSubscription('monthly');

    const res = await request(app)
      .post(`/api/customer/subscriptions/${subscriptionId}/change-plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planType: 'annual' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await mongoose.connection.collections.subscriptions
      .findOne({ _id: new mongoose.Types.ObjectId(subscriptionId) });
    expect(updated!.planType).toBe('gold');
    expect(updated!.renewalMethod).toBe('annual');
    expect(updated!.price).toBe(39.99);
  });

  it('returns 409 when gold is already on the requested billing interval', async () => {
    const subscriptionId = await createGoldTagSubscription('annual');

    const res = await request(app)
      .post(`/api/customer/subscriptions/${subscriptionId}/change-plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planType: 'annual' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already on/i);
  });

  it('does not touch UserMembership when changing gold tag subscription billing', async () => {
    const subscriptionId = await createGoldTagSubscription('monthly');

    const res = await request(app)
      .post(`/api/customer/subscriptions/${subscriptionId}/change-plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planType: 'annual' });

    expect(res.status).toBe(200);
    const membership = await mongoose.connection.collections.usermemberships.findOne({});
    expect(membership).toBeNull();
  });
});

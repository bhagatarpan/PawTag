import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { createCustomerWithRBAC, createSuperAdmin } from './helpers';
import { membershipEntitlementService } from '../../packages/api/src/services/membership-entitlement.service';

/**
 * Tag activation limit end-to-end (docs/TAG-ACTIVATION-LIMIT.md):
 * cap at redeem → typed 409 → one-time fee checkout (idempotent) → confirm
 * (order + invoice, no fulfilment) → redeem succeeds via the paid fee.
 * Plus the limit rule (non-member = commerce setting) and both widget feeds.
 */

async function seedFeeProduct() {
  await mongoose.connection.collections.products.insertOne({
    name: 'Tag Activation Fee',
    slug: 'tag-activation-fee',
    description: 'One-time activation fee',
    price: 19.99,
    currency: 'NZD',
    images: [],
    category: 'PawTag',
    tags: ['activation', 'fee'],
    isActive: true,
    stock: 1000000,
    reserved: 0,
    sku: 'TAG-ACT-FEE',
    variants: [],
    customizable: false,
    customizationPrice: 0,
    shippingCost: 0,
    productType: 'digital',
    isTagProduct: false,
    isSubscription: false,
    stockPolicy: 'allow',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function createShippedOrder(userId: string, orderNumber: string) {
  const res = await mongoose.connection.collections.orders.insertOne({
    orderNumber,
    userId: new mongoose.Types.ObjectId(userId),
    items: [{
      productId: new mongoose.Types.ObjectId(),
      productName: 'PawTag Classic',
      quantity: 1,
      unitPrice: 19.99,
      totalPrice: 19.99,
    }],
    status: 'shipped',
    payment: {
      method: 'card',
      status: 'completed',
      transactionId: 'pi_taglimit_1',
      stripePaymentIntentId: 'pi_taglimit_1',
      amount: 19.99,
      currency: 'NZD',
      paidAt: new Date(),
    },
    shippingAddress: { line1: '1 Test St', city: 'Auckland', state: 'Auckland', zip: '1010', country: 'NZ' },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return res.insertedId.toString();
}

async function createTag(
  userId: string,
  orderId: string | null,
  tagId: string,
  overrides: Record<string, any> = {},
) {
  const now = new Date();
  const activeEnd = new Date(now);
  activeEnd.setMonth(activeEnd.getMonth() + 3);
  const res = await mongoose.connection.collections.tags.insertOne({
    tagId,
    tagType: 'qr',
    ownerId: new mongoose.Types.ObjectId(userId),
    orderId: orderId ? new mongoose.Types.ObjectId(orderId) : undefined,
    status: overrides.status || 'inactive',
    subscriptionStatus: 'none',
    activatedAt: overrides.status === 'active' ? now : undefined,
    activePeriodEndsAt: overrides.activePeriodEndsAt ?? activeEnd,
    warrantyEndsAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
    replacesTagId: overrides.replacesTagId,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return res.insertedId.toString();
}

let seq = 0;
const nextTagId = () => `PT-LIMIT-${Date.now()}-${seq++}`;

// The fee checkout must be deterministic: fake mode makes createPaymentIntent
// mint local pi_demo_* ids so confirm never needs a live Stripe call (the
// donations suites use the same pattern). Save/restore — tests share a fork.
let prevPaymentMode: string | undefined;
let prevStripeKey: string | undefined;

beforeAll(async () => {
  prevPaymentMode = process.env.PAYMENT_MODE;
  prevStripeKey = process.env.STRIPE_SECRET_KEY;
  process.env.PAYMENT_MODE = 'fake';
  delete process.env.STRIPE_SECRET_KEY;
  await setupTestDb();
  await seedFeeProduct();
}, 30000);
afterAll(async () => {
  await teardownTestDb();
  if (prevPaymentMode === undefined) delete process.env.PAYMENT_MODE;
  else process.env.PAYMENT_MODE = prevPaymentMode;
  if (prevStripeKey !== undefined) process.env.STRIPE_SECRET_KEY = prevStripeKey;
}, 30000); // matches vitest hookTimeout — memory-server stop is IO-bound under parallel suites
beforeEach(async () => {
  await clearDb();
  await seedFeeProduct(); // clearDb wipes products too
  // Module-level entitlement cache survives DB clears inside one file run
  membershipEntitlementService.invalidateCache();
});

describe('activation cap at redeem', () => {
  it('below the limit → activates normally', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'cap-under@example.com', skipMembership: true });
    const orderId = await createShippedOrder(userId, 'WO-CAP-1');
    await createTag(userId, null, nextTagId(), { status: 'active' }); // 1 active of 2
    const tagId = nextTagId();
    await createTag(userId, orderId, tagId);

    const res = await request(app)
      .post('/api/customer/tags/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ tagId });

    expect(res.status).toBe(200);
    const tag = await mongoose.connection.collections.tags.findOne({ tagId });
    expect(tag!.status).toBe('active');
  });

  it('at the limit → typed 409 with the fee offer (config-driven amount)', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'cap-at@example.com', skipMembership: true });
    const orderId = await createShippedOrder(userId, 'WO-CAP-2');
    await createTag(userId, null, nextTagId(), { status: 'active' });
    await createTag(userId, null, nextTagId(), { status: 'active' }); // 2 of 2
    const tagId = nextTagId();
    await createTag(userId, orderId, tagId);

    const res = await request(app)
      .post('/api/customer/tags/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ tagId });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('tag_limit_reached');
    expect(res.body.feeEligible).toBe(true);
    expect(res.body.limit).toBe(2); // commerce setting default — non-member
    expect(res.body.activeCount).toBe(2);
    expect(res.body.feeAmount).toBe(19.99);
    expect(res.body.upgradeUrl).toBe('/membership');
    expect(res.body.feeUrl).toContain(`/account/tag-activation-fee?tagId=${tagId}`);
  });

  it('beyond the paid slot → blocked with NO fee option (membership prompt only)', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'cap-over@example.com', skipMembership: true });
    const orderId = await createShippedOrder(userId, 'WO-CAP-3');
    await createTag(userId, null, nextTagId(), { status: 'active' });
    await createTag(userId, null, nextTagId(), { status: 'active' });
    await createTag(userId, null, nextTagId(), { status: 'active' }); // 3 active = limit+1
    const tagId = nextTagId();
    await createTag(userId, orderId, tagId);

    const res = await request(app)
      .post('/api/customer/tags/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ tagId });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('tag_limit_reached');
    expect(res.body.feeEligible).toBe(false);
  });

  it('replacement tags bypass the cap (R4)', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'cap-replace@example.com', skipMembership: true });
    const orderId = await createShippedOrder(userId, 'WO-CAP-4');
    await createTag(userId, null, nextTagId(), { status: 'active' });
    await createTag(userId, null, nextTagId(), { status: 'active' });
    const oldTagId = nextTagId();
    const oldOid = await createTag(userId, orderId, oldTagId, { status: 'active' });
    const tagId = nextTagId();
    await createTag(userId, orderId, tagId, { replacesTagId: oldOid });

    const res = await request(app)
      .post('/api/customer/tags/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ tagId });

    expect(res.status).toBe(200);
    const tag = await mongoose.connection.collections.tags.findOne({ tagId });
    expect(tag!.status).toBe('active');
  });
});

describe('one-time activation fee checkout', () => {
  async function setupAtLimit(email: string) {
    const user = await createCustomerWithRBAC({ email, skipMembership: true });
    const orderId = await createShippedOrder(user.userId, `WO-FEE-${seq}`);
    await createTag(user.userId, null, nextTagId(), { status: 'active' });
    await createTag(user.userId, null, nextTagId(), { status: 'active' });
    const tagId = nextTagId();
    await createTag(user.userId, orderId, tagId);
    return { ...user, tagId };
  }

  it('creates a fee pending bound to the tag — amount from config, GST extracted, stock reserved, idempotent', async () => {
    const { userId, token, tagId } = await setupAtLimit('fee-create@example.com');

    const res = await request(app)
      .post(`/api/customer/tags/${tagId}/activation-checkout`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(data.tagId).toBe(tagId);
    expect(data.feeAmount).toBe(19.99); // commerce.tagActivation.feeAmount default
    expect(data.amount).toBe(19.99); // CPF ships off in tests
    expect(data.gst).toBeGreaterThan(0); // GST-inclusive fee → extracted portion
    expect(data.clientSecret).toBeTruthy();

    const pending = await mongoose.connection.collections.pendingorders.findOne({ 'tagActivation.tagId': tagId });
    expect(pending).toBeTruthy();
    expect(pending!.total).toBe(19.99);
    expect(pending!.items[0].productName).toBe('Tag Activation Fee');

    const product = await mongoose.connection.collections.products.findOne({ slug: 'tag-activation-fee' });
    expect(product!.reserved).toBe(1); // reserved via the shared pipeline

    // Idempotent: same tag → same intent, never a second charge
    const again = await request(app)
      .post(`/api/customer/tags/${tagId}/activation-checkout`)
      .set('Authorization', `Bearer ${token}`);
    expect(again.status).toBe(201);
    expect(again.body.data.paymentIntentId).toBe(data.paymentIntentId);
    expect(await mongoose.connection.collections.pendingorders.countDocuments({ 'tagActivation.tagId': tagId })).toBe(1);
  });

  it('confirm → Order + Invoice (PDF receipt path), NO fulfilment, and redeem then succeeds', async () => {
    const { userId, token, tagId } = await setupAtLimit('fee-confirm@example.com');

    const checkout = await request(app)
      .post(`/api/customer/tags/${tagId}/activation-checkout`)
      .set('Authorization', `Bearer ${token}`);
    expect(checkout.status).toBe(201);
    const paymentIntentId = checkout.body.data.paymentIntentId;

    const confirm = await request(app)
      .post('/api/checkout/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentIntentId, portal: 'customer-web' });
    expect(confirm.status).toBe(200);

    const order = await mongoose.connection.collections.orders.findOne({ 'tagActivation.tagId': tagId });
    expect(order).toBeTruthy();
    expect(order!.payment.status).toBe('completed');
    expect(order!.payment.amount).toBe(19.99);

    // Invoice created → the standard email/PDF receipt path
    const invoice = await mongoose.connection.collections.invoices.findOne({ orderId: order!._id });
    expect(invoice).toBeTruthy();

    // Fee orders are pure payments — no warehouse fulfilment (8d guard)
    expect(await mongoose.connection.collections.fulfilments.countDocuments({ orderId: order!._id })).toBe(0);

    // The paid fee unlocks THIS tag's activation
    const redeem = await request(app)
      .post('/api/customer/tags/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ tagId });
    expect(redeem.status).toBe(200);
    const tag = await mongoose.connection.collections.tags.findOne({ tagId });
    expect(tag!.status).toBe('active');

    // …and a DIFFERENT tag is still blocked — only ONE paid slot exists (R3/R5)
    const otherTagId = nextTagId();
    await createTag(userId, null, otherTagId);
    const blockedAgain = await request(app)
      .post('/api/customer/tags/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ tagId: otherTagId });
    expect(blockedAgain.status).toBe(409);
    expect(blockedAgain.body.feeEligible).toBe(false); // upgrade only — no second fee
  });

  it('refuses to start a checkout for a tag the customer does not own', async () => {
    const { token } = await createCustomerWithRBAC({ email: 'fee-owner@example.com', skipMembership: true });

    const res = await request(app)
      .post(`/api/customer/tags/${nextTagId()}/activation-checkout`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('widget feeds (same service, both portals)', () => {
  it('GET /api/membership/status carries tagUsage for the dashboard', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'usage-customer@example.com', skipMembership: true });
    await createTag(userId, null, nextTagId(), { status: 'active' });
    await createTag(userId, null, nextTagId()); // purchased, not active

    const res = await request(app)
      .get('/api/membership/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tagUsage).toEqual({ activeCount: 1, purchasedCount: 2, limit: 2 });
  });

  it('GET /api/admin/users/:id/tag-usage serves the CSR drawer (tier limit for members)', async () => {
    // Registry rows for tag_limit (the helper seeds only notification/health
    // benefits) — admin-editable business data, seeded here as fixture data.
    await mongoose.connection.collections.membershipbenefits.insertOne({
      key: 'tag_limit',
      name: 'Tag Limit',
      type: 'number',
      category: 'general',
      defaultValue: 1,
      enabled: true,
      displayOrder: 13,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await mongoose.connection.collections.membershiptierbenefits.insertOne({
      benefitKey: 'tag_limit',
      tier: 'platinum',
      enabled: true,
      value: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { membershipEntitlementService } = await import('../../packages/api/src/services/membership-entitlement.service');
    membershipEntitlementService.invalidateCache();

    const { userId } = await createCustomerWithRBAC({ email: 'usage-admin@example.com' }); // auto Platinum
    await createTag(userId, null, nextTagId(), { status: 'active' });

    const admin = await createSuperAdmin();
    const res = await request(app)
      .get(`/api/admin/users/${userId}/tag-usage`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ activeCount: 1, purchasedCount: 1, limit: 10 }); // Platinum registry value
  });
});

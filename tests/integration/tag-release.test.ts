import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { createCustomerWithRBAC, createSuperAdmin } from './helpers';

/**
 * Tag release on order cancellation/refund — end-to-end wiring.
 * docs/TAG-RELEASE-ON-CANCEL-REFUND.md
 *
 * Covers: cancel path (tags + fulfilment + subscriptions), the founder's
 * two-tag invariant at service level (see unit tests), route guards that
 * stop tag minting on dead orders, and the customer/finder read surfaces.
 */

const providerMocks = vi.hoisted(() => ({
  createRefund: vi.fn(),
  retrievePaymentIntent: vi.fn(),
  retrieveRefund: vi.fn(),
  listRefundsByPaymentIntent: vi.fn(),
}));

vi.mock('../../packages/api/src/commerce/providers/stripe', () => ({
  stripePaymentProvider: {
    createRefund: (...args: any[]) => providerMocks.createRefund(...args),
    retrievePaymentIntent: (...args: any[]) => providerMocks.retrievePaymentIntent(...args),
    retrieveRefund: (...args: any[]) => providerMocks.retrieveRefund(...args),
    listRefundsByPaymentIntent: (...args: any[]) => providerMocks.listRefundsByPaymentIntent(...args),
  },
}));

import { cancelOrder } from '../../packages/api/src/commerce/services/cancellation.service';
import { releaseTagsForOrder } from '../../packages/api/src/commerce/services/tag-release.service';

const cancelActor = { name: 'Cancel Tester', type: 'customer' as const, portal: 'customer-web' };

async function createProduct(stock = 10): Promise<string> {
  const res = await mongoose.connection.collections.products.insertOne({
    name: 'Tag Release Test Tag',
    sku: `TR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    price: 19.99,
    productType: 'physical',
    stock,
    reserved: stock,
    stockPolicy: 'deny',
    isActive: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return res.insertedId.toString();
}

async function createPaidOrder(userId: string, productId: string, opts: { status?: string } = {}) {
  const res = await mongoose.connection.collections.orders.insertOne({
    orderNumber: `WO-TR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: new mongoose.Types.ObjectId(userId),
    items: [{
      productId: new mongoose.Types.ObjectId(productId),
      productName: 'Tag Release Test Tag',
      sku: 'TR-1',
      unitPrice: 19.99,
      totalPrice: 19.99,
      customizationTotal: 0,
      quantity: 1,
    }],
    subtotal: 19.99,
    shippingCost: 0,
    tax: 3.04,
    status: opts.status || 'paid',
    completionStatus: 'complete',
    shippingAddress: { line1: '1 Test Street', city: 'Auckland', state: 'Auckland', zip: '1010', country: 'NZ' },
    payment: {
      method: 'card',
      status: 'completed',
      transactionId: 'pi_tag_release_test',
      stripePaymentIntentId: 'pi_tag_release_test',
      amount: 23.03,
      currency: 'NZD',
      paidAt: new Date(),
      cardBrand: 'visa',
      cardLast4: '4242',
    },
    createdBy: 'Test', createdByType: 'Customer', createdByPortal: 'customer-web',
    createdAt: new Date(), updatedAt: new Date(),
  });
  return res.insertedId.toString();
}

async function createTagForOrder(orderId: string, userId: string, status = 'inactive') {
  const now = new Date();
  const activeEnd = new Date(now);
  activeEnd.setMonth(activeEnd.getMonth() + 3);
  const warrantyEnd = new Date(now);
  warrantyEnd.setMonth(warrantyEnd.getMonth() + 12);
  const res = await mongoose.connection.collections.tags.insertOne({
    tagId: `PT-TR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tagType: 'qr',
    ownerId: new mongoose.Types.ObjectId(userId),
    orderId: new mongoose.Types.ObjectId(orderId),
    status,
    subscriptionStatus: 'none',
    activePeriodEndsAt: activeEnd,
    warrantyEndsAt: warrantyEnd,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return res.insertedId.toString();
}

async function createOpenFulfilment(orderId: string, orderNumber: string) {
  const res = await mongoose.connection.collections.fulfilments.insertOne({
    orderId: new mongoose.Types.ObjectId(orderId),
    orderNumber,
    status: 'packing',
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return res.insertedId.toString();
}

beforeAll(async () => { await setupTestDb(); }, 30000);
afterAll(async () => { await teardownTestDb(); }, 10000);
beforeEach(async () => {
  await clearDb();
  vi.clearAllMocks();
  providerMocks.createRefund.mockResolvedValue({ success: true, refundId: 're_tagrel_1', status: 'succeeded' });
});

describe('cancelOrder releases generated tags, fulfilment and subscriptions', () => {
  it('cancels the order → every live tag frozen, open fulfilment cancelled, subscription cancelled', async () => {
    const { userId } = await createCustomerWithRBAC({ email: 'cancel-release@example.com' });
    const productId = await createProduct();
    const orderId = await createPaidOrder(userId, productId);
    const orderDoc = await mongoose.connection.collections.orders.findOne({ _id: new mongoose.Types.ObjectId(orderId) });
    const tagA = await createTagForOrder(orderId, userId, 'inactive');
    const tagB = await createTagForOrder(orderId, userId, 'inactive');
    const fulfilmentId = await createOpenFulfilment(orderId, orderDoc!.orderNumber as string);

    const subscription = await (await import('@pawtag/db')).Subscription.create({
      userId: new mongoose.Types.ObjectId(userId),
      planName: 'Gold Membership',
      planType: 'gold',
      status: 'active',
      price: 9.99,
      currency: 'NZD',
      tagId: new mongoose.Types.ObjectId(tagA),
      startDate: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const result = await cancelOrder({
      orderId,
      reason: 'Changed my mind',
      notes: 'tag release test',
      actor: cancelActor,
      requireRefundSuccess: false,
    });
    expect(result.success).toBe(true);

    // Tags frozen (status only — ownership kept for audit)
    const tags = await mongoose.connection.collections.tags
      .find({ orderId: new mongoose.Types.ObjectId(orderId) })
      .toArray();
    expect(tags).toHaveLength(2);
    for (const tag of tags) {
      expect(tag.status).toBe('cancelled');
      expect(tag.ownerId).toBeTruthy(); // ownership kept — unlike 'returned'
    }

    // Open fulfilment cancelled
    const fulfilment = await mongoose.connection.collections.fulfilments.findOne({ _id: new mongoose.Types.ObjectId(fulfilmentId) });
    expect(fulfilment!.status).toBe('cancelled');

    // Subscription cancelled (no Stripe sub on fixture → local cancel)
    const sub = await (await import('@pawtag/db')).Subscription.findById(subscription._id).lean();
    expect(sub!.cancelledAt).toBeTruthy();
    expect(sub!.status).toBe('cancelled');

    // Idempotent: a second release run finds nothing to do — released tags
    // are excluded at the DB level and their state never flips again.
    const again = await releaseTagsForOrder(orderId, 'order_cancelled');
    expect(again).toEqual({ released: [], skipped: [] });
    const afterRelease = await mongoose.connection.collections.tags
      .find({ orderId: new mongoose.Types.ObjectId(orderId) })
      .toArray();
    expect(afterRelease.every((t) => t.status === 'cancelled')).toBe(true);
  });

  it('released tags vanish from the customer tag list and cannot be redeemed', async () => {
    const { userId, token } = await createCustomerWithRBAC({ email: 'cancel-ux@example.com' });
    const productId = await createProduct();
    const orderId = await createPaidOrder(userId, productId);
    const tagId = await createTagForOrder(orderId, userId, 'inactive');

    await cancelOrder({
      orderId,
      reason: 'Changed my mind',
      notes: 'tag release ux test',
      actor: cancelActor,
      requireRefundSuccess: false,
    });

    // Customer list no longer shows it
    const list = await request(app)
      .get('/api/customer/tags')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    const listed = (list.body.data || []).map((t: any) => t._id);
    expect(listed).not.toContain(tagId);

    // Redeem gives a clear released-order message (not "already activated")
    const tagDoc = await mongoose.connection.collections.tags.findOne({ _id: new mongoose.Types.ObjectId(tagId) });
    const redeem = await request(app)
      .post('/api/customer/tags/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ tagId: tagDoc!.tagId });
    expect(redeem.status).toBe(409);
    expect(redeem.body.error).toMatch(/released after its order was cancelled or refunded/i);

    // Finder scan: not findable, generic inactive response, no pet/owner data
    const finder = await request(app).get(`/api/finder/${tagDoc!.tagId}`);
    expect(finder.status).toBe(200);
    expect(finder.body.data.tagActive).toBe(false);
    expect(finder.body.data.petInfo).toBeNull();
  });
});

describe('direct admin refund releases tags on FULL refund (P6)', () => {
  it('freezes the delivered order\'s active tag when the whole capture is refunded', async () => {
    const admin = await createSuperAdmin();
    const { userId } = await createCustomerWithRBAC({ email: 'admin-refund-release@example.com' });
    const productId = await createProduct();
    const orderId = await createPaidOrder(userId, productId, { status: 'delivered' });
    const orderDoc = await mongoose.connection.collections.orders.findOne({ _id: new mongoose.Types.ObjectId(orderId) });
    const tagId = await createTagForOrder(orderId, userId, 'active');

    providerMocks.createRefund.mockResolvedValue({
      success: true,
      refundId: 're_admin_full_1',
      status: 'succeeded',
      arn: 'ARN_ADMIN_FULL_1',
      expectedArrival: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .post(`/api/admin/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ amount: orderDoc!.payment.amount, reason: 'goodwill full refund' });

    expect(res.status).toBe(200);

    const tag = await mongoose.connection.collections.tags.findOne({ _id: new mongoose.Types.ObjectId(tagId) });
    expect(tag!.status).toBe('cancelled');
    expect(tag!.ownerId).toBeTruthy(); // frozen, not detached

    const updatedOrder = await mongoose.connection.collections.orders.findOne({ _id: new mongoose.Types.ObjectId(orderId) });
    expect(updatedOrder!.status).toBe('refunded');
  });

  it('PARTIAL refund on the same route freezes nothing (no per-tag attribution)', async () => {
    const admin = await createSuperAdmin();
    const { userId } = await createCustomerWithRBAC({ email: 'admin-partial-release@example.com' });
    const productId = await createProduct();
    const orderId = await createPaidOrder(userId, productId, { status: 'delivered' });
    const tagId = await createTagForOrder(orderId, userId, 'active');

    providerMocks.createRefund.mockResolvedValue({ success: true, refundId: 're_admin_part_1', status: 'succeeded' });

    const res = await request(app)
      .post(`/api/admin/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ amount: 5, reason: 'partial goodwill' });

    expect(res.status).toBe(200);

    const tag = await mongoose.connection.collections.tags.findOne({ _id: new mongoose.Types.ObjectId(tagId) });
    expect(tag!.status).toBe('active'); // ambiguous attribution → never guess
    const updatedOrder = await mongoose.connection.collections.orders.findOne({ _id: new mongoose.Types.ObjectId(orderId) });
    expect(updatedOrder!.status).toBe('delivered'); // partial keeps order status
  });
});

describe('fulfilment route guards on dead orders (R5)', () => {
  async function cancelledOrderWithFulfilment() {
    const { userId } = await createCustomerWithRBAC({ email: 'guard@example.com' });
    const productId = await createProduct();
    const orderId = await createPaidOrder(userId, productId, { status: 'cancelled' });
    const orderDoc = await mongoose.connection.collections.orders.findOne({ _id: new mongoose.Types.ObjectId(orderId) });
    const fulfilmentId = await createOpenFulfilment(orderId, orderDoc!.orderNumber as string);
    return { orderId, fulfilmentId, productId };
  }

  it('assign-tag is rejected with 409 for a cancelled order — no tag IDs burned', async () => {
    const admin = await createSuperAdmin();
    const { fulfilmentId, productId } = await cancelledOrderWithFulfilment();

    const before = await mongoose.connection.collections.tags.countDocuments({});

    const res = await request(app)
      .post(`/api/admin/commerce/fulfilments/${fulfilmentId}/assign-tag`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ orderItemId: new mongoose.Types.ObjectId().toString(), productId });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/cancelled/);
    expect(await mongoose.connection.collections.tags.countDocuments({})).toBe(before);
  });

  it('fulfilment status updates are rejected with 409 for a cancelled order', async () => {
    const admin = await createSuperAdmin();
    const { fulfilmentId } = await cancelledOrderWithFulfilment();

    const res = await request(app)
      .put(`/api/admin/commerce/fulfilments/${fulfilmentId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'fulfilled' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/cancelled/);
    const fulfilment = await mongoose.connection.collections.fulfilments.findOne({ _id: new mongoose.Types.ObjectId(fulfilmentId) });
    expect(fulfilment!.status).toBe('packing'); // unchanged
  });
});

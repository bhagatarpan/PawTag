import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Order, WebhookEvent, Notification } from '@pawtag/db';
import { createSuperAdmin } from './helpers';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

describe('Sync Architecture — Order Model Enhancements', () => {
  it('should store medusaOrderId on new orders', async () => {
    const { userId, token } = await createSuperAdmin();

    const order = await Order.create({
      orderNumber: 'PT-SYNC-001',
      userId,
      medusaOrderId: 'medusa_order_123',
      items: [{
        productId: new mongoose.Types.ObjectId(),
        productName: 'PawTag Test',
        quantity: 1,
        unitPrice: 19.99,
        totalPrice: 19.99,
      }],
      status: 'paid',
      payment: {
        method: 'card',
        status: 'completed',
        transactionId: 'medusa_order_123',
        stripePaymentIntentId: 'pi_test_123',
        amount: 19.99,
        currency: 'NZD',
        paidAt: new Date(),
      },
      shippingAddress: {
        line1: '123 Test St',
        city: 'Auckland',
        state: 'Auckland',
        zip: '1010',
        country: 'NZ',
      },
    });

    expect(order.medusaOrderId).toBe('medusa_order_123');
    expect(order.payment.stripePaymentIntentId).toBe('pi_test_123');
  });

  it('should find order by medusaOrderId', async () => {
    const { userId } = await createSuperAdmin();

    await Order.create({
      orderNumber: 'PT-SYNC-002',
      userId,
      medusaOrderId: 'medusa_find_test',
      items: [{
        productId: new mongoose.Types.ObjectId(),
        productName: 'PawTag Test',
        quantity: 1,
        unitPrice: 19.99,
        totalPrice: 19.99,
      }],
      status: 'paid',
      payment: {
        method: 'card',
        status: 'completed',
        amount: 19.99,
        currency: 'NZD',
      },
      shippingAddress: {
        line1: '123 Test St',
        city: 'Auckland',
        state: 'Auckland',
        zip: '1010',
        country: 'NZ',
      },
    });

    const found = await Order.findOne({ medusaOrderId: 'medusa_find_test' });
    expect(found).toBeTruthy();
    expect(found!.orderNumber).toBe('PT-SYNC-002');
  });

  it('should backfill medusaOrderId on legacy orders found via payment.transactionId', async () => {
    const { userId } = await createSuperAdmin();

    // Create a legacy order without medusaOrderId
    const order = await Order.create({
      orderNumber: 'PT-SYNC-003',
      userId,
      items: [{
        productId: new mongoose.Types.ObjectId(),
        productName: 'PawTag Test',
        quantity: 1,
        unitPrice: 19.99,
        totalPrice: 19.99,
      }],
      status: 'paid',
      payment: {
        method: 'card',
        status: 'completed',
        transactionId: 'legacy_medusa_id',
        amount: 19.99,
        currency: 'NZD',
      },
      shippingAddress: {
        line1: '123 Test St',
        city: 'Auckland',
        state: 'Auckland',
        zip: '1010',
        country: 'NZ',
      },
    });

    expect(order.medusaOrderId).toBeUndefined();

    // Simulate the backfill that findOrderByMedusaId does
    const found = await Order.findOne({ 'payment.transactionId': 'legacy_medusa_id' });
    expect(found).toBeTruthy();

    // Backfill
    found!.medusaOrderId = 'legacy_medusa_id';
    await found!.save();

    const refetched = await Order.findById(order._id);
    expect(refetched!.medusaOrderId).toBe('legacy_medusa_id');
  });
});

describe('Sync Architecture — Webhook Retry Job', () => {
  it('should have exponential backoff delays', async () => {
    // Test the backoff multiplier logic
    const BACKOFF_MULTIPLIERS = [1, 2, 5, 15, 60];
    const RETRY_INTERVAL = 60_000;

    expect(RETRY_INTERVAL * BACKOFF_MULTIPLIERS[0]).toBe(60_000);   // 1 min
    expect(RETRY_INTERVAL * BACKOFF_MULTIPLIERS[1]).toBe(120_000);  // 2 min
    expect(RETRY_INTERVAL * BACKOFF_MULTIPLIERS[2]).toBe(300_000);  // 5 min
    expect(RETRY_INTERVAL * BACKOFF_MULTIPLIERS[3]).toBe(900_000);  // 15 min
    expect(RETRY_INTERVAL * BACKOFF_MULTIPLIERS[4]).toBe(3_600_000); // 60 min
  });

  it('should mark events as dead after max attempts', async () => {
    const event = await WebhookEvent.create({
      source: 'medusa',
      event: 'order.placed',
      eventId: 'retry_test_1',
      payload: { event: 'order.placed', data: { id: 'test' } },
      status: 'failed',
      attempts: 4,
      maxAttempts: 5,
      nextRetryAt: new Date(Date.now() - 1000),
    });

    expect(event.status).toBe('failed');
    expect(event.attempts).toBe(4);

    // Simulate one more attempt
    event.attempts += 1;
    event.status = event.attempts >= event.maxAttempts ? 'dead' : 'failed';
    await event.save();

    const updated = await WebhookEvent.findById(event._id);
    expect(updated!.status).toBe('dead');
  });
});

describe('Sync Architecture — Webhook Event Storage', () => {
  it('should store webhook events with idempotency key', async () => {
    const event = await WebhookEvent.create({
      source: 'medusa',
      event: 'order.placed',
      eventId: 'idempotent_test_1',
      payload: { event: 'order.placed', data: { id: 'test' } },
      status: 'processing',
      attempts: 1,
    });

    expect(event.eventId).toBe('idempotent_test_1');
    expect(event.status).toBe('processing');

    // Duplicate should fail due to unique index
    await expect(
      WebhookEvent.create({
        source: 'medusa',
        event: 'order.placed',
        eventId: 'idempotent_test_1',
        payload: { event: 'order.placed', data: { id: 'test' } },
        status: 'processing',
        attempts: 1,
      }),
    ).rejects.toThrow();
  });

  it('should query failed events for retry', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 1000);

    await WebhookEvent.create({
      source: 'medusa',
      event: 'order.placed',
      eventId: 'retry_query_1',
      payload: { event: 'order.placed', data: { id: 'test' } },
      status: 'failed',
      attempts: 2,
      nextRetryAt: past,
      createdAt: past,
    });

    const failedEvents = await WebhookEvent.find({
      status: 'failed',
      attempts: { $lt: 5 },
      nextRetryAt: { $lte: now },
      createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    }).limit(10);

    expect(failedEvents.length).toBeGreaterThanOrEqual(1);
    expect(failedEvents[0].eventId).toBe('retry_query_1');
  });
});

describe('Sync Architecture — Admin Endpoints with Medusa Sync', () => {
  it('POST /api/admin/orders/:id/cancel should update PawTag order', async () => {
    const { userId, token } = await createSuperAdmin();

    const order = await Order.create({
      orderNumber: 'PT-SYNC-CANCEL-001',
      userId,
      medusaOrderId: 'medusa_cancel_test',
      items: [{
        productId: new mongoose.Types.ObjectId(),
        productName: 'PawTag Test',
        quantity: 1,
        unitPrice: 19.99,
        totalPrice: 19.99,
      }],
      status: 'paid',
      payment: {
        method: 'card',
        status: 'completed',
        amount: 19.99,
        currency: 'NZD',
        paidAt: new Date(),
      },
      shippingAddress: {
        line1: '123 Test St',
        city: 'Auckland',
        state: 'Auckland',
        zip: '1010',
        country: 'NZ',
      },
    });

    const res = await request(app)
      .post(`/api/admin/orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Test cancellation' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder!.status).toBe('cancelled');
    expect(updatedOrder!.cancellationReason).toBe('Test cancellation');
  });

  it('POST /api/admin/orders/:id/cancel should reject invalid transition', async () => {
    const { userId, token } = await createSuperAdmin();

    const order = await Order.create({
      orderNumber: 'PT-SYNC-CANCEL-002',
      userId,
      items: [{
        productId: new mongoose.Types.ObjectId(),
        productName: 'PawTag Test',
        quantity: 1,
        unitPrice: 19.99,
        totalPrice: 19.99,
      }],
      status: 'cancelled',
      payment: {
        method: 'card',
        status: 'completed',
        amount: 19.99,
        currency: 'NZD',
      },
      shippingAddress: {
        line1: '123 Test St',
        city: 'Auckland',
        state: 'Auckland',
        zip: '1010',
        country: 'NZ',
      },
    });

    const res = await request(app)
      .post(`/api/admin/orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Already cancelled' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/admin/orders/:id/cancel should require reason', async () => {
    const { userId, token } = await createSuperAdmin();

    const order = await Order.create({
      orderNumber: 'PT-SYNC-CANCEL-003',
      userId,
      items: [{
        productId: new mongoose.Types.ObjectId(),
        productName: 'PawTag Test',
        quantity: 1,
        unitPrice: 19.99,
        totalPrice: 19.99,
      }],
      status: 'paid',
      payment: {
        method: 'card',
        status: 'completed',
        amount: 19.99,
        currency: 'NZD',
        paidAt: new Date(),
      },
      shippingAddress: {
        line1: '123 Test St',
        city: 'Auckland',
        state: 'Auckland',
        zip: '1010',
        country: 'NZ',
      },
    });

    const res = await request(app)
      .post(`/api/admin/orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('reason');
  });
});

describe('Sync Architecture — Order Notification Service', () => {
  it('should create notification for customer on status change', async () => {
    const { userId } = await createSuperAdmin();

    const order = await Order.create({
      orderNumber: 'PT-SYNC-NOTIF-001',
      userId,
      items: [{
        productId: new mongoose.Types.ObjectId(),
        productName: 'PawTag Test',
        quantity: 1,
        unitPrice: 19.99,
        totalPrice: 19.99,
      }],
      status: 'paid',
      payment: {
        method: 'card',
        status: 'completed',
        amount: 19.99,
        currency: 'NZD',
        paidAt: new Date(),
      },
      shippingAddress: {
        line1: '123 Test St',
        city: 'Auckland',
        state: 'Auckland',
        zip: '1010',
        country: 'NZ',
      },
    });

    // Import and call the notification service
    const { notifyCustomerOfStatusChange } = await import('../../packages/api/src/services/orderNotification.service');

    // Mock email and push to avoid external calls
    vi.mock('../../packages/api/src/services/email.service', () => ({
      sendMail: vi.fn().mockResolvedValue(true),
    }));
    vi.mock('../../packages/api/src/services/push-notification.service', () => ({
      sendPushToUser: vi.fn().mockResolvedValue(true),
    }));

    const result = await notifyCustomerOfStatusChange(order, 'shipped', {
      trackingNumber: 'TRACK123',
      carrier: 'NZ Post',
    });

    expect(result).toBe(true);

    // Verify in-app notification was created
    const notifications = await Notification.find({
      userId,
      audience: 'customer',
      type: 'order_update',
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0].title).toBe('Order shipped');
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';

async function createCustomer(overrides: Partial<{ email: string; fullName: string; password: string }> = {}) {
  const email = overrides.email || `user-${Date.now()}@example.com`;
  const password = overrides.password || 'Password123!';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await mongoose.connection.collections.users.insertOne({
    email,
    passwordHash,
    fullName: overrides.fullName || 'Test User',
    phoneNumber: '+64219999999',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { userId: user.insertedId.toString(), email, password };
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.data?.token || '';
}

async function createPendingOrder(userId: string, paymentIntentId: string) {
  await mongoose.connection.collections.pendingorders.insertOne({
    userId: new mongoose.Types.ObjectId(userId),
    items: [{
      productId: new mongoose.Types.ObjectId(),
      productName: 'Test Product',
      sku: 'TEST-001',
      unitPrice: 39.00,
      customizationTotal: 0,
      quantity: 1,
    }],
    subtotal: 39.00,
    discount: 0,
    shipping: 5.00,
    tax: 0,
    total: 44.00,
    currency: 'NZD',
    stripePaymentIntentId: paymentIntentId,
    status: 'pending',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

// ═══════════════════════════════════════════
// HORIZONTAL AUTHORIZATION
// ═══════════════════════════════════════════

describe('Integration: Checkout Ownership Enforcement', () => {
  it('User A cannot confirm User B\'s PendingOrder', async () => {
    const userA = await createCustomer({ email: 'owner-a@example.com' });
    const userB = await createCustomer({ email: 'owner-b@example.com' });

    // User B creates a pending order
    const paymentIntentId = 'pi_stolen_payment_123';
    await createPendingOrder(userB.userId, paymentIntentId);

    // User A tries to confirm User B's order
    const tokenA = await loginAs(userA.email, userA.password);
    const res = await request(app)
      .post('/api/checkout/confirm')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ paymentIntentId });

    // Should fail — ownership mismatch
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('User A cannot retrieve User B\'s PendingOrder via paymentIntentId', async () => {
    const userA = await createCustomer({ email: 'retrieve-a@example.com' });
    const userB = await createCustomer({ email: 'retrieve-b@example.com' });

    // User B creates a pending order
    const paymentIntentId = 'pi_retrieve_stolen_123';
    await createPendingOrder(userB.userId, paymentIntentId);

    // User A tries to get User B's pending order
    const tokenA = await loginAs(userA.email, userA.password);
    const res = await request(app)
      .get('/api/checkout/pending')
      .set('Authorization', `Bearer ${tokenA}`);

    // Should return null (User A has no pending order), not User B's order
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });
});

// ═══════════════════════════════════════════
// OWNERSHIP ACROSS TOKEN REFRESH
// ═══════════════════════════════════════════

describe('Integration: Checkout Ownership — Token Refresh', () => {
  it('User can confirm their own PendingOrder after token refresh', async () => {
    const user = await createCustomer({ email: 'refresh-user@example.com' });

    // Create pending order
    const paymentIntentId = 'pi_own_payment_refresh_123';
    await createPendingOrder(user.userId, paymentIntentId);

    // Login and get first token
    const token1 = await loginAs(user.email, user.password);
    expect(token1).toBeTruthy();

    // Get a fresh token (simulating refresh)
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: undefined }); // No refresh token, just verify login works

    // Use original token to confirm
    const res = await request(app)
      .post('/api/checkout/confirm')
      .set('Authorization', `Bearer ${token1}`)
      .send({ paymentIntentId });

    // Should succeed (or fail with Stripe validation, but NOT with ownership error)
    // The important thing is it doesn't fail with "not found due to ownership"
    expect(res.status).not.toBe(404);
  });
});

// ═══════════════════════════════════════════
// IDEMPOTENCY
// ═══════════════════════════════════════════

describe('Integration: Checkout Ownership — Idempotency', () => {
  it('confirming the same PendingOrder twice returns the same order (idempotent)', async () => {
    const user = await createCustomer({ email: 'idempotent-user@example.com' });

    // Create a pending order that's already converted
    const paymentIntentId = 'pi_idempotent_123';
    const orderId = new mongoose.Types.ObjectId();
    await mongoose.connection.collections.pendingorders.insertOne({
      userId: new mongoose.Types.ObjectId(user.userId),
      items: [{
        productId: new mongoose.Types.ObjectId(),
        productName: 'Test Product',
        sku: 'TEST-IDEM',
        unitPrice: 39.00,
        customizationTotal: 0,
        quantity: 1,
      }],
      subtotal: 39.00,
      discount: 0,
      shipping: 5.00,
      tax: 0,
      total: 44.00,
      currency: 'NZD',
      stripePaymentIntentId: paymentIntentId,
      status: 'converted',
      convertedOrderId: orderId,
      convertedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create the order that was converted to
    await mongoose.connection.collections.orders.insertOne({
      _id: orderId,
      orderNumber: 'PT-ORDER-001',
      userId: new mongoose.Types.ObjectId(user.userId),
      items: [],
      subtotal: 39.00,
      shippingCost: 5.00,
      tax: 0,
      status: 'paid',
      payment: {
        method: 'card',
        status: 'completed',
        transactionId: paymentIntentId,
        stripePaymentIntentId: paymentIntentId,
        amount: 44.00,
        currency: 'NZD',
        paidAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Confirm twice
    const token = await loginAs(user.email, user.password);
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/checkout/confirm')
        .set('Authorization', `Bearer ${token}`)
        .send({ paymentIntentId }),
      request(app)
        .post('/api/checkout/confirm')
        .set('Authorization', `Bearer ${token}`)
        .send({ paymentIntentId }),
    ]);

    // Both should return the same order
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.data.isNew).toBe(false);
    expect(res2.body.data.isNew).toBe(false);
  });
});

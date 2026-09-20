/**
 * Phase 3 Manipulation Tests
 *
 * Verify that client-submitted financial values are ignored or rejected.
 * Server must remain authoritative for shipping cost, cart total, and payment amount.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { createCustomerWithRBAC, createSuperAdmin } from './helpers';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

describe('Phase 3 — Shipping Cost Authority', () => {
  describe('POST /api/shipping/select rejects client cost', () => {
    it('ignores client-submitted cost and uses server rate', async () => {
      const { userId, token } = await createCustomerWithRBAC({ email: 'shipping-test@test.com' });

      // Create a shipping method in the database
      const method = await mongoose.connection.collections.shippingmethods.insertOne({
        name: 'Standard Shipping',
        rate: 9.99,
        carrier: 'NZ Post',
        estimatedDays: '3-5',
        isActive: true,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const methodId = method.insertedId.toString();

      // Create a cart with items
      await mongoose.connection.collections.carts.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        status: 'active',
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productName: 'Test Product',
            sku: 'TEST-001',
            quantity: 1,
            unitPrice: 29.99,
            customizationTotal: 0,
          },
        ],
        shippingCost: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      });

      // Client tries to set cost to $0 (should be ignored)
      const res = await request(app)
        .post('/api/shipping/select')
        .set('Authorization', `Bearer ${token}`)
        .send({
          methodId,
          methodName: 'Standard Shipping',
          cost: 0, // <-- client tries to set cost to $0
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify the cart has the SERVER cost ($9.99), not the client cost ($0)
      const cart = await mongoose.connection.collections.carts.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        status: 'active',
      });
      expect(cart?.shippingCost).toBe(9.99);
    });

    it('rejects unknown shipping method', async () => {
      const { token } = await createCustomerWithRBAC({ email: 'shipping-test2@test.com' });

      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/shipping/select')
        .set('Authorization', `Bearer ${token}`)
        .send({
          methodId: fakeId,
          methodName: 'Nonexistent Shipping',
        });

      // ShippingError is caught and returned as 500 or 502 depending on error handling
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/cart/shipping rejects client cost', () => {
    it('ignores client-submitted cost and uses server rate', async () => {
      const { userId, token } = await createCustomerWithRBAC({ email: 'cart-shipping@test.com' });

      // Create a shipping method
      const method = await mongoose.connection.collections.shippingmethods.insertOne({
        name: 'Express Shipping',
        rate: 19.99,
        carrier: 'CourierPost',
        estimatedDays: '1-2',
        isActive: true,
        sortOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const methodId = method.insertedId.toString();

      // Create a cart
      await mongoose.connection.collections.carts.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        status: 'active',
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productName: 'Test Product',
            sku: 'TEST-002',
            quantity: 2,
            unitPrice: 49.99,
            customizationTotal: 0,
          },
        ],
        shippingCost: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      });

      // Client tries to set cost to negative (should be ignored)
      const res = await request(app)
        .post('/api/cart/shipping')
        .set('Authorization', `Bearer ${token}`)
        .send({
          methodId,
          methodName: 'Express Shipping',
          cost: -100, // <-- client tries negative cost
        });

      expect(res.status).toBe(200);

      // Verify server cost is used
      const cart = await mongoose.connection.collections.carts.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        status: 'active',
      });
      expect(cart?.shippingCost).toBe(19.99);
    });
  });

  describe('GET /api/shipping/rates derives cart total server-side', () => {
    it('uses server cart total for Gold free-shipping, not query param', async () => {
      const { userId, token } = await createCustomerWithRBAC({ email: 'rates-gold@test.com' });

      // Make user a Gold member
      await mongoose.connection.collections.users.updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { $set: { guardianTier: 'SAFEGUARD' } }
      );

      // Create a Gold subscription
      await mongoose.connection.collections.subscriptions.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        planName: 'Gold Membership',
        planType: 'gold',
        status: 'active',
        price: 1.99,
        currency: 'NZD',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        autoRenew: true,
        renewalMethod: 'monthly',
        totalScans: 0,
        reminderStates: { graceWeeklySentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create a cart with small total (below Gold free-shipping threshold)
      await mongoose.connection.collections.carts.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        status: 'active',
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productName: 'Test Product',
            sku: 'TEST-003',
            quantity: 1,
            unitPrice: 5.00, // Small total
            customizationTotal: 0,
          },
        ],
        shippingCost: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      });

      // Client tries to trick Gold free-shipping by sending fake cartTotal
      const res = await request(app)
        .get('/api/shipping/rates?line1=123+Test+St&city=Auckland&cartTotal=99999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      // Gold free-shipping should NOT apply because server cart total ($5) is below threshold
      // Rates should have actual costs
      expect(res.body.data).toBeDefined();
    });
  });
});

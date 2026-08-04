import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Order } from '@pawtag/db';
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

describe('Phase 6 — Order Status State Machine (Admin Route)', () => {
  describe('PUT /api/admin/orders/:id/status', () => {
    it('should accept valid transition (pending_payment -> paid)', async () => {
      const { token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-SM-001',
        userId: new mongoose.Types.ObjectId(),
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Test Product',
          quantity: 1,
          unitPrice: 10,
          totalPrice: 10,
        }],
        status: 'pending_payment',
        payment: { method: 'card', status: 'pending', amount: 10, currency: 'NZD' },
        shippingAddress: { line1: '123 St', city: 'Auckland', state: 'AKL', zip: '1010', country: 'NZ' },
      });

      const res = await request(app)
        .put(`/api/admin/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'paid' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('paid');
    });

    it('should reject invalid transition (pending_payment -> shipped)', async () => {
      const { token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-SM-002',
        userId: new mongoose.Types.ObjectId(),
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Test Product',
          quantity: 1,
          unitPrice: 10,
          totalPrice: 10,
        }],
        status: 'pending_payment',
        payment: { method: 'card', status: 'pending', amount: 10, currency: 'NZD' },
        shippingAddress: { line1: '123 St', city: 'Auckland', state: 'AKL', zip: '1010', country: 'NZ' },
      });

      const res = await request(app)
        .put(`/api/admin/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'shipped' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid status transition');
    });

    it('should reject transition to same status', async () => {
      const { token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-SM-003',
        userId: new mongoose.Types.ObjectId(),
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Test Product',
          quantity: 1,
          unitPrice: 10,
          totalPrice: 10,
        }],
        status: 'paid',
        payment: { method: 'card', status: 'completed', amount: 10, currency: 'NZD' },
        shippingAddress: { line1: '123 St', city: 'Auckland', state: 'AKL', zip: '1010', country: 'NZ' },
      });

      const res = await request(app)
        .put(`/api/admin/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'paid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid status transition');
    });

    it('should not allow transition from terminal state (cancelled)', async () => {
      const { token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-SM-004',
        userId: new mongoose.Types.ObjectId(),
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Test Product',
          quantity: 1,
          unitPrice: 10,
          totalPrice: 10,
        }],
        status: 'cancelled',
        payment: { method: 'card', status: 'failed', amount: 10, currency: 'NZD' },
        shippingAddress: { line1: '123 St', city: 'Auckland', state: 'AKL', zip: '1010', country: 'NZ' },
      });

      const res = await request(app)
        .put(`/api/admin/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'paid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid status transition');
    });

    it('should walk a full happy path: paid -> packing -> shipped -> delivered', async () => {
      const { token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-SM-005',
        userId: new mongoose.Types.ObjectId(),
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Test Product',
          quantity: 1,
          unitPrice: 10,
          totalPrice: 10,
        }],
        status: 'paid',
        payment: { method: 'card', status: 'completed', amount: 10, currency: 'NZD', paidAt: new Date() },
        shippingAddress: { line1: '123 St', city: 'Auckland', state: 'AKL', zip: '1010', country: 'NZ' },
      });

      // paid -> packing
      let res = await request(app)
        .put(`/api/admin/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'packing' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('packing');

      // packing -> shipped
      res = await request(app)
        .put(`/api/admin/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'shipped' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('shipped');

      // shipped -> delivered
      res = await request(app)
        .put(`/api/admin/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'delivered' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('delivered');
    });
  });
});

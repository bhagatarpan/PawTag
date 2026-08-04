import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Order, Notification } from '@pawtag/db';
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

describe('Phase 9 — Shipping/Courier Integration', () => {
  describe('POST /api/admin/orders/:id/create-shipment', () => {
    it('should create a shipment for a packing order in demo mode', async () => {
      const { userId, token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-SHIP-9001',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'PawTag Pro',
          quantity: 1,
          unitPrice: 29.99,
          totalPrice: 29.99,
        }],
        status: 'packing',
        payment: {
          method: 'card',
          status: 'completed',
          transactionId: 'pi_ship_test',
          amount: 29.99,
          currency: 'NZD',
          paidAt: new Date(),
        },
        shippingAddress: {
          line1: '456 Ship St',
          city: 'Wellington',
          state: 'Wellington',
          zip: '6010',
          country: 'NZ',
        },
      });

      const res = await request(app)
        .post(`/api/admin/orders/${order._id}/create-shipment`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.trackingNumber).toBeDefined();
      expect(res.body.data.carrier).toBeDefined();
      expect(res.body.data.labelUrl).toBeDefined();

      // Verify order status updated
      const updated = await Order.findById(order._id);
      expect(updated!.status).toBe('shipped');
      expect(updated!.trackingNumber).toBeDefined();
      expect(updated!.carrier).toBeDefined();
      expect(updated!.shippingLabelUrl).toBeDefined();

      // Verify customer notification
      const notifs = await Notification.find({ userId, audience: 'customer', type: 'order_update' });
      expect(notifs.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject creating shipment for a paid order (must be packing)', async () => {
      const { userId, token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-SHIP-9002',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Product',
          quantity: 1,
          unitPrice: 10.00,
          totalPrice: 10.00,
        }],
        status: 'paid',
        payment: {
          method: 'card',
          status: 'completed',
          transactionId: 'pi_paid_ship',
          amount: 10.00,
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
        .post(`/api/admin/orders/${order._id}/create-shipment`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot ship');

      const unchanged = await Order.findById(order._id);
      expect(unchanged!.status).toBe('paid');
    });

    it('should reject creating shipment for an already-shipped order', async () => {
      const { userId, token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-SHIP-9003',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Product',
          quantity: 1,
          unitPrice: 10.00,
          totalPrice: 10.00,
        }],
        status: 'shipped',
        trackingNumber: 'NZOLD123',
        carrier: 'NZ Post',
        payment: {
          method: 'card',
          status: 'completed',
          transactionId: 'pi_already_shipped',
          amount: 10.00,
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
        .post(`/api/admin/orders/${order._id}/create-shipment`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Order, Product, Notification } from '@pawtag/db';
import { createSuperAdmin } from './helpers';

// Mock Stripe payment provider to avoid real API calls in tests
vi.mock('../../packages/api/src/commerce/providers/stripe', () => ({
  stripePaymentProvider: {
    createRefund: vi.fn().mockResolvedValue({
      success: true,
      refundId: 're_test_mock_001',
      status: 'succeeded',
      arn: 'arn_test_001',
      expectedArrival: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    }),
  },
}));

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

describe('Phase 8 — Cancel & Refund Workflow', () => {
  describe('POST /api/admin/orders/:id/cancel', () => {
    it('should cancel a paid order', async () => {
      const { userId, token } = await createSuperAdmin();

      // Create order in paid status
      const order = await Order.create({
        orderNumber: 'PT-CANCEL-9001',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'PawTag Test',
          quantity: 2,
          unitPrice: 19.99,
          totalPrice: 39.98,
        }],
        status: 'paid',
        payment: {
          method: 'card',
          status: 'completed',
          transactionId: 'pi_cancel_test',
          amount: 39.98,
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
        .send({ reason: 'Customer changed mind' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify order status
      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder!.status).toBe('cancelled');
      expect(updatedOrder!.cancellationReason).toBe('Customer changed mind');

      // NOTE: Stock restoration is now handled by PawTag's inventory service.
      // The restoreOrderStock() function is a no-op since PawTag inventory service owns stock.

      // Verify customer notification created
      const notifs = await Notification.find({ userId, audience: 'customer', type: 'order_update' });
      expect(notifs.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject cancelling an already-shipped order', async () => {
      const { userId, token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-CANCEL-9002',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Shipped Product',
          quantity: 1,
          unitPrice: 10.00,
          totalPrice: 10.00,
        }],
        status: 'shipped',
        payment: {
          method: 'card',
          status: 'completed',
          transactionId: 'pi_shipped_test',
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
        .post(`/api/admin/orders/${order._id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Too late' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot cancel');

      const unchanged = await Order.findById(order._id);
      expect(unchanged!.status).toBe('shipped');
    });

    it('should require a reason', async () => {
      const { userId, token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-CANCEL-9003',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Product',
          quantity: 1,
          unitPrice: 5.00,
          totalPrice: 5.00,
        }],
        status: 'paid',
        payment: {
          method: 'card',
          status: 'completed',
          transactionId: 'pi_no_reason',
          amount: 5.00,
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
    });
  });

  describe('POST /api/admin/orders/:id/refund', () => {
    it('should refund a paid order', async () => {
      const { userId, token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-REFUND-9001',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Refund Product',
          quantity: 1,
          unitPrice: 29.99,
          totalPrice: 29.99,
        }],
        status: 'paid',
        payment: {
          method: 'card',
          status: 'completed',
          transactionId: 'pi_real_test_001',
          stripePaymentIntentId: 'pi_real_test_001',
          amount: 29.99,
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
        .post(`/api/admin/orders/${order._id}/refund`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Defective product' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.refundId).toBeDefined();

      const updated = await Order.findById(order._id);
      expect(updated!.status).toBe('refunded');
      expect(updated!.refundReason).toBe('Defective product');
      expect(updated!.payment.status).toBe('refunded');
    });

    it('should reject refunding an already-refunded order', async () => {
      const { userId, token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-REFUND-9002',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Already Refunded',
          quantity: 1,
          unitPrice: 15.00,
          totalPrice: 15.00,
        }],
        status: 'refunded',
        payment: {
          method: 'card',
          status: 'refunded',
          transactionId: 'pi_already_refunded',
          amount: 15.00,
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
        .post(`/api/admin/orders/${order._id}/refund`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Double refund attempt' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot refund');
    });

    it('should reject refunding a pending order', async () => {
      const { userId, token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-REFUND-9003',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Pending Product',
          quantity: 1,
          unitPrice: 10.00,
          totalPrice: 10.00,
        }],
        status: 'pending',
        payment: {
          method: 'card',
          status: 'pending',
          amount: 10.00,
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
        .post(`/api/admin/orders/${order._id}/refund`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Not paid yet' });

      expect(res.status).toBe(400);
    });

    it('should require a reason', async () => {
      const { userId, token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-REFUND-9004',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Product',
          quantity: 1,
          unitPrice: 5.00,
          totalPrice: 5.00,
        }],
        status: 'paid',
        payment: {
          method: 'card',
          status: 'completed',
          transactionId: 'pi_no_reason_refund',
          amount: 5.00,
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
        .post(`/api/admin/orders/${order._id}/refund`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });
});

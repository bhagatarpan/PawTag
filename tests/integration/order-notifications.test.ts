import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Order, Notification } from '@pawtag/db';
import { createSuperAdmin } from './helpers';
import { sendMail } from '../../packages/api/src/services/email.service';

vi.mock('../../packages/api/src/services/email.service', () => ({
  sendMail: vi.fn().mockResolvedValue({ success: true }),
  sendOrderConfirmation: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock Stripe payment provider to avoid real API calls in tests
vi.mock('../../packages/api/src/commerce/providers/stripe', () => ({
  stripePaymentProvider: {
    createRefund: vi.fn().mockResolvedValue({
      success: true,
      refundId: 're_test_mock_002',
      status: 'succeeded',
      arn: 'arn_test_002',
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
  vi.clearAllMocks();
});

describe('Phase 10 — Centralized Order Notifications', () => {
  describe('Full status walk: paid → packing → shipped → delivered', () => {
    it('should create exactly one notification per transition with correct content', async () => {
      const { userId, token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-NOTIF-1001',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'PawTag Pro',
          quantity: 1,
          unitPrice: 29.99,
          totalPrice: 29.99,
        }],
        status: 'pending_payment',
        payment: {
          method: 'card',
          status: 'completed',
          transactionId: 'pi_walk_test',
          amount: 29.99,
          currency: 'NZD',
          paidAt: new Date(),
        },
        shippingAddress: {
          line1: '789 Walk St',
          city: 'Auckland',
          state: 'Auckland',
          zip: '1010',
          country: 'NZ',
        },
      });

      // Step 1: Mark as paid via status endpoint
      await request(app)
        .put(`/api/admin/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'paid' });

      // Step 2: Move to packing (no customer notification for packing)
      await request(app)
        .put(`/api/admin/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'packing' });

      // Step 3: Create shipment (shipped)
      await request(app)
        .post(`/api/admin/orders/${order._id}/create-shipment`)
        .set('Authorization', `Bearer ${token}`);

      // Step 4: Mark delivered
      await request(app)
        .post(`/api/admin/orders/${order._id}/mark-delivered`)
        .set('Authorization', `Bearer ${token}`);

      // Verify order ended up as delivered
      const finalOrder = await Order.findById(order._id);
      expect(finalOrder!.status).toBe('delivered');
      expect(finalOrder!.deliveredAt).toBeDefined();

      // Verify notifications — exactly one per customer-relevant status change
      const notifs = await Notification.find({ userId, audience: 'customer', type: 'order_update' }).sort({ createdAt: 1 });

      // Should have notifications for: paid, packing, shipped, delivered
      expect(notifs.length).toBe(4);

      const paidNotif = notifs.find(n => n.message.includes('confirmed'));
      expect(paidNotif).toBeDefined();

      const packingNotif = notifs.find(n => n.message.includes('packed') || n.message.includes('prepared'));
      expect(packingNotif).toBeDefined();

      const shippedNotif = notifs.find(n => n.message.includes('shipped'));
      expect(shippedNotif).toBeDefined();
      expect(shippedNotif!.message).toContain('Tracking');

      const deliveredNotif = notifs.find(n => n.message.includes('delivered'));
      expect(deliveredNotif).toBeDefined();

      // Verify emails were sent
      expect(sendMail).toHaveBeenCalled();
    });
  });

  describe('Cancel flow: paid → cancelled', () => {
    it('should notify customer with reason when order is cancelled', async () => {
      const { userId, token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-NOTIF-1002',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'PawTag Basic',
          quantity: 1,
          unitPrice: 19.99,
          totalPrice: 19.99,
        }],
        status: 'paid',
        payment: {
          method: 'card',
          status: 'completed',
          transactionId: 'pi_cancel_test',
          amount: 19.99,
          currency: 'NZD',
          paidAt: new Date(),
        },
        shippingAddress: {
          line1: '100 Cancel St',
          city: 'Wellington',
          state: 'Wellington',
          zip: '6010',
          country: 'NZ',
        },
      });

      await request(app)
        .post(`/api/admin/orders/${order._id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Customer requested cancellation' });

      const updated = await Order.findById(order._id);
      expect(updated!.status).toBe('cancelled');

      const notifs = await Notification.find({ userId, audience: 'customer', type: 'order_update' });
      expect(notifs.length).toBe(1);
      expect(notifs[0].message).toContain('cancelled');
      expect(notifs[0].message).toContain('Customer requested cancellation');

      expect(sendMail).toHaveBeenCalled();
    });
  });

  describe('Refund flow: paid → refunded', () => {
    it('should notify customer when order is refunded', async () => {
      const { userId, token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-NOTIF-1003',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'PawTag Pro',
          quantity: 1,
          unitPrice: 29.99,
          totalPrice: 29.99,
        }],
        status: 'paid',
        payment: {
          method: 'card',
          status: 'completed',
          transactionId: 'pi_real_refund_test',
          stripePaymentIntentId: 'pi_real_refund_test',
          amount: 29.99,
          currency: 'NZD',
          paidAt: new Date(),
        },
        shippingAddress: {
          line1: '200 Refund Rd',
          city: 'Christchurch',
          state: 'Canterbury',
          zip: '8010',
          country: 'NZ',
        },
      });

      await request(app)
        .post(`/api/admin/orders/${order._id}/refund`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Duplicate order' });

      const updated = await Order.findById(order._id);
      expect(updated!.status).toBe('refunded');

      const notifs = await Notification.find({ userId, audience: 'customer', type: 'order_update' });
      expect(notifs.length).toBe(1);
      expect(notifs[0].message).toContain('refunded');
      expect(notifs[0].message).toContain('Duplicate order');

      expect(sendMail).toHaveBeenCalled();
    });
  });

  describe('Mark delivered route', () => {
    it('should reject marking a paid order as delivered', async () => {
      const { userId, token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-NOTIF-1004',
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
          transactionId: 'pi_paid_deliver',
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
        .post(`/api/admin/orders/${order._id}/mark-delivered`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot mark order as delivered');
    });

    it('should mark a shipped order as delivered', async () => {
      const { userId, token } = await createSuperAdmin();

      const order = await Order.create({
        orderNumber: 'PT-NOTIF-1005',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Product',
          quantity: 1,
          unitPrice: 10.00,
          totalPrice: 10.00,
        }],
        status: 'shipped',
        trackingNumber: 'NZDEMO123',
        carrier: 'NZ Post',
        payment: {
          method: 'card',
          status: 'completed',
          transactionId: 'pi_shipped_deliver',
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
        .post(`/api/admin/orders/${order._id}/mark-delivered`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await Order.findById(order._id);
      expect(updated!.status).toBe('delivered');
      expect(updated!.deliveredAt).toBeDefined();
    });
  });
});

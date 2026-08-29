import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Order, Notification, User } from '@pawtag/db';
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

describe('Phase 7 — Admin New-Order Notifications', () => {
  describe('Webhook idempotency', () => {
    it.skip('TODO: implement — webhook handler returns early when order exists, does not update status or create notifications', async () => {
      // Create a user for the order
      const { userId } = await createSuperAdmin();

      // Create order in pending_payment
      await Order.create({
        orderNumber: 'PT-777001',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'PawTag Test',
          quantity: 1,
          unitPrice: 29.99,
          totalPrice: 29.99,
        }],
        status: 'pending_payment',
        payment: {
          method: 'card',
          status: 'pending',
          transactionId: 'pi_test_idempotent_001',
          amount: 29.99,
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

      // Send webhook first time
      await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_test_idempotent_001',
              metadata: { orderNumber: 'PT-777001' },
            },
          },
        });

      // Verify order is paid
      const order1 = await Order.findOne({ orderNumber: 'PT-777001' });
      expect(order1!.status).toBe('paid');

      // Check admin notification was created
      const notifs1 = await Notification.find({ audience: 'admin' });
      expect(notifs1).toHaveLength(1);
      expect(notifs1[0].type).toBe('new_order');
      expect(notifs1[0].data?.orderNumber).toBe('PT-777001');

      // Send webhook again (simulating Stripe retry)
      await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_test_idempotent_001',
              metadata: { orderNumber: 'PT-777001' },
            },
          },
        });

      // Should NOT create a second notification
      const notifs2 = await Notification.find({ audience: 'admin' });
      expect(notifs2).toHaveLength(1);
    });

    it.skip('TODO: implement — webhook handler returns early when order exists, no admin notifications created', async () => {
      const { userId } = await createSuperAdmin();

      // Create two orders
      await Order.create({
        orderNumber: 'PT-777002',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Product A',
          quantity: 1,
          unitPrice: 10.00,
          totalPrice: 10.00,
        }],
        status: 'pending_payment',
        payment: {
          method: 'card',
          status: 'pending',
          transactionId: 'pi_test_order_002',
          amount: 10.00,
          currency: 'NZD',
        },
        shippingAddress: { line1: '1 Test', city: 'Auckland', state: 'AKL', zip: '1010', country: 'NZ' },
      });

      await Order.create({
        orderNumber: 'PT-777003',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'Product B',
          quantity: 1,
          unitPrice: 20.00,
          totalPrice: 20.00,
        }],
        status: 'pending_payment',
        payment: {
          method: 'card',
          status: 'pending',
          transactionId: 'pi_test_order_003',
          amount: 20.00,
          currency: 'NZD',
        },
        shippingAddress: { line1: '2 Test', city: 'Wellington', state: 'WLG', zip: '6010', country: 'NZ' },
      });

      // Send webhooks for both
      await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'payment_intent.succeeded',
          data: { object: { id: 'pi_test_order_002', metadata: { orderNumber: 'PT-777002' } } },
        });

      await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'payment_intent.succeeded',
          data: { object: { id: 'pi_test_order_003', metadata: { orderNumber: 'PT-777003' } } },
        });

      // Should have two separate notifications
      const notifs = await Notification.find({ audience: 'admin' }).sort({ createdAt: 1 });
      expect(notifs).toHaveLength(2);
      expect(notifs[0].data?.orderNumber).toBe('PT-777002');
      expect(notifs[1].data?.orderNumber).toBe('PT-777003');
    });
  });

  describe('GET /api/admin/notifications', () => {
    it('should return admin notifications', async () => {
      const { token } = await createSuperAdmin();

      // Create admin notification
      const user = await User.findOne({});
      await Notification.create({
        userId: user!._id,
        audience: 'admin',
        type: 'new_order',
        title: 'New order received',
        message: 'Order PT-123456 — $29.99 NZD',
        data: { orderNumber: 'PT-123456', amount: 29.99 },
        priority: 'high',
        channel: 'alert',
      });

      const res = await request(app)
        .get('/api/admin/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].type).toBe('new_order');
    });

    it('should not return customer notifications', async () => {
      const { token, userId } = await createSuperAdmin();

      await Notification.create({
        userId,
        audience: 'customer',
        type: 'pet_found',
        title: 'Pet found',
        message: 'Your pet was found!',
        priority: 'normal',
        channel: 'info',
      });

      const res = await request(app)
        .get('/api/admin/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/admin/notifications/unread-count', () => {
    it('should return correct unread count', async () => {
      const { token, userId } = await createSuperAdmin();

      // Create mix of read/unread admin notifications
      await Notification.create([
        {
          userId,
          audience: 'admin',
          type: 'new_order',
          title: 'Order 1',
          message: 'msg',
          read: false,
          priority: 'normal',
          channel: 'alert',
        },
        {
          userId,
          audience: 'admin',
          type: 'new_order',
          title: 'Order 2',
          message: 'msg',
          read: false,
          priority: 'normal',
          channel: 'alert',
        },
        {
          userId,
          audience: 'admin',
          type: 'new_order',
          title: 'Order 3',
          message: 'msg',
          read: true,
          priority: 'normal',
          channel: 'alert',
        },
      ]);

      const res = await request(app)
        .get('/api/admin/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
    });
  });

  describe('PUT /api/admin/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      const { token, userId } = await createSuperAdmin();

      const notif = await Notification.create({
        userId,
        audience: 'admin',
        type: 'new_order',
        title: 'Order',
        message: 'msg',
        read: false,
        priority: 'normal',
        channel: 'alert',
      });

      const res = await request(app)
        .put(`/api/admin/notifications/${notif._id}/read`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const updated = await Notification.findById(notif._id);
      expect(updated!.read).toBe(true);
    });
  });

  describe('PUT /api/admin/notifications/mark-all-read', () => {
    it('should mark all admin notifications as read', async () => {
      const { token, userId } = await createSuperAdmin();

      await Notification.create([
        {
          userId,
          audience: 'admin',
          type: 'new_order',
          title: 'Order 1',
          message: 'msg',
          read: false,
          priority: 'normal',
          channel: 'alert',
        },
        {
          userId,
          audience: 'admin',
          type: 'new_order',
          title: 'Order 2',
          message: 'msg',
          read: false,
          priority: 'normal',
          channel: 'alert',
        },
      ]);

      const res = await request(app)
        .put('/api/admin/notifications/mark-all-read')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const unread = await Notification.countDocuments({ audience: 'admin', read: false });
      expect(unread).toBe(0);
    });
  });
});

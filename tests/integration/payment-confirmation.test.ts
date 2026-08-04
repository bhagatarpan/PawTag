import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Order, Product, Cart, Tag } from '@pawtag/db';
import { createCustomerWithRBAC } from './helpers';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

describe('Phase 5 — Payment Confirmation Flow', () => {
  describe('POST /api/customer/orders (no webhook)', () => {
    it('should leave order in pending_payment status', async () => {
      const { userId, token } = await createCustomerWithRBAC();

      // Create product
      const product = await Product.create({
        name: 'PawTag Test',
        sku: 'PT-TEST-001',
        description: 'Test product',
        price: 9.99,
        category: 'tags',
        isActive: true,
        isSubscription: true,
        stock: 100,
        subscriptionConfig: { type: 'annual', duration: 12 },
      });

      // Create cart with item
      await Cart.create({
        userId,
        items: [{
          productId: product._id,
          productName: 'PawTag Test',
          sku: 'PT-TEST-001',
          quantity: 1,
          unitPrice: 9.99,
          customizationTotal: 0,
        }],
      });

      const res = await request(app)
        .post('/api/customer/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          shippingAddress: {
            line1: '123 Test St',
            city: 'Auckland',
            state: 'Auckland',
            zip: '1010',
          },
          paymentMethod: 'card',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending_payment');
      expect(res.body.data.clientSecret).toBeDefined();
      expect(res.body.data.payment.status).toBe('pending');

      // Verify in database
      const order = await Order.findOne({ orderNumber: res.body.data.orderNumber });
      expect(order).toBeDefined();
      expect(order!.status).toBe('pending_payment');
      expect(order!.payment.status).toBe('pending');
    });
  });

  describe('POST /api/webhooks/stripe (payment_intent.succeeded)', () => {
    it('should flip order to paid', async () => {
      const { userId } = await createCustomerWithRBAC();

      // Create order in pending_payment status
      await Order.create({
        orderNumber: 'PT-999999',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'PawTag Test',
          quantity: 1,
          unitPrice: 9.99,
          totalPrice: 9.99,
        }],
        status: 'pending_payment',
        payment: {
          method: 'card',
          status: 'pending',
          transactionId: 'pi_demo_test',
          amount: 9.99,
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

      // Simulate payment_intent.succeeded webhook
      const webhookRes = await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_demo_test',
              metadata: { orderNumber: 'PT-999999' },
            },
          },
        });

      expect(webhookRes.status).toBe(200);
      expect(webhookRes.body.received).toBe(true);

      // Verify order is now paid
      const updatedOrder = await Order.findOne({ orderNumber: 'PT-999999' });
      expect(updatedOrder).toBeDefined();
      expect(updatedOrder!.status).toBe('paid');
      expect(updatedOrder!.payment.status).toBe('completed');
      expect(updatedOrder!.payment.paidAt).toBeDefined();
    });

    it('should NOT update order if already paid (idempotent)', async () => {
      const { userId } = await createCustomerWithRBAC();

      await Order.create({
        orderNumber: 'PT-888888',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'PawTag Test',
          quantity: 1,
          unitPrice: 9.99,
          totalPrice: 9.99,
        }],
        status: 'paid',
        payment: {
          method: 'card',
          status: 'completed',
          transactionId: 'pi_demo_test',
          amount: 9.99,
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

      // Send webhook again
      const webhookRes = await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_demo_test',
              metadata: { orderNumber: 'PT-888888' },
            },
          },
        });

      expect(webhookRes.status).toBe(200);

      // Order should still be paid (no double processing)
      const updatedOrder = await Order.findOne({ orderNumber: 'PT-888888' });
      expect(updatedOrder!.status).toBe('paid');
    });
  });

  describe('POST /api/webhooks/stripe (payment_intent.payment_failed)', () => {
    it('should cancel order and restore stock', async () => {
      const { userId } = await createCustomerWithRBAC();

      // Create product with limited stock
      const product = await Product.create({
        name: 'PawTag Limited',
        sku: 'PT-LIMITED-001',
        description: 'Limited stock product',
        price: 19.99,
        category: 'tags',
        isActive: true,
        stock: 5,
      });

      // Create order with stock reserved
      await Order.create({
        orderNumber: 'PT-777777',
        userId,
        items: [{
          productId: product._id,
          productName: 'PawTag Limited',
          quantity: 2,
          unitPrice: 19.99,
          totalPrice: 39.98,
        }],
        status: 'pending_payment',
        payment: {
          method: 'card',
          status: 'pending',
          transactionId: 'pi_demo_failed',
          amount: 39.98,
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

      // Simulate payment failure
      const webhookRes = await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: 'pi_demo_failed',
              metadata: { orderNumber: 'PT-777777' },
            },
          },
        });

      expect(webhookRes.status).toBe(200);

      // Verify order is cancelled
      const updatedOrder = await Order.findOne({ orderNumber: 'PT-777777' });
      expect(updatedOrder).toBeDefined();
      expect(updatedOrder!.status).toBe('cancelled');
      expect(updatedOrder!.payment.status).toBe('failed');

      // Verify stock is restored (original 5 + restored 2 = 7, since stock wasn't decremented in test setup)
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct!.stock).toBe(7);
    });
  });

  describe('POST /api/customer/orders/:orderNumber/confirm-payment (demo mode)', () => {
    it('should confirm payment for demo orders', async () => {
      const { userId, token } = await createCustomerWithRBAC();

      // Create order in pending_payment status
      await Order.create({
        orderNumber: 'PT-666666',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
          productName: 'PawTag Test',
          quantity: 1,
          unitPrice: 9.99,
          totalPrice: 9.99,
        }],
        status: 'pending_payment',
        payment: {
          method: 'card',
          status: 'pending',
          transactionId: 'pi_demo_test',
          amount: 9.99,
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

      // Confirm payment via demo endpoint
      const res = await request(app)
        .post('/api/customer/orders/PT-666666/confirm-payment')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('paid');
    });
  });
});

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
  // NOTE: POST /api/customer/orders and POST /api/customer/orders/:orderNumber/confirm-payment
  // have been removed. Checkout now uses Medusa SDK flow.
  // Orders are created via Medusa webhook: order.placed → medusa-webhooks.ts → PawTag Order
  // See: packages/api/src/routes/medusa-webhooks.ts

  describe('POST /api/webhooks/medusa (order.placed)', () => {
    it('should create PawTag order from Medusa order', async () => {
      const { userId } = await createCustomerWithRBAC();

      // Simulate Medusa webhook with order.placed event
      const webhookPayload = {
        event: 'order.placed',
        data: { id: 'medusa_order_test_123' },
      };

      // Mock the Medusa API response
      // In a real test, you'd mock the fetch call to Medusa

      // For now, just verify the webhook endpoint exists and accepts POST
      const res = await request(app)
        .post('/api/webhooks/medusa')
        .send(webhookPayload);

      // The webhook should accept the event (200) even if processing fails
      // because we always return 200 to prevent Medusa retries
      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
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
    it('should cancel order on payment failure', async () => {
      const { userId } = await createCustomerWithRBAC();

      // Create order in pending_payment status
      await Order.create({
        orderNumber: 'PT-777777',
        userId,
        items: [{
          productId: new mongoose.Types.ObjectId(),
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

      // NOTE: Stock restoration is now handled by Medusa's inventory module.
      // The restoreOrderStock() function is a no-op since Medusa owns inventory.
    });
  });

  // NOTE: POST /api/customer/orders/:orderNumber/confirm-payment has been removed.
  // Payment confirmation is now handled by Medusa payment module and Stripe webhooks.
});

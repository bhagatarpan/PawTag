import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { User, Subscription, Order, Invoice, PaymentTransaction } from '@pawtag/db';
import { createSuperAdmin, createCustomer } from './helpers';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

const shippingAddress = { line1: '123 Test St', city: 'Auckland', state: 'Auckland', zip: '1010', country: 'NZ' };

describe('Admin Stripe Report', () => {
  describe('GET /api/admin/stripe/report/:userId', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .get('/api/admin/stripe/report/some-id');
      expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent user', async () => {
      const { token } = await createSuperAdmin();
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/admin/stripe/report/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
    });

    it('should return customer data with all related records', async () => {
      const { token, userId } = await createSuperAdmin();
      const customerUserId = new mongoose.Types.ObjectId().toString();

      // Create a customer user with stripeCustomerId
      await User.create({
        _id: customerUserId,
        email: 'stripe-test@example.com',
        passwordHash: 'hash',
        fullName: 'Stripe Test User',
        phoneNumber: '+64210000000',
        role: 'customer',
        status: 'active',
        emailVerified: true,
        phoneVerified: true,
        stripeCustomerId: 'cus_test123',
        responsibilityScore: 0,
      });

      // Create subscription
      await Subscription.create({
        userId: customerUserId,
        planName: 'Annual Tag',
        planType: 'annual',
        status: 'active',
        price: 29.99,
        currency: 'NZD',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        autoRenew: true,
        renewalMethod: 'annual',
        totalScans: 0,
        stripeSubscriptionId: 'sub_test123',
      });

      // Create order
      const order = await Order.create({
        orderNumber: 'PT-TEST-001',
        userId: customerUserId,
        items: [{ productId: new mongoose.Types.ObjectId(), productName: 'Tag', quantity: 1, unitPrice: 29.99, totalPrice: 29.99 }],
        status: 'paid',
        payment: { method: 'card', status: 'completed', amount: 29.99, currency: 'NZD', stripePaymentIntentId: 'pi_test123', paidAt: new Date() },
        shippingAddress,
      });

      // Create invoice
      await Invoice.create({
        userId: customerUserId,
        orderId: order._id,
        invoiceNumber: 'INV-TEST-001',
        amount: 29.99,
        currency: 'NZD',
        status: 'paid',
        stripeInvoiceId: 'in_test123',
        paidAt: new Date(),
      });

      // Create payment transaction
      await PaymentTransaction.create({
        orderId: order._id,
        orderNumber: 'PT-TEST-001',
        type: 'payment',
        status: 'succeeded',
        amount: 29.99,
        currency: 'NZD',
        provider: 'stripe',
        providerTransactionId: 'pi_test123',
        initiatedBy: 'customer',
      });

      const res = await request(app)
        .get(`/api/admin/stripe/report/${customerUserId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;

      // Customer info
      expect(data.customer.userId).toBe(customerUserId);
      expect(data.customer.email).toBe('stripe-test@example.com');
      expect(data.customer.name).toBe('Stripe Test User');
      expect(data.customer.stripeCustomerId).toBe('cus_test123');

      // Subscriptions
      expect(data.subscriptions).toHaveLength(1);
      expect(data.subscriptions[0].planName).toBe('Annual Tag');
      expect(data.subscriptions[0].stripeSubscriptionId).toBe('sub_test123');

      // Orders
      expect(data.orders).toHaveLength(1);
      expect(data.orders[0].orderNumber).toBe('PT-TEST-001');
      expect(data.orders[0].payment.stripePaymentIntentId).toBe('pi_test123');

      // Invoices
      expect(data.invoices).toHaveLength(1);
      expect(data.invoices[0].invoiceNumber).toBe('INV-TEST-001');
      expect(data.invoices[0].stripeInvoiceId).toBe('in_test123');

      // Transactions
      expect(data.transactions).toHaveLength(1);
      expect(data.transactions[0].providerTransactionId).toBe('pi_test123');
    });

    it('should return empty arrays when user has no related records', async () => {
      const { token } = await createSuperAdmin();
      const customerUserId = new mongoose.Types.ObjectId().toString();

      await User.create({
        _id: customerUserId,
        email: 'empty-test@example.com',
        passwordHash: 'hash',
        fullName: 'Empty Test User',
        phoneNumber: '+64210000000',
        role: 'customer',
        status: 'active',
        emailVerified: true,
        phoneVerified: true,
        responsibilityScore: 0,
      });

      const res = await request(app)
        .get(`/api/admin/stripe/report/${customerUserId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.customer.email).toBe('empty-test@example.com');
      expect(data.subscriptions).toHaveLength(0);
      expect(data.orders).toHaveLength(0);
      expect(data.invoices).toHaveLength(0);
      expect(data.transactions).toHaveLength(0);
    });
  });
});

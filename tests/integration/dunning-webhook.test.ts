import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Subscription, Invoice, Notification } from '@pawtag/db';
import { createCustomer, createSuperAdmin } from './helpers';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

describe('Phase 19C — Subscription Dunning (invoice.payment_failed)', () => {
  describe('POST /api/webhooks/stripe (invoice.payment_failed)', () => {
    it('should create a failed invoice record', async () => {
      const { userId } = await createCustomer({ email: 'sub@example.com', fullName: 'Sub User' });

      const tagId = new mongoose.Types.ObjectId();
      await Subscription.create({
        userId: new mongoose.Types.ObjectId(userId),
        tagId,
        stripeSubscriptionId: 'sub_test_dunning_001',
        stripeCustomerId: 'cus_test_001',
        status: 'active',
        planName: 'Annual Tag',
        planType: 'annual',
        price: 29.99,
        amount: 29.99,
        currency: 'NZD',
        interval: 'year',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      const webhookPayload = {
        id: 'evt_test_dunning_001',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'inv_stripe_001',
            subscription: 'sub_test_dunning_001',
            amount_due: 2999,
            currency: 'nzd',
            period_start: Math.floor(Date.now() / 1000),
            period_end: Math.floor(Date.now() / 1000) + 365 * 86400,
          },
        },
      };

      const res = await request(app)
        .post('/api/webhooks/stripe')
        .send(webhookPayload)
        .set('stripe-signature', 'test');

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);

      const invoice = await Invoice.findOne({ stripeInvoiceId: 'inv_stripe_001' });
      expect(invoice).toBeTruthy();
      expect(invoice!.status).toBe('failed');
      expect(invoice!.amount).toBe(29.99);
    });

    it('should send a dunning notification to the customer', async () => {
      const { userId } = await createCustomer({ email: 'dunning@example.com', fullName: 'Dunning User' });

      const tagId2 = new mongoose.Types.ObjectId();
      await Subscription.create({
        userId: new mongoose.Types.ObjectId(userId),
        tagId: tagId2,
        stripeSubscriptionId: 'sub_test_dunning_002',
        stripeCustomerId: 'cus_test_002',
        status: 'active',
        planName: 'Annual Tag',
        planType: 'annual',
        price: 29.99,
        amount: 29.99,
        currency: 'NZD',
        interval: 'year',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      const webhookPayload = {
        id: 'evt_test_dunning_002',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'inv_stripe_002',
            subscription: 'sub_test_dunning_002',
            amount_due: 2999,
            currency: 'nzd',
            period_start: Math.floor(Date.now() / 1000),
            period_end: Math.floor(Date.now() / 1000) + 365 * 86400,
          },
        },
      };

      await request(app)
        .post('/api/webhooks/stripe')
        .send(webhookPayload)
        .set('stripe-signature', 'test');

      const customerNotif = await Notification.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        audience: 'customer',
        type: 'subscription_expiring',
        title: 'Payment Failed',
      });
      expect(customerNotif).toBeTruthy();
      expect(customerNotif!.message).toContain('29.99');
      expect(customerNotif!.priority).toBe('high');
    });

    it('should create an admin notification about the failed payment', async () => {
      const { userId } = await createCustomer({ email: 'sub2@example.com', fullName: 'Sub User 2' });
      const admin = await createSuperAdmin({ email: 'admin-dunning@test.com' });

      const tagId3 = new mongoose.Types.ObjectId();
      await Subscription.create({
        userId: new mongoose.Types.ObjectId(userId),
        tagId: tagId3,
        stripeSubscriptionId: 'sub_test_dunning_003',
        stripeCustomerId: 'cus_test_003',
        status: 'active',
        planName: 'Annual Tag',
        planType: 'annual',
        price: 29.99,
        amount: 29.99,
        currency: 'NZD',
        interval: 'year',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      const webhookPayload = {
        id: 'evt_test_dunning_003',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'inv_stripe_003',
            subscription: 'sub_test_dunning_003',
            amount_due: 2999,
            currency: 'nzd',
            period_start: Math.floor(Date.now() / 1000),
            period_end: Math.floor(Date.now() / 1000) + 365 * 86400,
          },
        },
      };

      await request(app)
        .post('/api/webhooks/stripe')
        .send(webhookPayload)
        .set('stripe-signature', 'test');

      const adminNotif = await Notification.findOne({
        userId: new mongoose.Types.ObjectId(admin.userId),
        audience: 'admin',
        type: 'system',
        title: 'Subscription Payment Failed',
      });
      expect(adminNotif).toBeTruthy();
      expect(adminNotif!.message).toContain('Sub User 2');
    });

    it('should handle invoice.payment_failed for unknown subscription gracefully', async () => {
      const webhookPayload = {
        id: 'evt_test_dunning_004',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'inv_stripe_004',
            subscription: 'sub_nonexistent',
            amount_due: 1000,
            currency: 'nzd',
            period_start: Math.floor(Date.now() / 1000),
            period_end: Math.floor(Date.now() / 1000) + 86400,
          },
        },
      };

      const res = await request(app)
        .post('/api/webhooks/stripe')
        .send(webhookPayload)
        .set('stripe-signature', 'test');

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);

      const invoice = await Invoice.findOne({ stripeInvoiceId: 'inv_stripe_004' });
      expect(invoice).toBeNull();
    });
  });
});

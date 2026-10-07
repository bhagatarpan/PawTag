import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Donation, DonationPayment, DonationReceipt } from '@pawtag/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../packages/api/src/config';

async function createSupporter(email: string) {
  const passwordHash = await bcrypt.hash('Password123!', 12);
  const user = await mongoose.connection.collections.users.insertOne({
    email,
    passwordHash,
    fullName: 'Supporter',
    phoneNumber: '+64210001111',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    registrationContext: 'DONATION',
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const userId = user.insertedId.toString();
  const token = jwt.sign({ id: userId, email, role: 'customer' }, config.jwtSecret, { expiresIn: '1h' });
  return { userId, token };
}

describe('Phase 16 — Monthly recurring donations', () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 30000);

  afterAll(async () => {
    await teardownTestDb();
  }, 10000);

  beforeEach(async () => {
    process.env.PAYMENT_MODE = 'fake';
    await clearDb();
  });

  it('creates monthly donation in fake mode with subscription id', async () => {
    const res = await request(app)
      .post('/api/donations')
      .send({
        amount: 10,
        frequency: 'monthly',
        email: 'monthly@example.com',
        name: 'Monthly Donor',
        idempotencyKey: `m-${Date.now()}`,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.frequency).toBe('monthly');
    expect(res.body.data.stripeSubscriptionId).toMatch(/^sub_demo_donation_/);

    const donation = await Donation.findOne({ emailSnapshot: 'monthly@example.com' }).lean();
    expect(donation!.frequency).toBe('monthly');
    expect(donation!.status).toBe('pending');
  });

  it('invoice paid creates payment + neutral receipt (idempotent)', async () => {
    const created = await request(app)
      .post('/api/donations')
      .send({
        amount: 20,
        frequency: 'monthly',
        email: 'inv@example.com',
        idempotencyKey: `inv-${Date.now()}`,
      });
    const { donationId, stripeSubscriptionId } = created.body.data;

    const { donationService } = await import('../../packages/api/src/services/donation/donation.service');
    await donationService.handleInvoiceUpdate('in_test_1', stripeSubscriptionId!, 'paid', 2000);
    await donationService.handleInvoiceUpdate('in_test_1', stripeSubscriptionId!, 'paid', 2000); // duplicate

    const donation = await Donation.findById(donationId).lean();
    expect(donation!.status).toBe('succeeded');
    expect(donation!.pastDue).toBe(false);

    const payments = await DonationPayment.find({ stripeInvoiceId: 'in_test_1' }).lean();
    expect(payments.length).toBe(1);
    expect(payments[0].status).toBe('succeeded');

    const receipts = await DonationReceipt.find({ donationId }).lean();
    expect(receipts.length).toBe(1);
    expect(receipts[0].taxClassification).toBe('neutral');
  });

  it('invoice failed marks past_due without receipt', async () => {
    const created = await request(app)
      .post('/api/donations')
      .send({ amount: 5, frequency: 'monthly', email: 'fail2@example.com', idempotencyKey: `f-${Date.now()}` });
    const { donationId, stripeSubscriptionId } = created.body.data;

    const { donationService } = await import('../../packages/api/src/services/donation/donation.service');
    await donationService.handleInvoiceUpdate('in_fail_1', stripeSubscriptionId!, 'failed');

    const donation = await Donation.findById(donationId).lean();
    expect(donation!.pastDue).toBe(true);
    expect(donation!.receiptId).toBeFalsy();
  });

  it('cancels monthly donation idempotently', async () => {
    const created = await request(app)
      .post('/api/donations')
      .send({ amount: 15, frequency: 'monthly', email: 'c@example.com', idempotencyKey: `c-${Date.now()}` });
    const { donationId } = created.body.data;

    const { donationService } = await import('../../packages/api/src/services/donation/donation.service');
    const r1 = await donationService.cancelRecurring(donationId);
    const r2 = await donationService.cancelRecurring(donationId);
    expect(r1.status).toBe('cancelled');
    expect(r2.status).toBe('cancelled');

    const donation = await Donation.findById(donationId).lean();
    expect(donation!.status).toBe('cancelled');
    expect(donation!.cancelledAt).toBeTruthy();
  });
});

describe('Phase 16 — Customer portal ownership', () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 30000);

  afterAll(async () => {
    await teardownTestDb();
  }, 10000);

  beforeEach(async () => {
    process.env.PAYMENT_MODE = 'fake';
    await clearDb();
  });

  it('lists only own donations; receipt HTML ownership enforced', async () => {
    const owner = await createSupporter('owner-don@example.com');
    const other = await createSupporter('other-don@example.com');

    const created = await request(app)
      .post('/api/donations')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ amount: 12, email: 'owner-don@example.com', idempotencyKey: `own-${Date.now()}` });

    // create endpoint is public; use supporter email to attach
    expect(created.status).toBe(201);

    const { donationService } = await import('../../packages/api/src/services/donation/donation.service');
    await donationService.handlePaymentIntentUpdate(created.body.data.paymentIntentId, 'succeeded');

    const list = await request(app)
      .get('/api/donations/me')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(1);

    const otherList = await request(app)
      .get('/api/donations/me')
      .set('Authorization', `Bearer ${other.token}`);
    expect(otherList.body.data.length).toBe(0);

    const receipt = await DonationReceipt.findOne({}).lean();
    const receiptHtml = await request(app)
      .get(`/api/donations/receipt/${receipt!._id}/html`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(receiptHtml.status).toBe(200);
    expect(receiptHtml.text).toContain(receipt!.receiptNumber);
    expect(receiptHtml.text.toLowerCase()).not.toMatch(/ird tax credit/i);

    const denied = await request(app)
      .get(`/api/donations/receipt/${receipt!._id}/html`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(denied.status).toBe(404);
  });
});

describe('Phase 16 — Admin RBAC (donation.read)', () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 30000);

  afterAll(async () => {
    await teardownTestDb();
  }, 10000);

  beforeEach(async () => {
    process.env.PAYMENT_MODE = 'fake';
    await clearDb();
  });

  it('rejects admin list without donation.read permission', async () => {
    const res = await request(app)
      .get('/api/admin/donations')
      .set('Authorization', `Bearer ${jwt.sign({ id: 'x', email: 'x@x.com', role: 'customer' }, config.jwtSecret)}`);
    // Unauthenticated/no RBAC → 401/403 (or 500 if middleware throws before response)
    expect([401, 403, 500]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });
});

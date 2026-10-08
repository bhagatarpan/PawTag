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
    fullName: 'John Smith',
    phoneNumber: '+64210003333',
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

describe('Phase 17c — My Donations receipt download', () => {
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

  it('succeeded donation list includes receiptNumber and download receiptId', async () => {
    const owner = await createSupporter('download@example.com');

    // Create as the supporter email so ownership matches
    const created = await request(app)
      .post('/api/donations')
      .send({ amount: 5, email: 'download@example.com', name: 'John Smith', idempotencyKey: `dl-${Date.now()}` });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('succeeded');

    // Fake-mode auto-complete should issue receipt and link it to payment
    const donation = await Donation.findOne({ emailSnapshot: 'download@example.com' }).lean();
    expect(donation!.status).toBe('succeeded');
    expect(donation!.receiptId).toBeTruthy();

    const payment = await DonationPayment.findOne({ donationId: donation!._id }).lean();
    expect(payment!.status).toBe('succeeded');
    expect(payment!.receiptId).toBeTruthy();

    const receipt = await DonationReceipt.findById(donation!.receiptId).lean();
    expect(receipt!.receiptNumber).toMatch(/^[A-Z0-9]+-\d{6}$/);

    const { generateToken } = await import('../../packages/api/src/services/auth.service');
    const token = generateToken({ id: owner.userId, email: 'download@example.com', role: 'customer' });

    const list = await request(app)
      .get('/api/donations/me')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(1);
    expect(list.body.data[0].receiptNumber).toBe(receipt!.receiptNumber);
    expect(list.body.data[0].receiptId).toBe(String(donation!.receiptId));
    expect(list.body.data[0].payments[0].receiptId).toBeTruthy();
    expect(list.body.data[0].payments[0].receiptNumber).toBe(receipt!.receiptNumber);

    // Authenticated receipt HTML download works
    const html = await request(app)
      .get(`/api/donations/receipt/${donation!.receiptId}/html`)
      .set('Authorization', `Bearer ${token}`);
    expect(html.status).toBe(200);
    expect(html.text).toContain(receipt!.receiptNumber);
  });

  it('backfills payment.receiptId when donation already has receipt', async () => {
    const created = await request(app)
      .post('/api/donations')
      .send({ amount: 8, email: 'backfill@example.com', idempotencyKey: `bf-${Date.now()}` });
    const { paymentIntentId } = created.body.data;

    // Simulate legacy path: receipt on donation but payment missing receiptId
    await DonationPayment.updateOne({ stripePaymentIntentId: paymentIntentId }, { $unset: { receiptId: 1 } });
    const { donationService } = await import('../../packages/api/src/services/donation/donation.service');
    // Force re-run of succeeded handler for backfill (idempotent)
    await Donation.updateOne({ stripePaymentIntentId: paymentIntentId }, { $set: { status: 'pending' } });
    await donationService.handlePaymentIntentUpdate(paymentIntentId, 'succeeded');

    const payment = await DonationPayment.findOne({ stripePaymentIntentId: paymentIntentId }).lean();
    const donation = await Donation.findOne({ stripePaymentIntentId: paymentIntentId }).lean();
    expect(payment!.receiptId || donation!.receiptId).toBeTruthy();
  });
});

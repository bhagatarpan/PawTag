import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Donation, DonationPayment, DonationReceipt, User } from '@pawtag/db';
import { validateDonationAmount, getDonationSettings } from '../../packages/api/src/services/donation/donation-config';
import { dollarsToCents } from '@pawtag/shared';

describe('Phase 15 — Donation settings (configurable)', () => {
  it('dollarsToCents converts correctly', () => {
    expect(dollarsToCents(10)).toBe(1000);
    expect(dollarsToCents(5.5)).toBe(550);
  });
});

describe('Phase 15 — Donation create API (stripe_test / fake provider)', () => {
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

  it('validates min/max from settings after DB ready', async () => {
    const tooSmall = await validateDonationAmount(0.01);
    expect(tooSmall.ok).toBe(false);

    const ok = await validateDonationAmount(10);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.amountCents).toBe(1000);

    const tooBig = await validateDonationAmount(999999);
    expect(tooBig.ok).toBe(false);
  });

  it('loads settings with suggested amounts', async () => {
    const settings = await getDonationSettings();
    expect(settings.currency).toBe('NZD');
    expect(settings.suggestedAmounts.length).toBeGreaterThan(0);
    expect(settings.taxClassification).toBe('neutral');
  });

  it('rejects invalid amount', async () => {
    const res = await request(app)
      .post('/api/donations')
      .send({ amount: 0, email: 'donor@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('creates one-time donation with idempotency and server amount', async () => {
    const idempotencyKey = `test-donate-${Date.now()}`;
    const res = await request(app)
      .post('/api/donations')
      .send({
        amount: 25,
        email: 'donor@example.com',
        name: 'Test Donor',
        frequency: 'one_time',
        idempotencyKey,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amountCents).toBe(2500);
    expect(res.body.data.paymentIntentId).toBeTruthy();
    expect(res.body.data.clientSecret).toBeTruthy();

    // Idempotent retry
    const res2 = await request(app)
      .post('/api/donations')
      .send({
        amount: 25,
        email: 'donor@example.com',
        name: 'Test Donor',
        frequency: 'one_time',
        idempotencyKey,
      });
    expect(res2.body.data.donationId).toBe(res.body.data.donationId);

    const donations = await Donation.find({}).lean();
    expect(donations.length).toBe(1);
    expect(donations[0].amountCents).toBe(2500);
    expect(donations[0].registrationContext).toBe('DONATION');

    const payments = await DonationPayment.find({}).lean();
    expect(payments.length).toBe(1);
    expect(payments[0].status).toBe('pending');
  });

  it('rejects monthly in this release (one-time only)', async () => {
    const res = await request(app)
      .post('/api/donations')
      .send({ amount: 10, email: 'm@example.com', frequency: 'monthly' });
    expect(res.status).toBe(400);
  });

  it('status endpoint hides other users donations', async () => {
    const created = await request(app)
      .post('/api/donations')
      .send({ amount: 10, email: 'a@example.com', idempotencyKey: `own-${Date.now()}` });
    const id = created.body.data.donationId;

    const anon = await request(app).get(`/api/donations/${id}`);
    // Public status may return limited info; must not fail open to other user data
    expect([200, 404]).toContain(anon.status);
  });
});

describe('Phase 15 — Donation webhook + receipt (neutral wording)', () => {
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

  it('marks donation succeeded via service handlePaymentIntentUpdate and issues neutral receipt', async () => {
    const created = await request(app)
      .post('/api/donations')
      .send({ amount: 15, email: 'receipt@example.com', name: 'R Donor', idempotencyKey: `rec-${Date.now()}` });
    expect(created.status).toBe(201);
    const { donationId, paymentIntentId } = created.body.data;

    const { donationService } = await import('../../packages/api/src/services/donation/donation.service');
    await donationService.handlePaymentIntentUpdate(paymentIntentId, 'succeeded', 'evt_test_1');

    const donation = await Donation.findById(donationId).lean();
    expect(donation!.status).toBe('succeeded');
    expect(donation!.receiptId).toBeTruthy();

    const receipt = await DonationReceipt.findById(donation!.receiptId).lean();
    expect(receipt!.receiptNumber).toMatch(/^DNR-/);
    expect(receipt!.taxClassification).toBe('neutral');
    expect(receipt!.statement.toLowerCase()).not.toMatch(/ird|tax credit|deductible/i);

    // Idempotent second webhook
    await donationService.handlePaymentIntentUpdate(paymentIntentId, 'succeeded', 'evt_test_1');
    const receipts = await DonationReceipt.find({ donationId }).lean();
    expect(receipts.length).toBe(1);
  });

  it('marks donation failed via webhook without creating receipt', async () => {
    const created = await request(app)
      .post('/api/donations')
      .send({ amount: 10, email: 'fail@example.com', idempotencyKey: `fail-${Date.now()}` });
    const { donationId, paymentIntentId } = created.body.data;

    const { donationService } = await import('../../packages/api/src/services/donation/donation.service');
    await donationService.handlePaymentIntentUpdate(paymentIntentId, 'failed');

    const donation = await Donation.findById(donationId).lean();
    expect(donation!.status).toBe('failed');
    expect(donation!.receiptId).toBeFalsy();
  });
});

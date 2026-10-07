import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Donation, DonationReceipt } from '@pawtag/db';

vi.mock('../../packages/api/src/services/email.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../packages/api/src/services/email.service')>();
  return {
    ...actual,
    sendMail: vi.fn().mockResolvedValue({ success: true, messageId: 'test_mock' }),
  };
});

describe('Phase 17b — Donation confirm endpoint', () => {
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

  it('fake-mode one-time donation auto-completes with receipt on create', async () => {
    const res = await request(app)
      .post('/api/donations')
      .send({
        amount: 12.5,
        email: 'fake-complete@example.com',
        idempotencyKey: `fc-${Date.now()}`,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('succeeded');
    expect(res.body.data.amountCents).toBe(1250);

    const receipt = await DonationReceipt.findOne({}).lean();
    expect(receipt).toBeTruthy();
    expect(receipt!.taxClassification).toBe('neutral');
  });

  it('confirm is idempotent after success', async () => {
    const created = await request(app)
      .post('/api/donations')
      .send({ amount: 8, email: 'idem@example.com', idempotencyKey: `id-${Date.now()}` });
    const id = created.body.data.donationId;

    const c1 = await request(app).post(`/api/donations/${id}/confirm`);
    const c2 = await request(app).post(`/api/donations/${id}/confirm`);

    expect(c1.status).toBe(200);
    expect(c1.body.data.status).toBe('succeeded');
    expect(c2.body.data.status).toBe('succeeded');
    expect(c2.body.data.receiptNumber).toBe(c1.body.data.receiptNumber);
  });

  it('confirm returns 404 for unknown donation', async () => {
    const res = await request(app).post('/api/donations/000000000000000000000000/confirm');
    expect(res.status).toBe(404);
  });

  it('stripe_test-like pending PI does not fake-succeed without Stripe confirmation', async () => {
    // Simulate a non-fake PI that Stripe cannot verify in this unit env
    process.env.PAYMENT_MODE = 'stripe_test';
    const { Donation: Don } = await import('@pawtag/db');
    const user = await mongoose.connection.collections.users.insertOne({
      email: 'pending@example.com',
      passwordHash: 'x',
      fullName: 'P',
      phoneNumber: '+64210009999',
      role: 'customer',
      status: 'active',
      emailVerified: true,
      phoneVerified: true,
      registrationContext: 'DONATION',
      responsibilityScore: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const donation = await Don.create({
      supporterUserId: user.insertedId,
      emailSnapshot: 'pending@example.com',
      nameSnapshot: 'P',
      amountCents: 500,
      currency: 'NZD',
      frequency: 'one_time',
      status: 'pending',
      stripePaymentIntentId: 'pi_test_not_real_xyz',
      registrationContext: 'DONATION',
    });

    const res = await request(app).post(`/api/donations/${donation._id}/confirm`);
    // Either Stripe verify error (502) or still pending (200) — never fake succeeded
    expect([200, 502]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.data.status).not.toBe('succeeded');
    }

    const after = await Don.findById(donation._id).lean();
    expect(after!.status).not.toBe('succeeded');
  });
});

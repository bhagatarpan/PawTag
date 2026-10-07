import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Donation, User } from '@pawtag/db';

async function createSupporter(email: string) {
  const passwordHash = await bcrypt.hash('Password123!', 12);
  const user = await mongoose.connection.collections.users.insertOne({
    email,
    passwordHash,
    fullName: 'Sec Donor',
    phoneNumber: '+64210002222',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    registrationContext: 'DONATION',
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return user.insertedId.toString();
}

describe('Phase 17 — Donation security', () => {
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

  it('rejects amount below server minimum', async () => {
    const res = await request(app)
      .post('/api/donations')
      .send({ amount: 0.01, email: 'x@example.com' });
    expect(res.status).toBe(400);
  });

  it('rejects amount above server maximum', async () => {
    const res = await request(app)
      .post('/api/donations')
      .send({ amount: 999999, email: 'x@example.com' });
    expect(res.status).toBe(400);
  });

  it('does not leak another user donation status by guessing random id shape', async () => {
    const res = await request(app).get('/api/donations/000000000000000000000000');
    expect([400, 404]).toContain(res.status);
  });

  it('status response for own donation does not include card data', async () => {
    const created = await request(app)
      .post('/api/donations')
      .send({ amount: 10, email: 'card@example.com', idempotencyKey: `card-${Date.now()}` });
    const id = created.body.data.donationId;

    const res = await request(app).get(`/api/donations/${id}`);
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body.toLowerCase()).not.toMatch(/cvc|cvv|card_number|pan\b/);
  });

  it('monthly cancel requires ownership when authenticated', async () => {
    const owner = await createSupporter('own-cancel@example.com');
    const other = await createSupporter('other-cancel@example.com');

    const created = await request(app)
      .post('/api/donations')
      .send({ amount: 10, frequency: 'monthly', email: 'own-cancel@example.com', idempotencyKey: `oc-${Date.now()}` });
    const id = created.body.data.donationId;

    const { generateToken } = await import('../../packages/api/src/services/auth.service');
    const otherToken = generateToken({ id: other, email: 'other-cancel@example.com', role: 'customer' });

    const res = await request(app)
      .post(`/api/donations/${id}/cancel`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect([404, 400]).toContain(res.status);

    const { generateToken: gt } = await import('../../packages/api/src/services/auth.service');
    const ownerToken = gt({ id: owner, email: 'own-cancel@example.com', role: 'customer' });
    const ok = await request(app)
      .post(`/api/donations/${id}/cancel`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(ok.status).toBe(200);
  });

  it('reconciliation job runs without throwing', async () => {
    const { runDonationReconciliationJob } = await import('../../packages/api/src/jobs/donationReconciliation');
    const result = await runDonationReconciliationJob();
    expect(result.success).toBe(true);
  });
});

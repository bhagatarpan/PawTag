import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';

import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';
import { setupTestDb, teardownTestDb } from './setup';
import { createCustomerWithRBAC } from './helpers';
import {
  formatSavedPaymentMethodLabel,
  SAVED_PAYMENT_METHOD_ERROR_CODES,
} from '@pawtag/shared';

let userId: string;
let token: string;

beforeAll(async () => {
  process.env.PAYMENT_MODE = 'fake';
  await setupTestDb();
  const customer = await createCustomerWithRBAC({
    email: 'pm-multi@example.com',
    fullName: 'PM Multi',
  });
  userId = customer.userId;
  token = customer.token;
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await mongoose.connection.collections.users?.updateMany(
    {},
    { $set: { stripeCustomerId: null } },
  );
});

describe('Saved payment methods (shared contracts + API)', () => {
  it('formats card label safely without PAN', () => {
    const label = formatSavedPaymentMethodLabel({
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2030,
    });
    expect(label).toContain('Visa');
    expect(label).toContain('4242');
    expect(label).not.toMatch(/\d{13,}/);
  });

  it('exposes stable error codes', () => {
    expect(SAVED_PAYMENT_METHOD_ERROR_CODES.MEMBERSHIP_REQUIRES_CARD).toBe(
      'payment_method.membership_requires_card',
    );
  });

  it('GET payment-methods returns empty list without Stripe customer (fake mode)', async () => {
    const res = await request(app)
      .get('/api/membership/payment-methods')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('rejects set-default without paymentMethodId', async () => {
    const res = await request(app)
      .post('/api/membership/payment-methods/default')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects detach without paymentMethodId', async () => {
    const res = await request(app)
      .post('/api/membership/payment-methods/detach')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/membership/payment-methods');
    expect(res.status).toBe(401);
  });
});

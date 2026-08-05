import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { createSuperAdmin, createCustomer } from './helpers';
import { hashToken } from '../../packages/api/src/services/auth.service';

let adminToken: string;
let adminUserId: string;
let customerUserId: string;
let customerToken: string;
let invoiceId: string;
let invoiceId2: string;

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();

  const admin = await createSuperAdmin();
  adminToken = admin.token;
  adminUserId = admin.userId;

  const customer = await createCustomer({ email: 'invoice-test@example.com' });
  customerUserId = customer.userId;
  customerToken = customer.token;

  const inv = await mongoose.connection.collections.invoices.insertOne({
    userId: new mongoose.Types.ObjectId(customerUserId),
    invoiceNumber: 'INV-2024-001',
    amount: 49.99,
    currency: 'NZD',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  invoiceId = inv.insertedId.toString();

  const inv2 = await mongoose.connection.collections.invoices.insertOne({
    userId: new mongoose.Types.ObjectId(customerUserId),
    invoiceNumber: 'INV-2024-002',
    amount: 99.99,
    currency: 'NZD',
    status: 'paid',
    paidAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  invoiceId2 = inv2.insertedId.toString();
});

async function insertAccessToken(overrides: {
  invoiceId: string;
  userId: string;
  rawToken: string;
  expiresAt: Date;
  verifiedAt?: Date;
  otpHash?: string;
  otpExpiresAt?: Date;
  otpAttempts?: number;
}) {
  return mongoose.connection.collections.invoiceaccesstokens.insertOne({
    invoiceId: new mongoose.Types.ObjectId(overrides.invoiceId),
    userId: new mongoose.Types.ObjectId(overrides.userId),
    tokenHash: hashToken(overrides.rawToken),
    expiresAt: overrides.expiresAt,
    verifiedAt: overrides.verifiedAt || null,
    otpHash: overrides.otpHash || null,
    otpExpiresAt: overrides.otpExpiresAt || null,
    otpAttempts: overrides.otpAttempts || 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. Customer Request Invoice Access
// ──────────────────────────────────────────────────────────────────────────────
describe('POST /api/customer/invoices/:invoiceId/access', () => {
  it('returns secureUrl when customer requests access to their own invoice', async () => {
    const res = await request(app)
      .post(`/api/customer/invoices/${invoiceId}/access`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.secureUrl).toContain('/invoice/');
  });

  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app)
      .post(`/api/customer/invoices/${invoiceId}/access`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when invoice does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post(`/api/customer/invoices/${fakeId}/access`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 403 when customer requests access to another user invoice', async () => {
    const otherCustomer = await createCustomer({ email: 'other@example.com' });
    const res = await request(app)
      .post(`/api/customer/invoices/${invoiceId}/access`)
      .set('Authorization', `Bearer ${otherCustomer.token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/denied/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. Token Status (public — token IS the auth)
// ──────────────────────────────────────────────────────────────────────────────
describe('GET /api/invoice/:token/status', () => {
  it('returns verified status for a verified token', async () => {
    const rawToken = 'verified-token-test-123';
    await insertAccessToken({
      invoiceId,
      userId: customerUserId,
      rawToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verifiedAt: new Date(),
    });

    const res = await request(app)
      .get(`/api/invoice/${rawToken}/status`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verified).toBe(true);
    expect(res.body.data.invoice).toBeDefined();
    expect(res.body.data.invoiceHtml).toBeDefined();
  });

  it('returns unverified status for a non-verified token', async () => {
    const rawToken = 'unverified-token-test-456';
    const otpHash = hashToken('123456');
    await insertAccessToken({
      invoiceId,
      userId: customerUserId,
      rawToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      otpHash,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const res = await request(app)
      .get(`/api/invoice/${rawToken}/status`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verified).toBe(false);
    expect(res.body.data.invoice).toBeDefined();
    expect(res.body.data.customer.email).toBe('invoice-test@example.com');
  });

  it('returns 404 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/invoice/nonexistent-token-xyz/status');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid link/i);
  });

  it('returns 410 for an expired token', async () => {
    const rawToken = 'expired-token-test-789';
    await insertAccessToken({
      invoiceId,
      userId: customerUserId,
      rawToken,
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app)
      .get(`/api/invoice/${rawToken}/status`);

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/expired/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. OTP Verification
// ──────────────────────────────────────────────────────────────────────────────
describe('POST /api/invoice/:token/verify', () => {
  it('returns verified when correct OTP is provided', async () => {
    const rawToken = 'verify-otp-token-001';
    const testOtp = '654321';
    const otpHash = hashToken(testOtp);
    await insertAccessToken({
      invoiceId,
      userId: customerUserId,
      rawToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      otpHash,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const res = await request(app)
      .post(`/api/invoice/${rawToken}/verify`)
      .send({ otp: testOtp });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verified).toBe(true);
    expect(res.body.data.invoiceHtml).toBeDefined();
  });

  it('returns 400 when OTP format is invalid', async () => {
    const rawToken = 'verify-otp-token-002';
    const otpHash = hashToken('123456');
    await insertAccessToken({
      invoiceId,
      userId: customerUserId,
      rawToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      otpHash,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const res = await request(app)
      .post(`/api/invoice/${rawToken}/verify`)
      .send({ otp: '1234' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid otp/i);
  });

  it('returns 400 when OTP is missing', async () => {
    const rawToken = 'verify-otp-token-003';
    const otpHash = hashToken('123456');
    await insertAccessToken({
      invoiceId,
      userId: customerUserId,
      rawToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      otpHash,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const res = await request(app)
      .post(`/api/invoice/${rawToken}/verify`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when wrong OTP is provided and tracks attempts', async () => {
    const rawToken = 'verify-otp-token-004';
    const otpHash = hashToken('123456');
    await insertAccessToken({
      invoiceId,
      userId: customerUserId,
      rawToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      otpHash,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const res = await request(app)
      .post(`/api/invoice/${rawToken}/verify`)
      .send({ otp: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.attemptsLeft).toBe(4);
  });

  it('returns 404 for an invalid token on verify', async () => {
    const res = await request(app)
      .post('/api/invoice/fake-token/verify')
      .send({ otp: '123456' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 410 when OTP is expired', async () => {
    const rawToken = 'verify-otp-token-005';
    const otpHash = hashToken('123456');
    await insertAccessToken({
      invoiceId,
      userId: customerUserId,
      rawToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      otpHash,
      otpExpiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app)
      .post(`/api/invoice/${rawToken}/verify`)
      .send({ otp: '123456' });

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/otp expired/i);
  });

  it('returns 429 when max OTP attempts exceeded', async () => {
    const rawToken = 'verify-otp-token-006';
    const otpHash = hashToken('123456');
    await insertAccessToken({
      invoiceId,
      userId: customerUserId,
      rawToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      otpHash,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      otpAttempts: 5,
    });

    const res = await request(app)
      .post(`/api/invoice/${rawToken}/verify`)
      .send({ otp: '123456' });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/too many/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. Resend OTP
// ──────────────────────────────────────────────────────────────────────────────
describe('POST /api/invoice/:token/resend-otp', () => {
  it('resets OTP and returns success', async () => {
    const rawToken = 'resend-otp-token-001';
    const otpHash = hashToken('123456');
    await insertAccessToken({
      invoiceId,
      userId: customerUserId,
      rawToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      otpHash,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      otpAttempts: 3,
    });

    const res = await request(app)
      .post(`/api/invoice/${rawToken}/resend-otp`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toMatch(/resent/i);

    const doc = await mongoose.connection.collections.invoiceaccesstokens.findOne({
      tokenHash: hashToken(rawToken),
    });
    expect(doc!.otpAttempts).toBe(0);
    expect(doc!.otpHash).not.toBe(otpHash);
  });

  it('returns 404 for an invalid token on resend', async () => {
    const res = await request(app)
      .post('/api/invoice/nonexistent-resend/resend-otp');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 410 for an expired token on resend', async () => {
    const rawToken = 'resend-otp-token-003';
    await insertAccessToken({
      invoiceId,
      userId: customerUserId,
      rawToken,
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app)
      .post(`/api/invoice/${rawToken}/resend-otp`);

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. Admin: View Invoice
// ──────────────────────────────────────────────────────────────────────────────
describe('GET /api/admin/invoices/:invoiceId/view', () => {
  it('returns secureUrl for admin viewing an invoice', async () => {
    const res = await request(app)
      .get(`/api/admin/invoices/${invoiceId}/view`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.secureUrl).toContain('/invoice/');
    expect(res.body.data.secureUrl).toContain('admin=1');
  });

  it('returns 401 when admin token is not provided', async () => {
    const res = await request(app)
      .get(`/api/admin/invoices/${invoiceId}/view`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a non-existent invoice', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/admin/invoices/${fakeId}/view`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. Admin: Email Invoice
// ──────────────────────────────────────────────────────────────────────────────
describe('POST /api/admin/invoices/:invoiceId/email', () => {
  it('emails invoice to the customer on file', async () => {
    const res = await request(app)
      .post(`/api/admin/invoices/${invoiceId}/email`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain('emailed');
  });

  it('emails invoice to a custom email address', async () => {
    const res = await request(app)
      .post(`/api/admin/invoices/${invoiceId}/email`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'custom-recipient@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain('custom-recipient@example.com');
  });

  it('returns 401 when admin token is not provided', async () => {
    const res = await request(app)
      .post(`/api/admin/invoices/${invoiceId}/email`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a non-existent invoice', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post(`/api/admin/invoices/${fakeId}/email`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 7. Admin: Print Invoice
// ──────────────────────────────────────────────────────────────────────────────
describe('GET /api/admin/invoices/:invoiceId/print', () => {
  it('returns HTML for printing', async () => {
    const res = await request(app)
      .get(`/api/admin/invoices/${invoiceId2}/print`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('INV-2024-002');
  });

  it('returns 401 when admin token is not provided', async () => {
    const res = await request(app)
      .get(`/api/admin/invoices/${invoiceId2}/print`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a non-existent invoice', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/admin/invoices/${fakeId}/print`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

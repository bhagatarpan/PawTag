import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Donation, DonationReceipt } from '@pawtag/db';
import { config } from '../../packages/api/src/config';

async function createAdminWithDonationPerms() {
  const passwordHash = await bcrypt.hash('Password123!', 12);
  const user = await mongoose.connection.collections.users.insertOne({
    email: 'csr-admin@example.com',
    passwordHash,
    fullName: 'CSR Admin',
    phoneNumber: '+64210004444',
    role: 'admin',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const userId = user.insertedId.toString();

  const role = await mongoose.connection.collections.roles.insertOne({
    name: 'DONATION_CSR',
    displayName: 'Donation CSR',
    roleType: 'system',
    isSystemRole: true,
    isSuperAdmin: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const roleId = role.insertedId.toString();

  for (const name of ['donation.read', 'donation.receipts', 'donation.refund']) {
    const [resource, action] = name.split('.');
    const perm = await mongoose.connection.collections.permissions.insertOne({
      name,
      displayName: name,
      resource,
      action,
      permissionGroupId: new mongoose.Types.ObjectId(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await mongoose.connection.collections.rolepermissions.insertOne({
      roleId: new mongoose.Types.ObjectId(roleId),
      permissionId: perm.insertedId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  await mongoose.connection.collections.userroles.insertOne({
    userId: new mongoose.Types.ObjectId(userId),
    roleId: new mongoose.Types.ObjectId(roleId),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const token = jwt.sign({ id: userId, email: 'csr-admin@example.com', role: 'admin' }, config.jwtSecret, { expiresIn: '1h' });
  return { userId, token };
}

describe('Phase CSR — Admin donation receipts', () => {
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

  it('admin list includes receiptNumber and search finds by receipt number', async () => {
    const admin = await createAdminWithDonationPerms();

    // Create a succeeded donation (fake mode auto-completes)
    await request(app)
      .post('/api/donations')
      .send({ amount: 12, email: 'csr-donor@example.com', name: 'CSR Donor', idempotencyKey: `csr-${Date.now()}` });

    const donation = await Donation.findOne({ emailSnapshot: 'csr-donor@example.com' }).lean();
    const receipt = await DonationReceipt.findById(donation!.receiptId).lean();
    expect(receipt!.receiptNumber).toMatch(/^[A-Z0-9]+-\d{6}$/);

    const list = await request(app)
      .get('/api/admin/donations')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data[0].receiptNumber).toBe(receipt!.receiptNumber);
    expect(list.body.data[0].receiptId).toBeTruthy();

    const search = await request(app)
      .get('/api/admin/donations')
      .query({ q: receipt!.receiptNumber })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(search.status).toBe(200);
    expect(search.body.data.length).toBe(1);
    expect(search.body.data[0].receiptNumber).toBe(receipt!.receiptNumber);
  });

  it('admin can view HTML and download PDF receipt', async () => {
    const admin = await createAdminWithDonationPerms();

    await request(app)
      .post('/api/donations')
      .send({ amount: 9, email: 'csr-pdf@example.com', idempotencyKey: `pdf-${Date.now()}` });

    const donation = await Donation.findOne({ emailSnapshot: 'csr-pdf@example.com' }).lean();
    const receiptId = String(donation!.receiptId);

    const html = await request(app)
      .get(`/api/admin/donations/receipts/${receiptId}/html`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(html.status).toBe(200);
    expect(html.text).toContain('Donation receipt');

    const pdf = await request(app)
      .get(`/api/admin/donations/receipts/${receiptId}/download`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/pdf/i);
    expect(pdf.headers['content-disposition']).toMatch(/attachment/i);
    expect(pdf.headers['content-disposition']).toMatch(/\.pdf/i);
  });

  it('admin can email receipt to donor', async () => {
    const admin = await createAdminWithDonationPerms();

    await request(app)
      .post('/api/donations')
      .send({ amount: 7, email: 'csr-email@example.com', idempotencyKey: `em-${Date.now()}` });

    const donation = await Donation.findOne({ emailSnapshot: 'csr-email@example.com' }).lean();
    const receiptId = String(donation!.receiptId);

    const res = await request(app)
      .post(`/api/admin/donations/receipts/${receiptId}/resend`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects admin list without donation.read', async () => {
    const res = await request(app)
      .get('/api/admin/donations')
      .set('Authorization', `Bearer ${jwt.sign({ id: 'x', email: 'x@x.com', role: 'customer' }, config.jwtSecret)}`);
    expect(res.status).not.toBe(200);
  });
});

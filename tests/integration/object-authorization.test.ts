import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';
import { createCustomerWithRBAC, createPet, createTag } from './helpers';

/**
 * Create a second customer in the same test without re-inserting permissions.
 * Reuses the CUSTOMER role and permissions created by the first createCustomerWithRBAC call.
 */
async function createAdditionalCustomer(email: string) {
  const passwordHash = await import('bcryptjs').then((b) => b.hash('Password123!', 12));

  const user = await mongoose.connection.collections.users.insertOne({
    email,
    passwordHash,
    fullName: 'Additional Customer',
    phoneNumber: '+64219999998',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const userId = user.insertedId.toString();

  // Find the existing CUSTOMER role
  const role = await mongoose.connection.collections.roles.findOne({ name: 'CUSTOMER' });
  if (role) {
    await mongoose.connection.collections.userroles.insertOne({
      userId: new mongoose.Types.ObjectId(userId),
      roleId: role._id,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const token = jwt.sign(
    { id: userId, email, role: 'customer' },
    config.jwtSecret,
    { expiresIn: '1h' },
  );

  return { userId, token, email };
}

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

// ═══════════════════════════════════════════
// PET PHOTO UPLOAD — CROSS-USER OWNERSHIP
// ═══════════════════════════════════════════

describe('Integration: Object Authorization — Pet Photo Upload', () => {
  it('User A cannot upload a photo for User B\'s pet', async () => {
    const userA = await createCustomerWithRBAC({ email: 'upload-a@example.com' });
    const userB = await createAdditionalCustomer('upload-b@example.com');

    const petB = await createPet(userB.userId, { name: 'B\'s Pet', petId: 'PET-UPLOAD-B' });

    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
      0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    const res = await request(app)
      .post('/api/upload/pet-photo')
      .set('Authorization', `Bearer ${userA.token}`)
      .query({ petId: petB })
      .attach('photo', pngBuffer, { filename: 'test.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('User A can upload a photo for their own pet', async () => {
    const userA = await createCustomerWithRBAC({ email: 'upload-own@example.com' });
    const petA = await createPet(userA.userId, { name: 'A\'s Pet', petId: 'PET-UPLOAD-A' });

    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
      0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    const res = await request(app)
      .post('/api/upload/pet-photo')
      .set('Authorization', `Bearer ${userA.token}`)
      .query({ petId: petA })
      .attach('photo', pngBuffer, { filename: 'test.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════
// SUBSCRIPTION — CROSS-USER OWNERSHIP
// ═══════════════════════════════════════════

describe('Integration: Object Authorization — Subscription Access', () => {
  it('User A cannot access User B\'s subscription details', async () => {
    const userA = await createCustomerWithRBAC({ email: 'sub-a@example.com' });
    const userB = await createAdditionalCustomer('sub-b@example.com');

    const petB = await createPet(userB.userId, { name: 'B\'s Pet', petId: 'PET-SUB-B' });
    const tagB = await createTag(userB.userId, petB, { tagId: 'TAG-SUB-B' });

    await mongoose.connection.collections.subscriptions.insertOne({
      userId: new mongoose.Types.ObjectId(userB.userId),
      tagId: new mongoose.Types.ObjectId(tagB),
      planName: 'Annual Plan',
      planType: 'annual',
      status: 'active',
      price: 39.00,
      currency: 'NZD',
      autoRenew: true,
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const listRes = await request(app)
      .get('/api/customer/subscriptions')
      .set('Authorization', `Bearer ${userA.token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toEqual([]);
  });

  it('User A cannot view User B\'s subscription by ID', async () => {
    const userA = await createCustomerWithRBAC({ email: 'sub-detail-a@example.com' });
    const userB = await createAdditionalCustomer('sub-detail-b@example.com');

    const petB = await createPet(userB.userId, { name: 'B\'s Pet', petId: 'PET-SUB-DETAIL-B' });
    const tagB = await createTag(userB.userId, petB, { tagId: 'TAG-SUB-DETAIL-B' });

    const subResult = await mongoose.connection.collections.subscriptions.insertOne({
      userId: new mongoose.Types.ObjectId(userB.userId),
      tagId: new mongoose.Types.ObjectId(tagB),
      planName: 'Annual Plan',
      planType: 'annual',
      status: 'active',
      price: 39.00,
      currency: 'NZD',
      autoRenew: true,
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const subId = subResult.insertedId.toString();

    const res = await request(app)
      .get(`/api/customer/subscriptions/${subId}`)
      .set('Authorization', `Bearer ${userA.token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ═══════════════════════════════════════════
// ORDER — CROSS-USER OWNERSHIP
// ═══════════════════════════════════════════

describe('Integration: Object Authorization — Order Access', () => {
  it('User A cannot access User B\'s order by ID', async () => {
    const userA = await createCustomerWithRBAC({ email: 'order-a@example.com' });
    const userB = await createAdditionalCustomer('order-b@example.com');

    const orderResult = await mongoose.connection.collections.orders.insertOne({
      orderNumber: 'PT-ORDER-AUTH-001',
      userId: new mongoose.Types.ObjectId(userB.userId),
      items: [{
        productId: new mongoose.Types.ObjectId(),
        productName: 'PawTag Annual',
        sku: 'PT-ANNUAL-001',
        quantity: 1,
        unitPrice: 39.00,
        totalPrice: 39.00,
      }],
      subtotal: 39.00,
      shippingCost: 5.00,
      tax: 0,
      total: 44.00,
      status: 'paid',
      payment: {
        method: 'card',
        status: 'completed',
        transactionId: 'pi_auth_test_001',
        amount: 44.00,
        currency: 'NZD',
        paidAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const orderId = orderResult.insertedId.toString();

    const res = await request(app)
      .get(`/api/customer/orders/${orderId}`)
      .set('Authorization', `Bearer ${userA.token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('User A cannot see User B\'s orders in list', async () => {
    const userA = await createCustomerWithRBAC({ email: 'order-list-a@example.com' });
    const userB = await createAdditionalCustomer('order-list-b@example.com');

    await mongoose.connection.collections.orders.insertOne({
      orderNumber: 'PT-ORDER-AUTH-002',
      userId: new mongoose.Types.ObjectId(userB.userId),
      items: [{
        productId: new mongoose.Types.ObjectId(),
        productName: 'PawTag Annual',
        sku: 'PT-ANNUAL-002',
        quantity: 1,
        unitPrice: 39.00,
        totalPrice: 39.00,
      }],
      subtotal: 39.00,
      shippingCost: 5.00,
      tax: 0,
      total: 44.00,
      status: 'paid',
      payment: {
        method: 'card',
        status: 'completed',
        transactionId: 'pi_auth_test_002',
        amount: 44.00,
        currency: 'NZD',
        paidAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .get('/api/customer/orders')
      .set('Authorization', `Bearer ${userA.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('User A cannot access User B\'s invoice', async () => {
    const userA = await createCustomerWithRBAC({ email: 'inv-a@example.com' });
    const userB = await createAdditionalCustomer('inv-b@example.com');

    const orderResult = await mongoose.connection.collections.orders.insertOne({
      orderNumber: 'PT-ORDER-AUTH-003',
      userId: new mongoose.Types.ObjectId(userB.userId),
      items: [],
      subtotal: 39.00,
      status: 'paid',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await mongoose.connection.collections.invoices.insertOne({
      invoiceNumber: 'INV-AUTH-001',
      orderId: orderResult.insertedId,
      userId: new mongoose.Types.ObjectId(userB.userId),
      amount: 44.00,
      currency: 'NZD',
      status: 'paid',
      paidAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .get(`/api/customer/orders/${orderResult.insertedId}/invoice`)
      .set('Authorization', `Bearer ${userA.token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ═══════════════════════════════════════════
// PET — CROSS-USER OWNERSHIP
// ═══════════════════════════════════════════

describe('Integration: Object Authorization — Pet Access', () => {
  it('User A cannot view User B\'s pet by ID', async () => {
    const userA = await createCustomerWithRBAC({ email: 'pet-a@example.com' });
    const userB = await createAdditionalCustomer('pet-b@example.com');

    const petB = await createPet(userB.userId, { name: 'B\'s Pet', petId: 'PET-CROSS-B' });

    const res = await request(app)
      .get(`/api/customer/pets/${petB}`)
      .set('Authorization', `Bearer ${userA.token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('User A cannot update User B\'s pet', async () => {
    const userA = await createCustomerWithRBAC({ email: 'pet-update-a@example.com' });
    const userB = await createAdditionalCustomer('pet-update-b@example.com');

    const petB = await createPet(userB.userId, { name: 'B\'s Pet', petId: 'PET-UPDATE-B' });

    const res = await request(app)
      .put(`/api/customer/pets/${petB}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'Hacked Name' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('User A cannot delete User B\'s pet', async () => {
    const userA = await createCustomerWithRBAC({ email: 'pet-delete-a@example.com' });
    const userB = await createAdditionalCustomer('pet-delete-b@example.com');

    const petB = await createPet(userB.userId, { name: 'B\'s Pet', petId: 'PET-DELETE-B' });

    const res = await request(app)
      .delete(`/api/customer/pets/${petB}`)
      .set('Authorization', `Bearer ${userA.token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);

    const petStillExists = await mongoose.connection.collections.pets.findOne({
      _id: new mongoose.Types.ObjectId(petB),
      deletedAt: null,
    });
    expect(petStillExists).not.toBeNull();
  });
});

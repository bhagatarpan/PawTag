import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';

// ─── Local helpers ──────────────────────────────────────────────

const ALL_CUSTOMER_PERMS = [
  'pet.read', 'pet.create', 'pet.update', 'pet.delete',
  'tag.read', 'tag.create',
  'order.read', 'order.create',
  'notification.read', 'notification.update', 'notification.delete',
  'customer.read',
  'subscription.read', 'subscription.update',
  'vaccination.read', 'vaccination.create', 'vaccination.update', 'vaccination.delete',
  'microchip.read', 'microchip.create', 'microchip.update', 'microchip.delete',
  'medication.read', 'medication.create', 'medication.update', 'medication.delete',
  'allergy.read', 'allergy.create', 'allergy.update', 'allergy.delete',
];

async function createCustomerWithAllPerms(overrides: Partial<{ email: string; fullName: string }> = {}) {
  const email = overrides.email || `cust-${Date.now()}@example.com`;
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const user = await mongoose.connection.collections.users.insertOne({
    email,
    passwordHash,
    fullName: overrides.fullName || 'Test Customer',
    phoneNumber: '+64219999999',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const userId = user.insertedId.toString();

  const role = await mongoose.connection.collections.roles.insertOne({
    name: `CUSTOMER_FULL_${userId}`,
    displayName: 'Customer (Full)',
    description: 'Customer with all permissions',
    roleType: 'system',
    isSystemRole: true,
    isSuperAdmin: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const roleId = role.insertedId.toString();

  for (const permName of ALL_CUSTOMER_PERMS) {
    const [resource, action] = permName.split('.');
    const existing = await mongoose.connection.collections.permissions.findOne({ name: permName });
    const permId = existing
      ? existing._id
      : (await mongoose.connection.collections.permissions.insertOne({
          name: permName,
          displayName: permName,
          resource,
          action,
          permissionGroupId: new mongoose.Types.ObjectId(),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })).insertedId;
    await mongoose.connection.collections.rolepermissions.insertOne({
      roleId: new mongoose.Types.ObjectId(roleId),
      permissionId: permId instanceof mongoose.Types.ObjectId ? permId : new mongoose.Types.ObjectId(permId.toString()),
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

  const token = jwt.sign(
    { id: userId, email, role: 'customer' },
    config.jwtSecret,
    { expiresIn: '1h' },
  );

  return { userId, token, email };
}

async function insertProduct(overrides: Record<string, any> = {}) {
  const doc = {
    name: overrides.name || 'PawTag QR Tag',
    slug: overrides.slug || 'pawtag-qr-tag',
    description: 'Durable QR code pet tag',
    price: overrides.price ?? 29.99,
    sku: overrides.sku || 'PT-QR-001',
    category: 'tags',
    stock: overrides.stock ?? 100,
    isActive: overrides.isActive ?? true,
    isTagProduct: overrides.isTagProduct ?? false,
    images: [],
    variants: overrides.variants || [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await mongoose.connection.collections.products.insertOne(doc);
  return { ...doc, _id: result.insertedId.toString() };
}

// ─── Setup / Teardown ──────────────────────────────────────────

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

// ═══════════════════════════════════════════════════════════════
// 1. PET CRUD
// ═══════════════════════════════════════════════════════════════

describe('Customer Full — Pet CRUD', () => {
  const validPet = {
    name: 'Buddy',
    petType: 'Dog',
    species: 'dog',
    breed: 'Golden Retriever',
    color: 'Golden',
    gender: 'male',
  };

  it('creates, reads, updates, and deletes a pet', async () => {
    const { userId, token } = await createCustomerWithAllPerms();

    // CREATE
    const createRes = await request(app)
      .post('/api/customer/pets')
      .set('Authorization', `Bearer ${token}`)
      .send(validPet);
    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.name).toBe('Buddy');
    expect(createRes.body.data.petId).toBeDefined();
    const petId = createRes.body.data._id;

    // READ — list
    const listRes = await request(app)
      .get('/api/customer/pets')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    // READ — single
    const getRes = await request(app)
      .get(`/api/customer/pets/${petId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.name).toBe('Buddy');

    // UPDATE
    const updateRes = await request(app)
      .put(`/api/customer/pets/${petId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ breed: 'Labrador Retriever' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.breed).toBe('Labrador Retriever');

    // DELETE
    const deleteRes = await request(app)
      .delete(`/api/customer/pets/${petId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.message).toBe('Pet deleted');
  });

  it('returns 401 for unauthenticated pet requests', async () => {
    const res = await request(app).get('/api/customer/pets');
    expect(res.status).toBe(401);
  });

  it('returns 400 when creating pet with missing required fields', async () => {
    const { token } = await createCustomerWithAllPerms();
    const res = await request(app)
      .post('/api/customer/pets')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Buddy' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when getting non-existent pet', async () => {
    const { token } = await createCustomerWithAllPerms();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/customer/pets/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('prevents user from accessing another user\'s pet', async () => {
    const user1 = await createCustomerWithAllPerms({ email: 'user1@example.com' });
    const user2 = await createCustomerWithAllPerms({ email: 'user2@example.com' });

    // User 1 creates a pet
    const createRes = await request(app)
      .post('/api/customer/pets')
      .set('Authorization', `Bearer ${user1.token}`)
      .send(validPet);
    const petId = createRes.body.data._id;

    // User 2 tries to read user 1's pet
    const getRes = await request(app)
      .get(`/api/customer/pets/${petId}`)
      .set('Authorization', `Bearer ${user2.token}`);
    expect(getRes.status).toBe(404);

    // User 2 tries to update user 1's pet
    const updateRes = await request(app)
      .put(`/api/customer/pets/${petId}`)
      .set('Authorization', `Bearer ${user2.token}`)
      .send({ breed: 'Hacked' });
    expect(updateRes.status).toBe(404);

    // User 2 tries to delete user 1's pet
    const deleteRes = await request(app)
      .delete(`/api/customer/pets/${petId}`)
      .set('Authorization', `Bearer ${user2.token}`);
    expect(deleteRes.status).toBe(404);
  });

  it('returns 404 when updating a non-existent pet', async () => {
    const { token } = await createCustomerWithAllPerms();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .put(`/api/customer/pets/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ breed: 'Poodle' });
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. HEALTH RECORDS
// ═══════════════════════════════════════════════════════════════

describe('Customer Full — Health Records', () => {
  async function createOwnedPet(token: string) {
    const res = await request(app)
      .post('/api/customer/pets')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'HealthPet', petType: 'Dog', species: 'Canine', breed: 'Labrador', color: 'Golden' });
    return res.body.data;
  }

  it('adds and lists vaccinations for a pet', async () => {
    const { token } = await createCustomerWithAllPerms();
    const pet = await createOwnedPet(token);

    const addRes = await request(app)
      .post(`/api/customer/pets/${pet._id}/vaccinations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vaccine: 'Rabies', dateGiven: '2024-01-15' });
    expect(addRes.status).toBe(201);
    expect(addRes.body.data.vaccine).toBe('Rabies');

    const listRes = await request(app)
      .get(`/api/customer/pets/${pet._id}/vaccinations`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].vaccine).toBe('Rabies');
  });

  it('returns 401 for health record requests without token', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/customer/pets/${fakeId}/vaccinations`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for health records on non-existent pet', async () => {
    const { token } = await createCustomerWithAllPerms();
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/customer/pets/${fakeId}/vaccinations`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('prevents user from accessing another user\'s pet health records', async () => {
    const user1 = await createCustomerWithAllPerms({ email: 'h1@example.com' });
    const user2 = await createCustomerWithAllPerms({ email: 'h2@example.com' });

    const pet = await createOwnedPet(user1.token);

    // User 2 cannot read user 1's vaccinations
    const res = await request(app)
      .get(`/api/customer/pets/${pet._id}/vaccinations`)
      .set('Authorization', `Bearer ${user2.token}`);
    expect(res.status).toBe(404);

    // User 2 cannot add vaccinations to user 1's pet
    const addRes = await request(app)
      .post(`/api/customer/pets/${pet._id}/vaccinations`)
      .set('Authorization', `Bearer ${user2.token}`)
      .send({ vaccine: 'FVRCP' });
    expect(addRes.status).toBe(404);
  });

  it('adds and lists microchips', async () => {
    const { token } = await createCustomerWithAllPerms();
    const pet = await createOwnedPet(token);

    const addRes = await request(app)
      .post(`/api/customer/pets/${pet._id}/microchips`)
      .set('Authorization', `Bearer ${token}`)
      .send({ chipNumber: 'NZ-MC-123456' });
    expect(addRes.status).toBe(201);
    expect(addRes.body.data.chipNumber).toBe('NZ-MC-123456');

    const listRes = await request(app)
      .get(`/api/customer/pets/${pet._id}/microchips`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
  });

  it('adds and lists medications', async () => {
    const { token } = await createCustomerWithAllPerms();
    const pet = await createOwnedPet(token);

    const addRes = await request(app)
      .post(`/api/customer/pets/${pet._id}/medications`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Heartgard', dosage: '1 tablet', frequency: 'Monthly' });
    expect(addRes.status).toBe(201);
    expect(addRes.body.data.name).toBe('Heartgard');

    const listRes = await request(app)
      .get(`/api/customer/pets/${pet._id}/medications`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
  });

  it('adds and lists allergies', async () => {
    const { token } = await createCustomerWithAllPerms();
    const pet = await createOwnedPet(token);

    const addRes = await request(app)
      .post(`/api/customer/pets/${pet._id}/allergies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ allergen: 'Peanuts', severity: 'severe', reaction: 'Swelling' });
    expect(addRes.status).toBe(201);
    expect(addRes.body.data.allergen).toBe('Peanuts');

    const listRes = await request(app)
      .get(`/api/customer/pets/${pet._id}/allergies`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. TAG REDEMPTION
// ═══════════════════════════════════════════════════════════════

describe('Customer Full — Tag Redemption', () => {
  it('redeems an unclaimed tag successfully', async () => {
    const { userId, token } = await createCustomerWithAllPerms();

    // Insert an unclaimed tag (no ownerId)
    await mongoose.connection.collections.tags.insertOne({
      tagId: 'TAG-REDEEM-001',
      tagType: 'qr',
      status: 'inactive',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/customer/tags/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ tagId: 'TAG-REDEEM-001' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.ownerId).toBe(userId);
  });

  it('returns 404 for non-existent tag ID', async () => {
    const { token } = await createCustomerWithAllPerms();

    const res = await request(app)
      .post('/api/customer/tags/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ tagId: 'TAG-DOES-NOT-EXIST' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 409 when tag is already claimed', async () => {
    const { userId, token } = await createCustomerWithAllPerms();

    await mongoose.connection.collections.tags.insertOne({
      tagId: 'TAG-ALREADY-CLAIMED',
      tagType: 'qr',
      status: 'active',
      ownerId: new mongoose.Types.ObjectId(userId),
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/customer/tags/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ tagId: 'TAG-ALREADY-CLAIMED' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when tagId is missing from request body', async () => {
    const { token } = await createCustomerWithAllPerms();

    const res = await request(app)
      .post('/api/customer/tags/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for unauthenticated tag redemption', async () => {
    const res = await request(app)
      .post('/api/customer/tags/redeem')
      .send({ tagId: 'TAG-NOAUTH' });

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. CART
// ═══════════════════════════════════════════════════════════════

// Cart routes removed — frontend now uses Medusa SDK

// ═══════════════════════════════════════════════════════════════
// 5. ORDERS
// ═══════════════════════════════════════════════════════════════

describe('Customer Full — Orders', () => {
  it('returns error when creating order with empty cart', async () => {
    const { token } = await createCustomerWithAllPerms();

    const res = await request(app)
      .post('/api/customer/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        shippingAddress: { line1: '123 Main St', city: 'Auckland', state: 'AKL', zip: '1010' },
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/cart/i);
  });

  it('returns 400 when shipping address is incomplete', async () => {
    const { token } = await createCustomerWithAllPerms();
    const product = await insertProduct();

    await request(app)
      .post('/api/customer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id, quantity: 1 });

    const res = await request(app)
      .post('/api/customer/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ shippingAddress: { line1: '123 Main St' } });

    expect(res.status).toBe(400);
  });

  it('returns 401 for unauthenticated order creation', async () => {
    const res = await request(app)
      .post('/api/customer/orders')
      .send({
        shippingAddress: { line1: '123 Main St', city: 'Auckland', state: 'AKL', zip: '1010' },
      });
    expect(res.status).toBe(401);
  });

  it('GET /orders returns user orders', async () => {
    const { token } = await createCustomerWithAllPerms();

    const res = await request(app)
      .get('/api/customer/orders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('GET /orders/:id returns 404 for non-existent order', async () => {
    const { token } = await createCustomerWithAllPerms();
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .get(`/api/customer/orders/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

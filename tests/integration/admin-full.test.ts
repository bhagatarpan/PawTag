import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { createSuperAdmin, createCustomer, createPet, createTag } from './helpers';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

// ──────────────────────────────────────────────────────────────────────────────
// 1. User Management
// ──────────────────────────────────────────────────────────────────────────────
describe('Admin - User Management', () => {
  let adminToken: string;
  let adminUserId: string;

  beforeEach(async () => {
    const admin = await createSuperAdmin();
    adminToken = admin.token;
    adminUserId = admin.userId;
  });

  it('GET /api/admin/users returns paginated users', async () => {
    await createCustomer({ email: 'user1@example.com' });
    await createCustomer({ email: 'user2@example.com' });

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeInstanceOf(Array);
    expect(res.body.data.total).toBeGreaterThanOrEqual(2);
    expect(res.body.data.page).toBe(1);
  });

  it('GET /api/admin/users/:id returns a single user', async () => {
    const customer = await createCustomer({ email: 'getuser@example.com' });

    const res = await request(app)
      .get(`/api/admin/users/${customer.userId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('getuser@example.com');
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('GET /api/admin/users/:id returns 404 for non-existent user', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/admin/users/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('PUT /api/admin/users/:id updates user details', async () => {
    const customer = await createCustomer({ email: 'updateuser@example.com' });

    const res = await request(app)
      .put(`/api/admin/users/${customer.userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fullName).toBe('Updated Name');
  });

  it('PUT /api/admin/users/:id updates address fields', async () => {
    const customer = await createCustomer({ email: 'addruser@example.com' });

    const res = await request(app)
      .put(`/api/admin/users/${customer.userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        address: {
          line1: '123 Test Street',
          line2: 'Ponsonby',
          city: 'Auckland',
          state: 'Auckland',
          zip: '1011',
          country: 'NZ',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.address.line1).toBe('123 Test Street');
    expect(res.body.data.address.line2).toBe('Ponsonby');
    expect(res.body.data.address.city).toBe('Auckland');
    expect(res.body.data.address.state).toBe('Auckland');
    expect(res.body.data.address.zip).toBe('1011');
    expect(res.body.data.address.country).toBe('NZ');
  });

  it('PUT /api/admin/users/:id updates emergency contact fields', async () => {
    const customer = await createCustomer({ email: 'ecuser@example.com' });

    const res = await request(app)
      .put(`/api/admin/users/${customer.userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        emergencyContact: {
          name: 'Jane Doe',
          phone: '+64 21 987 6543',
          email: 'jane@example.com',
          relationship: 'Spouse',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.emergencyContact.name).toBe('Jane Doe');
    expect(res.body.data.emergencyContact.phone).toBe('+64 21 987 6543');
    expect(res.body.data.emergencyContact.email).toBe('jane@example.com');
    expect(res.body.data.emergencyContact.relationship).toBe('Spouse');
  });

  it('PUT /api/admin/users/:id updates showOwnerNameInFinder', async () => {
    const customer = await createCustomer({ email: 'privacyuser@example.com' });

    const res = await request(app)
      .put(`/api/admin/users/${customer.userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ showOwnerNameInFinder: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.showOwnerNameInFinder).toBe(false);
  });

  it('PUT /api/admin/users/:id updates notification preferences', async () => {
    const customer = await createCustomer({ email: 'notifuser@example.com' });

    const res = await request(app)
      .put(`/api/admin/users/${customer.userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        notificationPreferences: {
          email: false,
          push: true,
          channels: { petFound: true, marketing: true },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notificationPreferences.email).toBe(false);
    expect(res.body.data.notificationPreferences.push).toBe(true);
    expect(res.body.data.notificationPreferences.channels.petFound).toBe(true);
    expect(res.body.data.notificationPreferences.channels.marketing).toBe(true);
  });

  it('PUT /api/admin/users/:id updates address and emergency contact together', async () => {
    const customer = await createCustomer({ email: 'combined@example.com' });

    const res = await request(app)
      .put(`/api/admin/users/${customer.userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Combined Update',
        address: { city: 'Wellington', country: 'NZ' },
        emergencyContact: { name: 'Bob', relationship: 'Brother' },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fullName).toBe('Combined Update');
    expect(res.body.data.address.city).toBe('Wellington');
    expect(res.body.data.emergencyContact.name).toBe('Bob');
  });

  it('PUT /api/admin/users/:id/status changes user status', async () => {
    const customer = await createCustomer({ email: 'statususer@example.com' });

    const res = await request(app)
      .put(`/api/admin/users/${customer.userId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'suspended' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('suspended');
  });

  it('DELETE /api/admin/users/:id soft-deletes a user', async () => {
    const customer = await createCustomer({ email: 'deleteuser@example.com' });

    const res = await request(app)
      .delete(`/api/admin/users/${customer.userId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify user is no longer listed
    const listRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    const found = listRes.body.data.items.find((u: any) => u._id === customer.userId);
    expect(found).toBeUndefined();
  });

  it('GET /api/admin/users returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/users returns 403 for non-admin user', async () => {
    const customer = await createCustomer({ email: 'nonadmin@example.com' });

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${customer.token}`);

    expect(res.status).toBe(403);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. Tag Management
// ──────────────────────────────────────────────────────────────────────────────
describe('Admin - Tag Management', () => {
  let adminToken: string;

  beforeEach(async () => {
    const admin = await createSuperAdmin();
    adminToken = admin.token;
  });

  it('GET /api/admin/tags returns paginated tags', async () => {
    const customer = await createCustomer({ email: 'tagowner@example.com' });
    const petId = await createPet(customer.userId, { name: 'Rex' });
    await createTag(customer.userId, petId, { tagId: 'PT-111111' });

    const res = await request(app)
      .get('/api/admin/tags')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeInstanceOf(Array);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/admin/tags/:id returns a single tag', async () => {
    const customer = await createCustomer({ email: 'tagowner2@example.com' });
    const petId = await createPet(customer.userId, { name: 'Max' });
    const tagId = await createTag(customer.userId, petId, { tagId: 'PT-222222' });

    const res = await request(app)
      .get(`/api/admin/tags/${tagId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tagId).toBe('PT-222222');
  });

  it('PUT /api/admin/tags/:id updates tag status', async () => {
    const customer = await createCustomer({ email: 'tagowner3@example.com' });
    const petId = await createPet(customer.userId, { name: 'Bella' });
    const tagId = await createTag(customer.userId, petId, { tagId: 'PT-333333' });

    const res = await request(app)
      .put(`/api/admin/tags/${tagId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'lost' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('lost');
  });

  it('GET /api/admin/tags returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/tags');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/tags returns 403 for non-admin user', async () => {
    const customer = await createCustomer({ email: 'nonadmintag@example.com' });

    const res = await request(app)
      .get('/api/admin/tags')
      .set('Authorization', `Bearer ${customer.token}`);

    expect(res.status).toBe(403);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. Product Management
// ──────────────────────────────────────────────────────────────────────────────
describe('Admin - Product Management', () => {
  let adminToken: string;

  const validProduct = {
    name: 'PawTag QR Tag',
    description: 'Premium QR pet tag',
    price: 29.99,
    category: 'tags',
    stock: 100,
    sku: 'PT-QR-001',
  };

  beforeEach(async () => {
    const admin = await createSuperAdmin();
    adminToken = admin.token;
  });

  it('POST /api/admin/products creates a product', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validProduct);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('PawTag QR Tag');
    expect(res.body.data.sku).toBe('PT-QR-001');
  });

  it('GET /api/admin/products returns paginated products', async () => {
    await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validProduct);

    await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validProduct, sku: 'PT-QR-002', name: 'PawTag NFC Tag' });

    const res = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/admin/products/:id returns a single product', async () => {
    const createRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validProduct);

    const productId = createRes.body.data._id;

    const res = await request(app)
      .get(`/api/admin/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sku).toBe('PT-QR-001');
  });

  it('PUT /api/admin/products/:id updates a product', async () => {
    const createRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validProduct);

    const productId = createRes.body.data._id;

    const res = await request(app)
      .put(`/api/admin/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 34.99, stock: 50 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.price).toBe(34.99);
    expect(res.body.data.stock).toBe(50);
  });

  it('DELETE /api/admin/products/:id deletes a product', async () => {
    const createRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validProduct);

    const productId = createRes.body.data._id;

    const res = await request(app)
      .delete(`/api/admin/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify product is gone
    const getRes = await request(app)
      .get(`/api/admin/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(404);
  });

  it('POST /api/admin/products rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Incomplete Product' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/admin/products returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .send(validProduct);

    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. Order Management
// ──────────────────────────────────────────────────────────────────────────────
describe('Admin - Order Management', () => {
  let adminToken: string;

  beforeEach(async () => {
    const admin = await createSuperAdmin();
    adminToken = admin.token;
  });

  it('GET /api/admin/orders returns paginated orders', async () => {
    const customer = await createCustomer({ email: 'ordercust@example.com' });

    // Create order directly in DB
    await mongoose.connection.collections.orders.insertOne({
      userId: new mongoose.Types.ObjectId(customer.userId),
      orderNumber: 'ORD-TEST-001',
      status: 'pending',
      items: [{ productName: 'PawTag QR', quantity: 1, price: 29.99, sku: 'PT-QR-001' }],
      subtotal: 29.99,
      total: 29.99,
      currency: 'NZD',
      payment: { status: 'pending', amount: 29.99, currency: 'NZD' },
      shippingAddress: { line1: '123 Test St', city: 'Auckland', country: 'NZ' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeInstanceOf(Array);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/admin/orders filters by status', async () => {
    const customer = await createCustomer({ email: 'orderfilt@example.com' });

    await mongoose.connection.collections.orders.insertOne({
      userId: new mongoose.Types.ObjectId(customer.userId),
      orderNumber: 'ORD-TEST-002',
      status: 'shipped',
      items: [{ productName: 'PawTag NFC', quantity: 2, price: 39.99, sku: 'PT-NFC-001' }],
      subtotal: 79.98,
      total: 79.98,
      currency: 'NZD',
      payment: { status: 'completed', amount: 79.98, currency: 'NZD' },
      shippingAddress: { line1: '456 Test Ave', city: 'Wellington', country: 'NZ' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .get('/api/admin/orders?status=shipped')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.items.every((o: any) => o.status === 'shipped')).toBe(true);
  });

  it('GET /api/admin/orders returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/orders');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/orders returns 403 for non-admin', async () => {
    const customer = await createCustomer({ email: 'nonadminorder@example.com' });

    const res = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${customer.token}`);

    expect(res.status).toBe(403);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. Settings
// ──────────────────────────────────────────────────────────────────────────────
describe('Admin - Settings', () => {
  let adminToken: string;

  beforeEach(async () => {
    const admin = await createSuperAdmin();
    adminToken = admin.token;
  });

  it('POST /api/admin/settings creates a setting', async () => {
    const res = await request(app)
      .post('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'site.maintenance', value: 'false', category: 'general', description: 'Maintenance mode' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.key).toBe('site.maintenance');
  });

  it('GET /api/admin/settings returns all settings', async () => {
    await request(app)
      .post('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'setting.a', value: '1', category: 'general' });
    await request(app)
      .post('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'setting.b', value: '2', category: 'notifications' });

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/admin/settings filters by category', async () => {
    await request(app)
      .post('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'site.name', value: 'PawTag', category: 'general' });
    await request(app)
      .post('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'email.from', value: 'noreply@pawtag.co.nz', category: 'notifications' });

    const res = await request(app)
      .get('/api/admin/settings?category=general')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((s: any) => s.category === 'general')).toBe(true);
  });

  it('PUT /api/admin/settings/:key updates a setting', async () => {
    await request(app)
      .post('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'feature.dark_mode', value: 'false', category: 'features' });

    const res = await request(app)
      .put('/api/admin/settings/feature.dark_mode')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 'true' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.value).toBe('true');
  });

  it('DELETE /api/admin/settings/:key deletes a setting', async () => {
    await request(app)
      .post('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'temp.setting', value: 'temp', category: 'temp' });

    const res = await request(app)
      .delete('/api/admin/settings/temp.setting')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify deleted
    const getRes = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);
    const found = getRes.body.data.find((s: any) => s.key === 'temp.setting');
    expect(found).toBeUndefined();
  });

  it('GET /api/admin/settings returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/settings');
    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. Feature Flags
// ──────────────────────────────────────────────────────────────────────────────
describe('Admin - Feature Flags', () => {
  let adminToken: string;

  beforeEach(async () => {
    const admin = await createSuperAdmin();
    adminToken = admin.token;
  });

  it('POST /api/admin/feature-flags creates a flag', async () => {
    const res = await request(app)
      .post('/api/admin/feature-flags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'dark_mode', name: 'Dark Mode', description: 'Enable dark mode UI', isEnabled: false });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.key).toBe('dark_mode');
  });

  it('GET /api/admin/feature-flags returns all flags', async () => {
    await request(app)
      .post('/api/admin/feature-flags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'flag_a', name: 'Flag A' });
    await request(app)
      .post('/api/admin/feature-flags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'flag_b', name: 'Flag B' });

    const res = await request(app)
      .get('/api/admin/feature-flags')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('PUT /api/admin/feature-flags/:key updates a flag', async () => {
    await request(app)
      .post('/api/admin/feature-flags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'toggle_me', name: 'Toggle Me', isEnabled: false });

    const res = await request(app)
      .put('/api/admin/feature-flags/toggle_me')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isEnabled: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isEnabled).toBe(true);
  });

  it('DELETE /api/admin/feature-flags/:key deletes a flag', async () => {
    await request(app)
      .post('/api/admin/feature-flags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'temp_flag', name: 'Temporary Flag' });

    const res = await request(app)
      .delete('/api/admin/feature-flags/temp_flag')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify deleted
    const getRes = await request(app)
      .get('/api/admin/feature-flags')
      .set('Authorization', `Bearer ${adminToken}`);
    const found = getRes.body.data.find((f: any) => f.key === 'temp_flag');
    expect(found).toBeUndefined();
  });

  it('POST /api/admin/feature-flags returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/admin/feature-flags')
      .send({ key: 'unauthed', name: 'Unauthed Flag' });

    expect(res.status).toBe(401);
  });

  it('GET /api/admin/feature-flags returns 403 for non-admin', async () => {
    const customer = await createCustomer({ email: 'nonadminflag@example.com' });

    const res = await request(app)
      .get('/api/admin/feature-flags')
      .set('Authorization', `Bearer ${customer.token}`);

    expect(res.status).toBe(403);
  });
});

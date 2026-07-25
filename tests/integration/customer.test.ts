import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';
import { createCustomerWithRBAC, createPet, createTag } from './helpers';

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
// PET ROUTES
// ═══════════════════════════════════════════

describe('Integration: Customer - Pets', () => {
  const validPet = {
    name: 'Buddy',
    petType: 'Dog',
    species: 'dog',
    breed: 'Golden Retriever',
    color: 'Golden',
    gender: 'male',
  };

  it('GET /api/customer/pets returns empty array initially', async () => {
    const { token } = await createCustomerWithRBAC();
    const res = await request(app)
      .get('/api/customer/pets')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('POST /api/customer/pets creates a pet', async () => {
    const { token } = await createCustomerWithRBAC();
    const res = await request(app)
      .post('/api/customer/pets')
      .set('Authorization', `Bearer ${token}`)
      .send(validPet);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Buddy');
    expect(res.body.data.petId).toBeDefined();
  });

  it('POST /api/customer/pets rejects without required fields', async () => {
    const { token } = await createCustomerWithRBAC();
    const res = await request(app)
      .post('/api/customer/pets')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Buddy' });

    expect(res.status).toBe(400);
  });

  it('GET /api/customer/pets returns pets with linked tags', async () => {
    const { userId, token } = await createCustomerWithRBAC();
    const petId = await createPet(userId);

    await createTag(userId, petId, { tagId: 'TAG-LINKED-001' });

    const res = await request(app)
      .get('/api/customer/pets')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].linkedTag).toBeDefined();
    expect(res.body.data[0].linkedTag.tagId).toBe('TAG-LINKED-001');
  });

  it('GET /api/customer/pets/:id returns specific pet', async () => {
    const { userId, token } = await createCustomerWithRBAC();
    const petId = await createPet(userId);

    const res = await request(app)
      .get(`/api/customer/pets/${petId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Buddy');
  });

  it('GET /api/customer/pets/:id returns 404 for non-existent pet', async () => {
    const { token } = await createCustomerWithRBAC();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/customer/pets/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('PUT /api/customer/pets/:id updates a pet', async () => {
    const { userId, token } = await createCustomerWithRBAC();
    const petId = await createPet(userId);

    const res = await request(app)
      .put(`/api/customer/pets/${petId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ breed: 'Labrador Retriever' });

    expect(res.status).toBe(200);
    expect(res.body.data.breed).toBe('Labrador Retriever');
  });

  it('DELETE /api/customer/pets/:id soft-deletes a pet', async () => {
    const { userId, token } = await createCustomerWithRBAC();
    const petId = await createPet(userId);

    const res = await request(app)
      .delete(`/api/customer/pets/${petId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Pet deleted');

    const pet = await mongoose.connection.collections.pets.findOne({ _id: new mongoose.Types.ObjectId(petId) });
    expect(pet?.deletedAt).toBeDefined();
  });

  it('POST /api/customer/pets/:id/mark-lost marks pet as lost', async () => {
    const { userId, token } = await createCustomerWithRBAC();
    const petId = await createPet(userId);

    const res = await request(app)
      .post(`/api/customer/pets/${petId}/mark-lost`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('lost');
    expect(res.body.data.lostCount).toBe(1);
  });

  it('POST /api/customer/pets/:id/mark-found marks pet as safe', async () => {
    const { userId, token } = await createCustomerWithRBAC();
    const petId = await createPet(userId, { status: 'lost', lostCount: 1 });

    const res = await request(app)
      .post(`/api/customer/pets/${petId}/mark-found`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('safe');
  });

  it('POST /api/customer/pets/:id/mark-terminal requires valid reason', async () => {
    const { userId, token } = await createCustomerWithRBAC();
    const petId = await createPet(userId);

    const res = await request(app)
      .post(`/api/customer/pets/${petId}/mark-terminal`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'invalid_reason' });

    expect(res.status).toBe(400);
  });

  it('POST /api/customer/pets/:id/mark-terminal with valid reason', async () => {
    const { userId, token } = await createCustomerWithRBAC();
    const petId = await createPet(userId);

    const res = await request(app)
      .post(`/api/customer/pets/${petId}/mark-terminal`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'deceased' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('deceased');
  });

  it('GET /api/customer/pets/:id/locations returns location history', async () => {
    const { userId, token } = await createCustomerWithRBAC();
    const petId = await createPet(userId);

    const res = await request(app)
      .get(`/api/customer/pets/${petId}/locations`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('unauthenticated requests return 401', async () => {
    const res = await request(app).get('/api/customer/pets');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════
// TAG ROUTES
// ═══════════════════════════════════════════

describe('Integration: Customer - Tags', () => {
  it('GET /api/customer/tags returns empty array initially', async () => {
    const { token } = await createCustomerWithRBAC();
    const res = await request(app)
      .get('/api/customer/tags')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('GET /api/customer/tags returns tags with populated pet info', async () => {
    const { userId, token } = await createCustomerWithRBAC();
    const petId = await createPet(userId);
    await createTag(userId, petId, { tagId: 'TAG-POP-001' });

    const res = await request(app)
      .get('/api/customer/tags')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].tagId).toBe('TAG-POP-001');
  });
});

// ═══════════════════════════════════════════
// NOTIFICATION ROUTES
// ═══════════════════════════════════════════

describe('Integration: Customer - Notifications', () => {
  it('GET /api/customer/notifications returns empty array initially', async () => {
    const { token } = await createCustomerWithRBAC();
    const res = await request(app)
      .get('/api/customer/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('GET /api/customer/notifications returns notifications', async () => {
    const { userId, token } = await createCustomerWithRBAC();

    await mongoose.connection.collections.notifications.insertOne({
      userId: new mongoose.Types.ObjectId(userId),
      type: 'pet_found',
      title: 'Your pet was found!',
      message: 'Someone found Buddy',
      priority: 'high',
      read: false,
      data: { petName: 'Buddy' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .get('/api/customer/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Your pet was found!');
  });

  it('PUT /api/customer/notifications/:id/read marks notification as read', async () => {
    const { userId, token } = await createCustomerWithRBAC();

    const notif = await mongoose.connection.collections.notifications.insertOne({
      userId: new mongoose.Types.ObjectId(userId),
      type: 'pet_found',
      title: 'Found!',
      message: 'Buddy found',
      priority: 'high',
      read: false,
      data: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .put(`/api/customer/notifications/${notif.insertedId}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Notification marked as read');
  });
});

// ═══════════════════════════════════════════
// CART ROUTES
// ═══════════════════════════════════════════

describe('Integration: Customer - Cart', () => {
  it('GET /api/customer/cart returns empty cart', async () => {
    const { token } = await createCustomerWithRBAC();
    const res = await request(app)
      .get('/api/customer/cart')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toEqual([]);
  });

  it('POST /api/customer/cart/items adds item to cart', async () => {
    const { token } = await createCustomerWithRBAC();
    const product = await mongoose.connection.collections.products.insertOne({
      name: 'PawTag QR Tag',
      slug: 'pawtag-qr-tag',
      description: 'Durable QR code pet tag',
      price: 29.99,
      sku: 'PT-QR-001',
      category: 'tags',
      stock: 100,
      isActive: true,
      images: [],
      variants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/customer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.insertedId.toString(), quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(2);
    expect(res.body.data.items[0].productName).toBe('PawTag QR Tag');
  });

  it('POST /api/customer/cart/items increments quantity for duplicate items', async () => {
    const { token } = await createCustomerWithRBAC();
    const product = await mongoose.connection.collections.products.insertOne({
      name: 'PawTag Classic',
      slug: 'pawtag-classic',
      description: 'Classic tag',
      price: 24.99,
      sku: 'PT-CL-001',
      category: 'tags',
      stock: 50,
      isActive: true,
      images: [],
      variants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await request(app)
      .post('/api/customer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.insertedId.toString(), quantity: 1 });

    const res = await request(app)
      .post('/api/customer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.insertedId.toString(), quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(3);
  });

  it('POST /api/customer/cart/items returns 404 for non-existent product', async () => {
    const { token } = await createCustomerWithRBAC();
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post('/api/customer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: fakeId, quantity: 1 });

    expect(res.status).toBe(404);
  });

  it('DELETE /api/customer/cart clears the cart', async () => {
    const { token } = await createCustomerWithRBAC();
    const product = await mongoose.connection.collections.products.insertOne({
      name: 'PawTag Clear',
      slug: 'pawtag-clear',
      description: 'Clear tag',
      price: 19.99,
      sku: 'PT-CLR-001',
      category: 'tags',
      stock: 10,
      isActive: true,
      images: [],
      variants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await request(app)
      .post('/api/customer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.insertedId.toString(), quantity: 1 });

    const res = await request(app)
      .delete('/api/customer/cart')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Cart cleared');
  });
});

// ═══════════════════════════════════════════
// ORDER ROUTES
// ═══════════════════════════════════════════

describe('Integration: Customer - Orders', () => {
  it('GET /api/customer/orders returns empty array initially', async () => {
    const { token } = await createCustomerWithRBAC();
    const res = await request(app)
      .get('/api/customer/orders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('GET /api/customer/orders/:id returns 404 for non-existent order', async () => {
    const { token } = await createCustomerWithRBAC();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/customer/orders/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('POST /api/customer/orders rejects empty cart', async () => {
    const { token } = await createCustomerWithRBAC();
    const res = await request(app)
      .post('/api/customer/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        shippingAddress: { line1: '123 Main St', city: 'Auckland', state: 'AKL', zip: '1010' },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cart/i);
  });

  it('POST /api/customer/orders rejects missing shipping address', async () => {
    const { token } = await createCustomerWithRBAC();
    const product = await mongoose.connection.collections.products.insertOne({
      name: 'PawTag Missing',
      slug: 'pawtag-missing',
      description: 'Missing tag',
      price: 29.99,
      sku: 'PT-MS-001',
      category: 'tags',
      stock: 10,
      isActive: true,
      images: [],
      variants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await request(app)
      .post('/api/customer/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.insertedId.toString(), quantity: 1 });

    const res = await request(app)
      .post('/api/customer/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════
// RESPONSIBILITY SCORE
// ═══════════════════════════════════════════

describe('Integration: Customer - Responsibility Score', () => {
  it('GET /api/customer/responsibility returns score for user', async () => {
    const { userId, token } = await createCustomerWithRBAC();
    await createPet(userId, { lostCount: 0 });

    const res = await request(app)
      .get('/api/customer/responsibility')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.score).toBe(0);
    expect(res.body.data.rating).toBe('Super Awesome Parent');
    expect(res.body.data.color).toBe('green');
  });

  it('GET /api/customer/responsibility returns 404 for non-existent user', async () => {
    const fakeToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), email: 'ghost@example.com', role: 'customer' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/customer/responsibility')
      .set('Authorization', `Bearer ${fakeToken}`);

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════
// FOUND TIMER
// ═══════════════════════════════════════════

describe('Integration: Customer - Found Timer', () => {
  it('GET /api/customer/pets/:id/found-timer returns inactive for safe pet', async () => {
    const { userId, token } = await createCustomerWithRBAC();
    const petId = await createPet(userId, { status: 'safe' });

    const res = await request(app)
      .get(`/api/customer/pets/${petId}/found-timer`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);
  });

  it('GET /api/customer/pets/:id/found-timer returns active for found pet', async () => {
    const { userId, token } = await createCustomerWithRBAC();
    const petId = await createPet(userId, { status: 'found' });
    const foundAt = new Date(Date.now() - 3600000);

    await mongoose.connection.collections.pets.updateOne(
      { _id: new mongoose.Types.ObjectId(petId) },
      { $set: { foundByFinderAt: foundAt } }
    );

    const res = await request(app)
      .get(`/api/customer/pets/${petId}/found-timer`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(true);
    expect(res.body.data.elapsed).toBeGreaterThan(0);
  });
});

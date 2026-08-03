import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';

async function createCustomer(overrides: Partial<{ email: string; fullName: string }> = {}) {
  const email = overrides.email || 'owner@example.com';
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const user = await mongoose.connection.collections.users.insertOne({
    email,
    passwordHash,
    fullName: overrides.fullName || 'Pet Owner',
    phoneNumber: '+64219999999',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return user.insertedId.toString();
}

async function createPet(ownerId: string, overrides: Record<string, any> = {}) {
  const pet = await mongoose.connection.collections.pets.insertOne({
    ownerId: new mongoose.Types.ObjectId(ownerId),
    petId: overrides.petId || 'PET-FINDER-001',
    name: overrides.name || 'Buddy',
    petType: overrides.petType || 'Dog',
    species: overrides.species || 'dog',
    breed: overrides.breed || 'Golden Retriever',
    color: overrides.color || 'Golden',
    gender: overrides.gender || 'male',
    status: overrides.status || 'lost',
    lostCount: overrides.lostCount || 1,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return pet.insertedId.toString();
}

async function createTag(ownerId: string, petId: string, overrides: Record<string, any> = {}) {
  const tag = await mongoose.connection.collections.tags.insertOne({
    tagId: overrides.tagId || 'TAG-FINDER-001',
    petId: new mongoose.Types.ObjectId(petId),
    ownerId: new mongoose.Types.ObjectId(ownerId),
    status: overrides.status || 'active',
    tagType: 'qr',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return tag.insertedId.toString();
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
// STATS
// ═══════════════════════════════════════════

describe('Integration: Finder - Stats', () => {
  it('GET /api/finder/stats returns public stats', async () => {
    const res = await request(app).get('/api/finder/stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('petsProtected');
    expect(res.body.data).toHaveProperty('tagsSold');
    expect(res.body.data).toHaveProperty('totalScans');
    expect(res.body.data).toHaveProperty('registeredUsers');
  });

  it('GET /api/finder/stats returns zero counts with empty DB', async () => {
    const res = await request(app).get('/api/finder/stats');

    expect(res.status).toBe(200);
    expect(res.body.data.petsProtected).toBe(0);
    expect(res.body.data.tagsSold).toBe(0);
    expect(res.body.data.totalScans).toBe(0);
  });
});

// ═══════════════════════════════════════════
// TAG LOOKUP
// ═══════════════════════════════════════════

describe('Integration: Finder - Tag Lookup', () => {
  it('GET /api/finder/:tagId returns pet info for valid tag', async () => {
    const ownerId = await createCustomer({ fullName: 'John Owner' });
    const petId = await createPet(ownerId, { name: 'Rex', status: 'lost' });
    await createTag(ownerId, petId, { tagId: 'TAG-SCAN-001' });

    const res = await request(app).get('/api/finder/TAG-SCAN-001');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pet.name).toBe('Rex');
    expect(res.body.data.pet.status).toBe('lost');
    expect(res.body.data.ownerName).toBe('John Owner');
    expect(res.body.data.tagId).toBe('TAG-SCAN-001');
  });

  it('GET /api/finder/:tagId returns 404 for non-existent tag', async () => {
    const res = await request(app).get('/api/finder/NONEXISTENT');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/finder/:tagId logs a FinderScan', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId);
    await createTag(ownerId, petId, { tagId: 'TAG-SCAN-LOG' });

    await request(app)
      .get('/api/finder/TAG-SCAN-LOG')
      .set('User-Agent', 'TestScanner/1.0');

    const scans = await mongoose.connection.collections.finderscans.find({}).toArray();
    expect(scans).toHaveLength(1);
    expect(scans[0].action).toBe('viewed');
  });

  it('GET /api/finder/:tagId updates tag lastScannedAt', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId);
    await createTag(ownerId, petId, { tagId: 'TAG-SCAN-TIME' });

    await request(app).get('/api/finder/TAG-SCAN-TIME');

    const tag = await mongoose.connection.collections.tags.findOne({ tagId: 'TAG-SCAN-TIME' });
    expect(tag?.lastScannedAt).toBeDefined();
  });
});

// ═══════════════════════════════════════════
// NOTIFY OWNER
// ═══════════════════════════════════════════

describe('Integration: Finder - Notify Owner', () => {
  it('POST /api/finder/:tagId/notify requires contact info', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId);
    await createTag(ownerId, petId, { tagId: 'TAG-NOTIFY-001' });

    const res = await request(app)
      .post('/api/finder/TAG-NOTIFY-001/notify')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/phone|email/i);
  });

  it('POST /api/finder/:tagId/notify sends notification with phone', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, { name: 'Max', status: 'lost' });
    await createTag(ownerId, petId, { tagId: 'TAG-NOTIFY-PHONE' });

    const res = await request(app)
      .post('/api/finder/TAG-NOTIFY-PHONE/notify')
      .send({ finderPhone: '+64211111111', finderName: 'Finder Jane' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toMatch(/notified/i);
  });

  it('POST /api/finder/:tagId/notify sends notification with email', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, { status: 'lost' });
    await createTag(ownerId, petId, { tagId: 'TAG-NOTIFY-EMAIL' });

    const res = await request(app)
      .post('/api/finder/TAG-NOTIFY-EMAIL/notify')
      .send({ finderEmail: 'finder@test.com' });

    expect(res.status).toBe(200);
  });

  it('POST /api/finder/:tagId/notify creates notification for owner', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, { name: 'Luna', status: 'lost' });
    await createTag(ownerId, petId, { tagId: 'TAG-NOTIFY-CREATE' });

    await request(app)
      .post('/api/finder/TAG-NOTIFY-CREATE/notify')
      .send({ finderPhone: '+64211111111' });

    const notifs = await mongoose.connection.collections.notifications
      .find({ userId: new mongoose.Types.ObjectId(ownerId) })
      .toArray();
    expect(notifs.length).toBeGreaterThanOrEqual(1);
    expect(notifs[0].type).toBe('pet_found');
  });

  it('POST /api/finder/:tagId/notify marks pet as found if lost', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, { status: 'lost' });
    await createTag(ownerId, petId, { tagId: 'TAG-NOTIFY-FOUND' });

    await request(app)
      .post('/api/finder/TAG-NOTIFY-FOUND/notify')
      .send({ finderPhone: '+64211111111' });

    const pet = await mongoose.connection.collections.pets.findOne({ _id: new mongoose.Types.ObjectId(petId) });
    expect(pet?.status).toBe('found');
    expect(pet?.foundByFinderAt).toBeDefined();
  });

  it('POST /api/finder/:tagId/notify returns 404 for non-existent tag', async () => {
    const res = await request(app)
      .post('/api/finder/FAKE-TAG/notify')
      .send({ finderPhone: '+64211111111' });

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════
// SHARE LOCATION
// ═══════════════════════════════════════════

describe('Integration: Finder - Share Location', () => {
  it('POST /api/finder/:tagId/share-location requires coordinates', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId);
    await createTag(ownerId, petId, { tagId: 'TAG-LOC-001' });

    const res = await request(app)
      .post('/api/finder/TAG-LOC-001/share-location')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/coordinates/i);
  });

  it('POST /api/finder/:tagId/share-location saves location event', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId);
    await createTag(ownerId, petId, { tagId: 'TAG-LOC-SAVE' });

    const res = await request(app)
      .post('/api/finder/TAG-LOC-SAVE/share-location')
      .send({ latitude: -36.8485, longitude: 174.7633 });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/location/i);

    const locations = await mongoose.connection.collections.locationevents.find({}).toArray();
    expect(locations).toHaveLength(1);
    expect(locations[0].location.latitude).toBe(-36.8485);
  });

  it('POST /api/finder/:tagId/share-location updates tag scan info', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId);
    await createTag(ownerId, petId, { tagId: 'TAG-LOC-UPDATE' });

    await request(app)
      .post('/api/finder/TAG-LOC-UPDATE/share-location')
      .send({ latitude: -36.85, longitude: 174.76 });

    const tag = await mongoose.connection.collections.tags.findOne({ tagId: 'TAG-LOC-UPDATE' });
    expect(tag?.lastScanLocation).toBeDefined();
    expect(tag?.lastScanLocation.latitude).toBe(-36.85);
  });

  it('POST /api/finder/:tagId/share-location returns 404 for non-existent tag', async () => {
    const res = await request(app)
      .post('/api/finder/FAKE-TAG/share-location')
      .send({ latitude: -36.85, longitude: 174.76 });

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════
// FOUND TIMER
// ═══════════════════════════════════════════

describe('Integration: Finder - Found Timer', () => {
  it('GET /api/finder/:tagId/found-timer returns inactive for lost pet', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, { status: 'lost' });
    await createTag(ownerId, petId, { tagId: 'TAG-TIMER-001' });

    const res = await request(app).get('/api/finder/TAG-TIMER-001/found-timer');

    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);
  });

  it('GET /api/finder/:tagId/found-timer returns active for found pet', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, { status: 'found' });
    await createTag(ownerId, petId, { tagId: 'TAG-TIMER-ACTIVE' });

    const foundAt = new Date(Date.now() - 3600000);
    await mongoose.connection.collections.pets.updateOne(
      { _id: new mongoose.Types.ObjectId(petId) },
      { $set: { foundByFinderAt: foundAt } }
    );

    const res = await request(app).get('/api/finder/TAG-TIMER-ACTIVE/found-timer');

    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(true);
    expect(res.body.data.elapsed).toBeGreaterThan(0);
  });

  it('GET /api/finder/:tagId/found-timer returns 404 for non-existent tag', async () => {
    const res = await request(app).get('/api/finder/FAKE/found-timer');
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════
// SHOP PRODUCTS (Public)
// ═══════════════════════════════════════════

describe('Integration: Finder - Shop Products', () => {
  it('GET /api/finder/shop/products returns empty array with no products', async () => {
    const res = await request(app).get('/api/finder/shop/products');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('GET /api/finder/shop/products returns active products', async () => {
    await mongoose.connection.collections.products.insertOne({
      name: 'PawTag Classic',
      slug: 'pawtag-classic',
      description: 'Classic QR tag',
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

    const res = await request(app).get('/api/finder/shop/products');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('PawTag Classic');
  });

  it('GET /api/finder/shop/products does not return inactive products', async () => {
    await mongoose.connection.collections.products.insertOne({
      name: 'Inactive Product',
      slug: 'inactive',
      description: 'Hidden',
      price: 9.99,
      sku: 'IN-001',
      category: 'tags',
      stock: 10,
      isActive: false,
      images: [],
      variants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app).get('/api/finder/shop/products');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('GET /api/finder/shop/products/:id returns specific product', async () => {
    const product = await mongoose.connection.collections.products.insertOne({
      name: 'PawTag Pro',
      slug: 'pawtag-pro',
      description: 'Premium tag',
      price: 39.99,
      sku: 'PT-PR-001',
      category: 'tags',
      stock: 30,
      isActive: true,
      images: [],
      variants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app).get(`/api/finder/shop/products/${product.insertedId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('PawTag Pro');
  });

  it('GET /api/finder/shop/products/:id returns 404 for non-existent', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/finder/shop/products/${fakeId}`);
    expect(res.status).toBe(404);
  });
});

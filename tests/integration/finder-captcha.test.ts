import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';

// Store original NODE_ENV
const originalEnv = process.env.NODE_ENV;

async function createCustomer(overrides: Partial<{ email: string; fullName: string }> = {}) {
  const email = overrides.email || 'owner-captcha@example.com';
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
    petId: overrides.petId || 'PET-CAPTCHA-001',
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
    tagId: overrides.tagId || 'TAG-CAPTCHA-001',
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
  process.env.NODE_ENV = originalEnv;
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

// ═══════════════════════════════════════════
// CAPTCHA ENFORCEMENT IN PRODUCTION
// ═══════════════════════════════════════════

describe('Integration: Finder CAPTCHA Production Contract', () => {
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('POST /api/finder/:tagId/notify rejects request without CAPTCHA in production', async () => {
    process.env.NODE_ENV = 'production';

    const ownerId = await createCustomer();
    const petId = await createPet(ownerId);
    await createTag(ownerId, petId, { tagId: 'TAG-CAPTCHA-NO-CAPTCHA' });

    const res = await request(app)
      .post('/api/finder/TAG-CAPTCHA-NO-CAPTCHA/notify')
      .send({ finderPhone: '+64211111111', finderName: 'Finder' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('CAPTCHA_REQUIRED');
  });

  it('POST /api/finder/:tagId/notify rejects request with invalid CAPTCHA answer in production', async () => {
    process.env.NODE_ENV = 'production';

    const ownerId = await createCustomer();
    const petId = await createPet(ownerId);
    await createTag(ownerId, petId, { tagId: 'TAG-CAPTCHA-BAD-ANSWER' });

    // Generate a valid token with answer=10, but send wrong answer
    const token = jwt.sign({ captchaAnswer: 10 }, config.jwtSecret, { expiresIn: '5m' });

    const res = await request(app)
      .post('/api/finder/TAG-CAPTCHA-BAD-ANSWER/notify')
      .send({
        finderPhone: '+64211111111',
        finderName: 'Finder',
        captchaToken: token,
        captchaAnswer: 999, // wrong answer
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/captcha/i);
  });

  it('POST /api/finder/:tagId/notify rejects expired CAPTCHA token in production', async () => {
    process.env.NODE_ENV = 'production';

    const ownerId = await createCustomer();
    const petId = await createPet(ownerId);
    await createTag(ownerId, petId, { tagId: 'TAG-CAPTCHA-EXPIRED' });

    // Generate a token that's already expired (expiresIn: 0s)
    const token = jwt.sign({ captchaAnswer: 5 }, config.jwtSecret, { expiresIn: '0s' });
    // Wait a moment to ensure expiry
    await new Promise(resolve => setTimeout(resolve, 1100));

    const res = await request(app)
      .post('/api/finder/TAG-CAPTCHA-EXPIRED/notify')
      .send({
        finderPhone: '+64211111111',
        finderName: 'Finder',
        captchaToken: token,
        captchaAnswer: 5,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/expired/i);
  });

  it('POST /api/finder/:tagId/notify succeeds with valid CAPTCHA in production', async () => {
    process.env.NODE_ENV = 'production';

    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, { status: 'lost' });
    await createTag(ownerId, petId, { tagId: 'TAG-CAPTCHA-VALID' });

    // Generate a valid token with known answer
    const answer = 7;
    const token = jwt.sign({ captchaAnswer: answer }, config.jwtSecret, { expiresIn: '5m' });

    const res = await request(app)
      .post('/api/finder/TAG-CAPTCHA-VALID/notify')
      .send({
        finderPhone: '+64211111111',
        finderName: 'Finder',
        captchaToken: token,
        captchaAnswer: answer,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toMatch(/notified/i);
  });

  it('POST /api/finder/:tagId/notify succeeds without CAPTCHA in test mode', async () => {
    process.env.NODE_ENV = 'test';

    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, { status: 'lost' });
    await createTag(ownerId, petId, { tagId: 'TAG-CAPTCHA-TEST-MODE' });

    const res = await request(app)
      .post('/api/finder/TAG-CAPTCHA-TEST-MODE/notify')
      .send({ finderPhone: '+64211111111', finderName: 'Finder' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/finder/:tagId/notify succeeds without CAPTCHA in development mode', async () => {
    process.env.NODE_ENV = 'development';

    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, { status: 'lost' });
    await createTag(ownerId, petId, { tagId: 'TAG-CAPTCHA-DEV-MODE' });

    const res = await request(app)
      .post('/api/finder/TAG-CAPTCHA-DEV-MODE/notify')
      .send({ finderPhone: '+64211111111', finderName: 'Finder' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════
// CAPTCHA ENDPOINT
// ═══════════════════════════════════════════

describe('Integration: Finder CAPTCHA Endpoint', () => {
  it('GET /api/auth/captcha returns a challenge question and token', async () => {
    const res = await request(app).get('/api/auth/captcha');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.question).toMatch(/What is \d+/);
    expect(res.body.data.token).toBeDefined();
  });

  it('GET /api/auth/captcha token can be verified', async () => {
    const res = await request(app).get('/api/auth/captcha');
    const { token } = res.body.data;

    const decoded = jwt.verify(token, config.jwtSecret) as { captchaAnswer: number };
    expect(typeof decoded.captchaAnswer).toBe('number');
  });
});

// ═══════════════════════════════════════════
// DUPLICATE SUBMISSION PROTECTION
// ═══════════════════════════════════════════

describe('Integration: Finder CAPTCHA - Duplicate Protection', () => {
  it('rapid duplicate notify requests create separate notifications but do not crash', async () => {
    process.env.NODE_ENV = 'production';

    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, { status: 'lost' });
    await createTag(ownerId, petId, { tagId: 'TAG-CAPTCHA-DUPE' });

    const answer = 3;
    const token = jwt.sign({ captchaAnswer: answer }, config.jwtSecret, { expiresIn: '5m' });

    // Send two rapid requests with same CAPTCHA token
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/finder/TAG-CAPTCHA-DUPE/notify')
        .send({
          finderPhone: '+64211111111',
          finderName: 'Finder 1',
          captchaToken: token,
          captchaAnswer: answer,
        }),
      request(app)
        .post('/api/finder/TAG-CAPTCHA-DUPE/notify')
        .send({
          finderPhone: '+64211111111',
          finderName: 'Finder 2',
          captchaToken: token,
          captchaAnswer: answer,
        }),
    ]);

    // Both should succeed (CAPTCHA is valid for both)
    // The rate limiter may reject one, but neither should crash with CAPTCHA errors
    const statuses = [res1.status, res2.status];
    expect(statuses.every(s => s === 200 || s === 429)).toBe(true);
  });
});

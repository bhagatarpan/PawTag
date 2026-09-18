import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';

async function createCustomer(overrides: Partial<{ email: string; fullName: string }> = {}) {
  const email = overrides.email || `idempotent-${Date.now()}@example.com`;
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
    petId: overrides.petId || 'PET-IDEMP-001',
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
    tagId: overrides.tagId || 'TAG-IDEMP-001',
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
// FINDER NOTIFY IDEMPOTENCY
// ═══════════════════════════════════════════

describe('Integration: Finder Notify Idempotency', () => {
  it('duplicate notify with same contact info returns existing notification', async () => {
    const ownerId = await createCustomer({ email: 'idemp-owner-1@example.com' });
    const petId = await createPet(ownerId, { status: 'lost' });
    await createTag(ownerId, petId, { tagId: 'TAG-IDEMP-001' });

    // First notify
    const res1 = await request(app)
      .post('/api/finder/TAG-IDEMP-001/notify')
      .send({ finderPhone: '+64211111111', finderName: 'Finder' });

    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);

    // Second notify with same contact info (duplicate)
    const res2 = await request(app)
      .post('/api/finder/TAG-IDEMP-001/notify')
      .send({ finderPhone: '+64211111111', finderName: 'Finder' });

    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
    expect(res2.body.data.duplicate).toBe(true);
  });

  it('duplicate notify does NOT create duplicate notifications', async () => {
    const ownerId = await createCustomer({ email: 'idemp-owner-2@example.com' });
    const petId = await createPet(ownerId, { status: 'lost' });
    await createTag(ownerId, petId, { tagId: 'TAG-IDEMP-002' });

    // First notify
    await request(app)
      .post('/api/finder/TAG-IDEMP-002/notify')
      .send({ finderPhone: '+64211111111', finderName: 'Finder' });

    // Second notify (duplicate)
    await request(app)
      .post('/api/finder/TAG-IDEMP-002/notify')
      .send({ finderPhone: '+64211111111', finderName: 'Finder' });

    // Should only have ONE notification
    const notifications = await mongoose.connection.collections.notifications
      .find({ type: 'pet_found' })
      .toArray();
    expect(notifications).toHaveLength(1);
  });

  it('duplicate notify does NOT create duplicate escalation records', async () => {
    const ownerId = await createCustomer({ email: 'idemp-owner-3@example.com' });
    const petId = await createPet(ownerId, { status: 'lost' });
    await createTag(ownerId, petId, { tagId: 'TAG-IDEMP-003' });

    // First notify
    await request(app)
      .post('/api/finder/TAG-IDEMP-003/notify')
      .send({ finderPhone: '+64211111111', finderName: 'Finder' });

    // Second notify (duplicate)
    await request(app)
      .post('/api/finder/TAG-IDEMP-003/notify')
      .send({ finderPhone: '+64211111111', finderName: 'Finder' });

    // Should only have ONE escalation record
    const escalations = await mongoose.connection.collections.escalationrecords
      .find({})
      .toArray();
    expect(escalations).toHaveLength(1);
  });

  it('different contact info creates separate notifications', async () => {
    const ownerId = await createCustomer({ email: 'idemp-owner-4@example.com' });
    const petId = await createPet(ownerId, { status: 'lost' });
    await createTag(ownerId, petId, { tagId: 'TAG-IDEMP-004' });

    // First notify with phone
    await request(app)
      .post('/api/finder/TAG-IDEMP-004/notify')
      .send({ finderPhone: '+64211111111', finderName: 'Finder 1' });

    // Second notify with different phone
    await request(app)
      .post('/api/finder/TAG-IDEMP-004/notify')
      .send({ finderPhone: '+64222222222', finderName: 'Finder 2' });

    // Should have TWO notifications (different finders)
    const notifications = await mongoose.connection.collections.notifications
      .find({ type: 'pet_found' })
      .toArray();
    expect(notifications).toHaveLength(2);
  });

  it('rapid sequential retries produce one logical notification', async () => {
    const ownerId = await createCustomer({ email: 'idemp-owner-5@example.com' });
    const petId = await createPet(ownerId, { status: 'lost' });
    await createTag(ownerId, petId, { tagId: 'TAG-IDEMP-005' });

    // Simulate rapid sequential retries (common browser retry pattern)
    const res1 = await request(app)
      .post('/api/finder/TAG-IDEMP-005/notify')
      .send({ finderPhone: '+64211111111', finderName: 'Finder' });

    const res2 = await request(app)
      .post('/api/finder/TAG-IDEMP-005/notify')
      .send({ finderPhone: '+64211111111', finderName: 'Finder' });

    const res3 = await request(app)
      .post('/api/finder/TAG-IDEMP-005/notify')
      .send({ finderPhone: '+64211111111', finderName: 'Finder' });

    // All should succeed
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);
    expect(res2.body.data.duplicate).toBe(true);
    expect(res3.body.data.duplicate).toBe(true);

    // But only ONE notification should exist
    const notifications = await mongoose.connection.collections.notifications
      .find({ type: 'pet_found' })
      .toArray();
    expect(notifications).toHaveLength(1);
  });
});

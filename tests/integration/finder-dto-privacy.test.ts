import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';

async function createCustomer(overrides: Partial<{ email: string; fullName: string }> = {}) {
  const email = overrides.email || `finder-dto-${Date.now()}@example.com`;
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
    petId: overrides.petId || 'PET-DTO-001',
    name: overrides.name || 'Buddy',
    petType: overrides.petType || 'Dog',
    species: overrides.species || 'dog',
    breed: overrides.breed || 'Golden Retriever',
    color: overrides.color || 'Golden',
    gender: overrides.gender || 'male',
    status: overrides.status || 'lost',
    lostCount: overrides.lostCount || 1,
    medicalAlerts: overrides.medicalAlerts || 'Diabetic - needs insulin',
    favouriteFood: overrides.favouriteFood || 'Chicken',
    vaccinations: overrides.vaccinations || [{
      vaccine: 'Rabies',
      vaccineType: 'core',
      dateGiven: '2024-01-15',
      vetClinic: 'Auckland Vet Clinic',
      batchLotNumber: 'RAB-12345',
      veterinarian: 'Dr. Smith',
    }],
    microchips: overrides.microchips || [{
      chipNumber: 'NZ123456789',
      brand: 'HomeAgain',
      implantDate: '2023-06-01',
      implantLocation: 'Between shoulder blades',
      implantedBy: 'Dr. Johnson',
    }],
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return pet.insertedId.toString();
}

async function createTag(ownerId: string, petId: string, overrides: Record<string, any> = {}) {
  const tag = await mongoose.connection.collections.tags.insertOne({
    tagId: overrides.tagId || 'TAG-DTO-001',
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
// FINDER DTO — SENSITIVE FIELDS EXCLUDED
// ═══════════════════════════════════════════

describe('Integration: Finder DTO Privacy', () => {
  it('does NOT expose internal petId', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, { petId: 'INTERNAL-PET-123' });
    await createTag(ownerId, petId, { tagId: 'TAG-PRIV-001' });

    const res = await request(app).get('/api/finder/TAG-PRIV-001');

    expect(res.status).toBe(200);
    expect(res.body.data.pet).toBeDefined();
    expect(res.body.data.pet.petId).toBeUndefined();
  });

  it('does NOT expose vaccinations array', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, {
      vaccinations: [{
        vaccine: 'Rabies',
        vetClinic: 'Auckland Vet Clinic',
        batchLotNumber: 'RAB-12345',
      }],
    });
    await createTag(ownerId, petId, { tagId: 'TAG-PRIV-002' });

    const res = await request(app).get('/api/finder/TAG-PRIV-002');

    expect(res.status).toBe(200);
    expect(res.body.data.pet.vaccinations).toBeUndefined();
  });

  it('does NOT expose microchips array', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, {
      microchips: [{
        chipNumber: 'NZ123456789',
        brand: 'HomeAgain',
      }],
    });
    await createTag(ownerId, petId, { tagId: 'TAG-PRIV-003' });

    const res = await request(app).get('/api/finder/TAG-PRIV-003');

    expect(res.status).toBe(200);
    expect(res.body.data.pet.microchips).toBeUndefined();
  });

  it('does NOT expose favouriteFood', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, { favouriteFood: 'Chicken' });
    await createTag(ownerId, petId, { tagId: 'TAG-PRIV-004' });

    const res = await request(app).get('/api/finder/TAG-PRIV-004');

    expect(res.status).toBe(200);
    expect(res.body.data.pet.favouriteFood).toBeUndefined();
  });

  it('does NOT expose breedOrigin', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, { breedOrigin: 'New Zealand' });
    await createTag(ownerId, petId, { tagId: 'TAG-PRIV-005' });

    const res = await request(app).get('/api/finder/TAG-PRIV-005');

    expect(res.status).toBe(200);
    expect(res.body.data.pet.breedOrigin).toBeUndefined();
  });

  it('does NOT expose secondaryBreed', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, { secondaryBreed: 'Labrador' });
    await createTag(ownerId, petId, { tagId: 'TAG-PRIV-006' });

    const res = await request(app).get('/api/finder/TAG-PRIV-006');

    expect(res.status).toBe(200);
    expect(res.body.data.pet.secondaryBreed).toBeUndefined();
  });

  it('DOES expose medicalAlerts (owner-approved)', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, { medicalAlerts: 'Diabetic - needs insulin' });
    await createTag(ownerId, petId, { tagId: 'TAG-PRIV-007' });

    const res = await request(app).get('/api/finder/TAG-PRIV-007');

    expect(res.status).toBe(200);
    expect(res.body.data.pet.medicalAlerts).toBe('Diabetic - needs insulin');
  });

  it('DOES expose basic identification fields', async () => {
    const ownerId = await createCustomer();
    const petId = await createPet(ownerId, {
      name: 'Rex',
      species: 'dog',
      breed: 'German Shepherd',
      color: 'Black and Tan',
    });
    await createTag(ownerId, petId, { tagId: 'TAG-PRIV-008' });

    const res = await request(app).get('/api/finder/TAG-PRIV-008');

    expect(res.status).toBe(200);
    expect(res.body.data.pet.name).toBe('Rex');
    expect(res.body.data.pet.species).toBe('dog');
    expect(res.body.data.pet.breed).toBe('German Shepherd');
    expect(res.body.data.pet.color).toBe('Black and Tan');
    expect(res.body.data.pet.status).toBe('lost');
  });

  it('does NOT expose owner phone for safe pets in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const ownerId = await createCustomer({ fullName: 'John Owner' });
      const petId = await createPet(ownerId, { status: 'safe' });
      await createTag(ownerId, petId, { tagId: 'TAG-PRIV-009' });

      const res = await request(app).get('/api/finder/TAG-PRIV-009');

      expect(res.status).toBe(200);
      expect(res.body.data.ownerPhone).toBeNull();
      expect(res.body.data.safePetMasking).toBe(true);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

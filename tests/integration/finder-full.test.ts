import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
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
// TAG LOOKUP — GET /api/finder/:tagId
// ═══════════════════════════════════════════

describe('Integration: Finder Full - Tag Lookup', () => {
  it('returns pet and owner info for a valid active tag', async () => {
    const { userId } = await createCustomerWithRBAC({ fullName: 'Alice Owner' });
    const petId = await createPet(userId, { name: 'Rex', species: 'dog', breed: 'Labrador', status: 'lost' });
    await createTag(userId, petId, { tagId: 'TAG-HAPPY-001', status: 'active' });

    const res = await request(app).get('/api/finder/TAG-HAPPY-001');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pet.name).toBe('Rex');
    expect(res.body.data.pet.species).toBe('dog');
    expect(res.body.data.pet.breed).toBe('Labrador');
    expect(res.body.data.pet.status).toBe('lost');
    expect(res.body.data.ownerName).toBe('Alice Owner');
    expect(res.body.data.tagId).toBe('TAG-HAPPY-001');
    expect(res.body.data.tagStatus).toBe('active');
  });

  it('returns 404 for a non-existent tag', async () => {
    const res = await request(app).get('/api/finder/DOESNOTEXIST');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 404 for a soft-deleted tag', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId);
    const tagId = await createTag(userId, petId, { tagId: 'TAG-DELETED' });

    await mongoose.connection.collections.tags.updateOne(
      { _id: new mongoose.Types.ObjectId(tagId) },
      { $set: { deletedAt: new Date() } }
    );

    const res = await request(app).get('/api/finder/TAG-DELETED');

    expect(res.status).toBe(404);
  });

  it('returns limited info for expired subscription', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId, { name: 'Ghost', status: 'safe' });
    await createTag(userId, petId, { tagId: 'TAG-EXPIRED' });

    await mongoose.connection.collections.tags.updateOne(
      { tagId: 'TAG-EXPIRED' },
      { $set: { subscriptionStatus: 'expired' } }
    );

    const res = await request(app).get('/api/finder/TAG-EXPIRED');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tagActive).toBe(false);
    expect(res.body.data.subscriptionStatus).toBe('expired');
    expect(res.body.data.petInfo).toBeNull();
    expect(res.body.data.message).toMatch(/no longer active/i);
  });

  it('treats tag with subscriptionStatus "none" as active', async () => {
    const { userId } = await createCustomerWithRBAC({ fullName: 'Free User' });
    const petId = await createPet(userId, { name: 'Buddy' });
    await createTag(userId, petId, { tagId: 'TAG-FREE', subscriptionStatus: 'none' });

    const res = await request(app).get('/api/finder/TAG-FREE');

    expect(res.status).toBe(200);
    expect(res.body.data.pet.name).toBe('Buddy');
    expect(res.body.data.ownerName).toBe('Free User');
  });

  it('treats tag with subscriptionStatus "grace_period" as active', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId, { name: 'Grace' });
    await createTag(userId, petId, { tagId: 'TAG-GRACE', subscriptionStatus: 'grace_period' });

    const res = await request(app).get('/api/finder/TAG-GRACE');

    expect(res.status).toBe(200);
    expect(res.body.data.pet.name).toBe('Grace');
  });

  it('logs a FinderScan with action "viewed" on lookup', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId);
    await createTag(userId, petId, { tagId: 'TAG-SCAN-LOG' });

    await request(app)
      .get('/api/finder/TAG-SCAN-LOG')
      .set('User-Agent', 'FinderApp/2.0');

    const scans = await mongoose.connection.collections.finderscans
      .find({ action: 'viewed' })
      .toArray();
    expect(scans.length).toBeGreaterThanOrEqual(1);
    expect(scans[0].deviceInfo).toBe('FinderApp/2.0');
  });

  it('updates tag lastScannedAt timestamp on lookup', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId);
    await createTag(userId, petId, { tagId: 'TAG-TIMESTAMP' });

    await request(app).get('/api/finder/TAG-TIMESTAMP');

    const tag = await mongoose.connection.collections.tags.findOne({ tagId: 'TAG-TIMESTAMP' });
    expect(tag?.lastScannedAt).toBeDefined();
  });
});

// ═══════════════════════════════════════════
// NOTIFY OWNER — POST /api/finder/:tagId/notify
// ═══════════════════════════════════════════

describe('Integration: Finder Full - Notify Owner', () => {
  it('returns 400 when neither phone nor email provided', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId);
    await createTag(userId, petId, { tagId: 'TAG-NF-001' });

    const res = await request(app)
      .post('/api/finder/TAG-NF-001/notify')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/phone|email/i);
  });

  it('returns 404 for a non-existent tag', async () => {
    const res = await request(app)
      .post('/api/finder/FAKE-TAG-999/notify')
      .send({ finderPhone: '+64211111111' });

    expect(res.status).toBe(404);
  });

  it('creates a notification with phone contact info', async () => {
    const { userId } = await createCustomerWithRBAC({ fullName: 'Notify Owner' });
    const petId = await createPet(userId, { name: 'Ziggy', status: 'lost' });
    await createTag(userId, petId, { tagId: 'TAG-NF-PHONE' });

    const res = await request(app)
      .post('/api/finder/TAG-NF-PHONE/notify')
      .send({ finderPhone: '+64215556666', finderName: 'Finder Phil' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.petFound).toBe(true);

    const notifs = await mongoose.connection.collections.notifications
      .find({ userId: new mongoose.Types.ObjectId(userId) })
      .toArray();
    expect(notifs.length).toBeGreaterThanOrEqual(1);
    expect(notifs[0].type).toBe('pet_found');
  });

  it('creates a notification with email contact info', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId, { status: 'lost' });
    await createTag(userId, petId, { tagId: 'TAG-NF-EMAIL' });

    const res = await request(app)
      .post('/api/finder/TAG-NF-EMAIL/notify')
      .send({ finderEmail: 'finder@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('creates a notification with both phone and email', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId, { name: 'Zara', status: 'lost' });
    await createTag(userId, petId, { tagId: 'TAG-NF-BOTH' });

    const res = await request(app)
      .post('/api/finder/TAG-NF-BOTH/notify')
      .send({ finderPhone: '+64217778888', finderEmail: 'both@test.com', finderName: 'Double Finder' });

    expect(res.status).toBe(200);

    const notifs = await mongoose.connection.collections.notifications
      .find({ userId: new mongoose.Types.ObjectId(userId) })
      .toArray();
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });

  it('auto-marks pet as found when status was lost', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId, { status: 'lost' });
    await createTag(userId, petId, { tagId: 'TAG-NF-FOUND' });

    await request(app)
      .post('/api/finder/TAG-NF-FOUND/notify')
      .send({ finderPhone: '+64219990000' });

    const pet = await mongoose.connection.collections.pets.findOne({ _id: new mongoose.Types.ObjectId(petId) });
    expect(pet?.status).toBe('found');
    expect(pet?.foundByFinderAt).toBeDefined();
  });

  it('saves location when GPS coordinates included in notify', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId, { status: 'lost' });
    await createTag(userId, petId, { tagId: 'TAG-NF-LOC' });

    const res = await request(app)
      .post('/api/finder/TAG-NF-LOC/notify')
      .send({
        finderPhone: '+64213334444',
        latitude: -36.8485,
        longitude: 174.7633,
        accuracy: 15,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.locationShared).toBe(true);

    const locations = await mongoose.connection.collections.locationevents.find({}).toArray();
    expect(locations).toHaveLength(1);
    expect(locations[0].location.latitude).toBe(-36.8485);
    expect(locations[0].location.longitude).toBe(174.7633);
  });

  it('stores consent data in scan record when provided', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId, { status: 'lost' });
    await createTag(userId, petId, { tagId: 'TAG-NF-CONSENT' });

    await request(app).get('/api/finder/TAG-NF-CONSENT');

    await request(app)
      .post('/api/finder/TAG-NF-CONSENT/notify')
      .send({
        finderPhone: '+64215550000',
        consent: {
          locationConsent: 'granted',
          consentVersion: '1.0',
        },
      });

    const tag = await mongoose.connection.collections.tags.findOne({ tagId: 'TAG-NF-CONSENT' });
    const scan = await mongoose.connection.collections.finderscans.findOne({ tagId: tag?._id });
    expect(scan?.consent).toBeDefined();
    expect(scan?.consent?.locationConsent).toBe('granted');
  });
});

// ═══════════════════════════════════════════
// LOCATION SHARING — POST /api/finder/:tagId/share-location
// ═══════════════════════════════════════════

describe('Integration: Finder Full - Location Sharing', () => {
  it('returns 400 when latitude is missing', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId);
    await createTag(userId, petId, { tagId: 'TAG-LOC-001' });

    const res = await request(app)
      .post('/api/finder/TAG-LOC-001/share-location')
      .send({ longitude: 174.7633 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/coordinates/i);
  });

  it('returns 400 when longitude is missing', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId);
    await createTag(userId, petId, { tagId: 'TAG-LOC-002' });

    const res = await request(app)
      .post('/api/finder/TAG-LOC-002/share-location')
      .send({ latitude: -36.8485 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when body is empty', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId);
    await createTag(userId, petId, { tagId: 'TAG-LOC-003' });

    const res = await request(app)
      .post('/api/finder/TAG-LOC-003/share-location')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent tag', async () => {
    const res = await request(app)
      .post('/api/finder/DOESNOTEXIST/share-location')
      .send({ latitude: -36.8485, longitude: 174.7633 });

    expect(res.status).toBe(404);
  });

  it('saves a LocationEvent with valid coordinates', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId);
    await createTag(userId, petId, { tagId: 'TAG-LOC-SAVE' });

    const res = await request(app)
      .post('/api/finder/TAG-LOC-SAVE/share-location')
      .send({ latitude: -36.8485, longitude: 174.7633, accuracy: 10 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toMatch(/location/i);

    const events = await mongoose.connection.collections.locationevents.find({}).toArray();
    expect(events).toHaveLength(1);
    expect(events[0].location.latitude).toBe(-36.8485);
    expect(events[0].location.longitude).toBe(174.7633);
    expect(events[0].location.source).toBe('qr_scan');
  });

  it('updates tag lastScanLocation with shared coordinates', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId);
    await createTag(userId, petId, { tagId: 'TAG-LOC-TAG' });

    await request(app)
      .post('/api/finder/TAG-LOC-TAG/share-location')
      .send({ latitude: -37.0, longitude: 175.0 });

    const tag = await mongoose.connection.collections.tags.findOne({ tagId: 'TAG-LOC-TAG' });
    expect(tag?.lastScanLocation).toBeDefined();
    expect(tag?.lastScanLocation.latitude).toBe(-37.0);
    expect(tag?.lastScanLocation.longitude).toBe(175.0);
    expect(tag?.lastScannedAt).toBeDefined();
  });
});

// ═══════════════════════════════════════════
// STATS — GET /api/finder/stats
// ═══════════════════════════════════════════

describe('Integration: Finder Full - Stats', () => {
  it('returns all stat fields with zero counts on empty DB', async () => {
    const res = await request(app).get('/api/finder/stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.petsProtected).toBe(0);
    expect(res.body.data.tagsSold).toBe(0);
    expect(res.body.data.activeTags).toBe(0);
    expect(res.body.data.totalScans).toBe(0);
    expect(res.body.data.reunions).toBe(0);
    expect(res.body.data.lostPets).toBe(0);
    expect(res.body.data.registeredUsers).toBe(0);
  });

  it('counts pets, tags, and users after seeding data', async () => {
    const { userId } = await createCustomerWithRBAC({ email: 'stat-user@test.com' });
    await createPet(userId, { status: 'lost' });
    await createTag(userId, (await mongoose.connection.collections.pets.findOne({ ownerId: new mongoose.Types.ObjectId(userId) }))?._id.toString() || '', { status: 'active' });

    const res = await request(app).get('/api/finder/stats');

    expect(res.status).toBe(200);
    expect(res.body.data.petsProtected).toBeGreaterThanOrEqual(1);
    expect(res.body.data.tagsSold).toBeGreaterThanOrEqual(1);
    expect(res.body.data.activeTags).toBeGreaterThanOrEqual(1);
    expect(res.body.data.registeredUsers).toBeGreaterThanOrEqual(1);
  });

  it('counts lost and found pets correctly', async () => {
    const { userId } = await createCustomerWithRBAC({ email: 'stat-pets@test.com' });
    const lostPetId = await createPet(userId, { status: 'lost', name: 'LostDog', petId: 'PET-LOST-001' });
    const foundPetId = await createPet(userId, { status: 'found', name: 'FoundCat', petId: 'PET-FOUND-001' });
    await createTag(userId, lostPetId, { tagId: 'TAG-LOST-001' });
    await createTag(userId, foundPetId, { tagId: 'TAG-FOUND-001' });

    const res = await request(app).get('/api/finder/stats');

    expect(res.body.data.lostPets).toBeGreaterThanOrEqual(1);
    expect(res.body.data.reunions).toBeGreaterThanOrEqual(1);
  });

  it('increments scan count after a tag lookup', async () => {
    const { userId } = await createCustomerWithRBAC({ email: 'stat-scan@test.com' });
    const petId = await createPet(userId);
    await createTag(userId, petId, { tagId: 'TAG-STAT-SCAN' });

    await request(app).get('/api/finder/TAG-STAT-SCAN');

    const res = await request(app).get('/api/finder/stats');
    expect(res.body.data.totalScans).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════
// FOUND TIMER — GET /api/finder/:tagId/found-timer
// ═══════════════════════════════════════════

describe('Integration: Finder Full - Found Timer', () => {
  it('returns inactive for a lost pet', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId, { status: 'lost' });
    await createTag(userId, petId, { tagId: 'TAG-FT-001' });

    const res = await request(app).get('/api/finder/TAG-FT-001/found-timer');

    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);
  });

  it('returns active with elapsed time for a found pet', async () => {
    const { userId } = await createCustomerWithRBAC();
    const petId = await createPet(userId, { status: 'found' });
    await createTag(userId, petId, { tagId: 'TAG-FT-ACTIVE' });

    const foundAt = new Date(Date.now() - 7200000);
    await mongoose.connection.collections.pets.updateOne(
      { _id: new mongoose.Types.ObjectId(petId) },
      { $set: { foundByFinderAt: foundAt } }
    );

    const res = await request(app).get('/api/finder/TAG-FT-ACTIVE/found-timer');

    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(true);
    expect(res.body.data.elapsed).toBeGreaterThanOrEqual(7200000);
    expect(res.body.data.foundAt).toBeDefined();
  });

  it('returns 404 for a non-existent tag', async () => {
    const res = await request(app).get('/api/finder/NONEXISTENT-TIMER/found-timer');
    expect(res.status).toBe(404);
  });
});

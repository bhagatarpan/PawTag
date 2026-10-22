import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { createCustomerWithRBAC, seedActivationEntitlements, seedMembershipEntitlements } from './helpers';
import { membershipEntitlementService } from '../../packages/api/src/services/membership-entitlement.service';

/**
 * Free 3-Month Activation entitlements (docs/ACTIVATION-ENTITLEMENTS.md):
 * a tag buyer inside the Active Period gets feature benefits through the
 * REGISTRY (no hand-rolled route cases); money perks stay off; the window,
 * released tags, and paid memberships all resolve correctly.
 */

async function createPet(ownerId: string, overrides: Record<string, any> = {}) {
  const pet = await mongoose.connection.collections.pets.insertOne({
    ownerId: new mongoose.Types.ObjectId(ownerId),
    petId: overrides.petId || 'PET-ACT-001',
    name: overrides.name || 'Buddy',
    petType: 'Dog',
    species: 'dog',
    breed: 'Golden Retriever',
    color: 'Golden',
    gender: 'male',
    status: overrides.status || 'lost',
    medicalAlerts: overrides.medicalAlerts,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return pet.insertedId.toString();
}

async function createTag(ownerId: string, petId: string, overrides: Record<string, any> = {}) {
  const now = new Date();
  const activePeriodEndsAt =
    overrides.activePeriodEndsAt ?? new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const tag = await mongoose.connection.collections.tags.insertOne({
    tagId: overrides.tagId || `TAG-ACT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    petId: new mongoose.Types.ObjectId(petId),
    ownerId: new mongoose.Types.ObjectId(ownerId),
    status: overrides.status || 'active',
    tagType: 'qr',
    subscriptionStatus: 'none',
    activatedAt: now,
    activePeriodEndsAt,
    warrantyEndsAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
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
  // Module-level cache survives DB clears inside one file run
  membershipEntitlementService.invalidateCache();
});

describe('health records across benefit contexts', () => {
  it('a free-activation tag buyer can read health records (the promise on the product card)', async () => {
    await seedActivationEntitlements();
    const { userId, token } = await createCustomerWithRBAC({ email: 'act-health@example.com', skipMembership: true });
    const petId = await createPet(userId);
    await createTag(userId, petId); // active tag, window open

    const res = await request(app)
      .get(`/api/customer/pets/${petId}/vaccinations`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('health records LOCK once the 3-month window ends (✦ upsell path)', async () => {
    await seedActivationEntitlements();
    const { userId, token } = await createCustomerWithRBAC({ email: 'act-expired@example.com', skipMembership: true });
    const petId = await createPet(userId);
    await createTag(userId, petId, { activePeriodEndsAt: new Date(Date.now() - 60 * 1000) });

    const res = await request(app)
      .get(`/api/customer/pets/${petId}/vaccinations`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/membership benefit/i);
    expect(res.body.upgradeUrl).toBe('/membership');
  });

  it('a released (cancelled) tag grants NO activation — tag-release regression', async () => {
    await seedActivationEntitlements();
    const { userId, token } = await createCustomerWithRBAC({ email: 'act-released@example.com', skipMembership: true });
    const petId = await createPet(userId);
    // Window still open by date, but the tag was released with its order
    await createTag(userId, petId, { status: 'cancelled' });

    const res = await request(app)
      .get(`/api/customer/pets/${petId}/vaccinations`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('paid members keep access regardless of tags (member regression)', async () => {
    await seedActivationEntitlements();
    const { userId, token } = await createCustomerWithRBAC({ email: 'act-member@example.com' }); // auto Platinum membership
    const petId = await createPet(userId);

    const res = await request(app)
      .get(`/api/customer/pets/${petId}/vaccinations`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

describe('GET /api/membership/entitlements — the PetCard lock source', () => {
  it('serves the activation map for a free-activation user', async () => {
    await seedActivationEntitlements();
    const { userId, token } = await createCustomerWithRBAC({ email: 'act-ent-map@example.com', skipMembership: true });
    const petId = await createPet(userId);
    await createTag(userId, petId);

    const res = await request(app)
      .get('/api/membership/entitlements')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tier).toBeNull();
    // Same shape the Health button gate reads
    expect(res.body.data.entitlements.pet_health_records.enabled).toBe(true);
    expect(res.body.data.entitlements.pet_health_records.value).toBe(true);
    // Money perks off during activation
    expect(res.body.data.entitlements.free_shipping_threshold.enabled).toBe(false);
  });

  it('returns an empty map for a user with neither membership nor active tag', async () => {
    const { token } = await createCustomerWithRBAC({ email: 'act-none@example.com', skipMembership: true });

    const res = await request(app)
      .get('/api/membership/entitlements')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.entitlements).toEqual({});
  });
});

describe('finder surfaces are registry-driven (hand-patch removed)', () => {
  it('medical alerts are VISIBLE to finders for an activation user', async () => {
    await seedActivationEntitlements();
    const { userId } = await createCustomerWithRBAC({ email: 'act-finder@example.com', skipMembership: true });
    const petId = await createPet(userId, { medicalAlerts: 'Severe peanut allergy — carries an EpiPen' });
    await createTag(userId, petId, { tagId: 'TAG-ACT-MEDICAL' });

    const res = await request(app).get('/api/finder/TAG-ACT-MEDICAL');

    expect(res.status).toBe(200);
    expect(res.body.data.pet.medicalAlerts).toContain('EpiPen');
  });

  it('medical alerts are hidden once the window ends (existing safety rule)', async () => {
    await seedActivationEntitlements();
    const { userId } = await createCustomerWithRBAC({ email: 'act-finder-exp@example.com', skipMembership: true });
    const petId = await createPet(userId, { medicalAlerts: 'Severe peanut allergy' });
    await createTag(userId, petId, {
      tagId: 'TAG-ACT-MEDICAL-EXP',
      activePeriodEndsAt: new Date(Date.now() - 60 * 1000),
    });

    const res = await request(app).get('/api/finder/TAG-ACT-MEDICAL-EXP');

    expect(res.status).toBe(200);
    // Outside the Active Period the tag is not findable at all — no pet data
    expect(res.body.data.tagActive).toBe(false);
    expect(res.body.data.pet).toBeUndefined();
    expect(res.body.data.petInfo).toBeNull();
  });

  it('finder notify creates the owner notification for an activation user via the registry (patch removed)', async () => {
    await seedActivationEntitlements();
    const { userId } = await createCustomerWithRBAC({ email: 'act-notify@example.com', skipMembership: true });
    const petId = await createPet(userId, { name: 'Milo', status: 'lost' });
    await createTag(userId, petId, { tagId: 'TAG-ACT-NOTIFY' });

    const res = await request(app)
      .post('/api/finder/TAG-ACT-NOTIFY/notify')
      .send({ finderPhone: '+64213333333', finderName: 'Finder Activation' });

    expect(res.status).toBe(200);
    const notifs = await mongoose.connection.collections.notifications
      .find({ userId: new mongoose.Types.ObjectId(userId), type: 'pet_found' })
      .toArray();
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });
});

describe('context precedence', () => {
  it('a paid membership always wins over the activation window', async () => {
    await seedActivationEntitlements();
    const { userId } = await createCustomerWithRBAC({ email: 'act-precedence@example.com' }); // auto Platinum
    const petId = await createPet(userId);
    await createTag(userId, petId);

    const context = await membershipEntitlementService.getUserBenefitContext(userId);
    expect(context).toBe('platinum');
  });

  it('seedMembershipEntitlements users (auto Platinum) are unaffected by activation rows', async () => {
    const { userId } = await createCustomerWithRBAC({ email: 'act-regression@example.com', skipMembership: true });
    await seedMembershipEntitlements(userId);
    await seedActivationEntitlements();

    expect(await membershipEntitlementService.hasAccess(userId, 'pet_health_records')).toBe(true);
  });
});

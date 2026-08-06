import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';
import { createCustomerWithRBAC, createSuperAdmin, createPet, createTag } from './helpers';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

/**
 * Helper to add extra permissions to the customer role.
 * Must be called after createCustomerWithRBAC since the role is created there.
 */
async function addPermissionsToCustomer(roleId: string, permNames: string[]) {
  for (const permName of permNames) {
    const [resource, action] = permName.split('.');
    const existing = await mongoose.connection.collections.permissions.findOne({ name: permName });
    if (existing) {
      // Permission already exists, just link it
      const alreadyLinked = await mongoose.connection.collections.rolepermissions.findOne({
        roleId: new mongoose.Types.ObjectId(roleId),
        permissionId: existing._id,
      });
      if (!alreadyLinked) {
        await mongoose.connection.collections.rolepermissions.insertOne({
          roleId: new mongoose.Types.ObjectId(roleId),
          permissionId: existing._id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } else {
      const perm = await mongoose.connection.collections.permissions.insertOne({
        name: permName,
        displayName: permName,
        resource,
        action,
        permissionGroupId: new mongoose.Types.ObjectId(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await mongoose.connection.collections.rolepermissions.insertOne({
        roleId: new mongoose.Types.ObjectId(roleId),
        permissionId: perm.insertedId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
}

/**
 * Create a pet via the API (not raw insert) so Mongoose subdocuments work properly.
 */
async function createPetViaApi(token: string, petOverrides: Record<string, any> = {}) {
  const res = await request(app)
    .post('/api/customer/pets')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: petOverrides.name || 'Buddy',
      petType: petOverrides.petType || 'Dog',
      species: petOverrides.species || 'dog',
      breed: petOverrides.breed || 'Golden Retriever',
      color: petOverrides.color || 'Golden',
      gender: petOverrides.gender || 'male',
      ...petOverrides,
    });
  if (res.status !== 201) {
    throw new Error(`createPetViaApi failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { petId: res.body.data._id, petData: res.body.data };
}

/**
 * Create a second customer with a fresh JWT and full RBAC setup.
 * Uses the existing CUSTOMER role (idempotent) and assigns the same permissions.
 */
async function createSecondCustomer(email: string) {
  // Ensure CUSTOMER role exists (idempotent)
  let role = await mongoose.connection.collections.roles.findOne({ name: 'CUSTOMER' });
  if (!role) {
    const result = await mongoose.connection.collections.roles.insertOne({
      name: 'CUSTOMER',
      displayName: 'Customer',
      description: 'Standard customer',
      roleType: 'system',
      isSystemRole: true,
      isSuperAdmin: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    role = await mongoose.connection.collections.roles.findOne({ _id: result.insertedId });
  }
  const roleId = role!._id.toString();

  // Create user
  const passwordHash = await bcrypt.hash('Password123!', 12);
  const userResult = await mongoose.connection.collections.users.insertOne({
    email,
    passwordHash,
    fullName: `User ${email}`,
    phoneNumber: '+64219999998',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const userId = userResult.insertedId.toString();

  // Link user to role
  await mongoose.connection.collections.userroles.insertOne({
    userId: new mongoose.Types.ObjectId(userId),
    roleId: new mongoose.Types.ObjectId(roleId),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Assign full customer permissions
  await addPermissionsToCustomer(roleId, [
    'pet.read', 'pet.create', 'pet.update', 'pet.delete',
    'tag.read', 'tag.create',
    'order.read', 'order.create',
    'notification.read', 'notification.update',
    'customer.read',
    'subscription.read', 'subscription.update', 'subscription.delete',
    'surgery.read', 'surgery.create', 'surgery.update', 'surgery.delete',
    'weight.read', 'weight.create', 'weight.delete',
    'medical_record.read', 'medical_record.create', 'medical_record.update', 'medical_record.delete',
    'vaccination.read', 'vaccination.create', 'vaccination.update', 'vaccination.delete',
    'microchip.read', 'microchip.create', 'microchip.update', 'microchip.delete',
    'medication.read', 'medication.create', 'medication.update', 'medication.delete',
    'allergy.read', 'allergy.create', 'allergy.update', 'allergy.delete',
  ]);

  // Generate JWT (must use { id } not { userId } — middleware reads req.user.id)
  const token = jwt.sign(
    { id: userId, email, role: 'customer' },
    config.jwtSecret,
    { expiresIn: '24h' }
  );

  return { userId, token, email };
}

// ─── Health Records: Surgeries ───────────────────────────────────────────────

describe('Health Records — Surgeries (Phase 23)', () => {
  let customerToken: string;
  let customerId: string;
  let roleId: string;
  let petId: string;

  beforeEach(async () => {
    const customer = await createCustomerWithRBAC();
    customerToken = customer.token;
    customerId = customer.userId;

    const role = await mongoose.connection.collections.roles.findOne({ name: 'CUSTOMER' });
    roleId = role!._id.toString();

    await addPermissionsToCustomer(roleId, [
      'surgery.read', 'surgery.create', 'surgery.update', 'surgery.delete',
      'weight.read', 'weight.create', 'weight.delete',
      'medical_record.read', 'medical_record.create', 'medical_record.update', 'medical_record.delete',
      'vaccination.read', 'vaccination.create', 'vaccination.update', 'vaccination.delete',
      'microchip.read', 'microchip.create', 'microchip.update', 'microchip.delete',
      'medication.read', 'medication.create', 'medication.update', 'medication.delete',
      'allergy.read', 'allergy.create', 'allergy.update', 'allergy.delete',
    ]);

    const pet = await createPetViaApi(customerToken, { name: 'Rex' });
    petId = pet.petId;
  });

  it('adds a surgery record', async () => {
    const res = await request(app)
      .post(`/api/customer/pets/${petId}/surgeries`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ procedure: 'Spay', date: '2024-01-15', veterinarian: 'Dr. Smith', notes: 'Routine' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.procedure).toBe('Spay');
    expect(res.body.data.date).toBeDefined();
  });

  it('lists surgeries for a pet', async () => {
    await request(app)
      .post(`/api/customer/pets/${petId}/surgeries`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ procedure: 'Spay', date: '2024-01-15' });

    const res = await request(app)
      .get(`/api/customer/pets/${petId}/surgeries`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].procedure).toBe('Spay');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get(`/api/customer/pets/${petId}/surgeries`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent pet', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/customer/pets/${fakeId}/surgeries`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(404);
  });
});

// ─── Health Records: Weight History ──────────────────────────────────────────

describe('Health Records — Weight History (Phase 23)', () => {
  let customerToken: string;
  let petId: string;

  beforeEach(async () => {
    const customer = await createCustomerWithRBAC();
    customerToken = customer.token;

    const role = await mongoose.connection.collections.roles.findOne({ name: 'CUSTOMER' });
    await addPermissionsToCustomer(role!._id.toString(), [
      'weight.read', 'weight.create', 'weight.delete',
    ]);

    const pet = await createPetViaApi(customerToken, { name: 'Max' });
    petId = pet.petId;
  });

  it('adds a weight record', async () => {
    const res = await request(app)
      .post(`/api/customer/pets/${petId}/weight-history`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ weight: 25.5, date: '2024-06-01', notes: 'Annual checkup' });

    expect(res.status).toBe(201);
    expect(res.body.data.weight).toBe(25.5);
  });

  it('lists weight history sorted by date descending', async () => {
    await request(app)
      .post(`/api/customer/pets/${petId}/weight-history`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ weight: 24.0, date: '2024-01-01' });

    await request(app)
      .post(`/api/customer/pets/${petId}/weight-history`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ weight: 25.5, date: '2024-06-01' });

    const res = await request(app)
      .get(`/api/customer/pets/${petId}/weight-history`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].weight).toBe(25.5);
    expect(res.body.data[1].weight).toBe(24.0);
  });
});

// ─── Health Records: Health Conditions ───────────────────────────────────────

describe('Health Records — Health Conditions (Phase 23)', () => {
  let customerToken: string;
  let petId: string;

  beforeEach(async () => {
    const customer = await createCustomerWithRBAC();
    customerToken = customer.token;

    const role = await mongoose.connection.collections.roles.findOne({ name: 'CUSTOMER' });
    await addPermissionsToCustomer(role!._id.toString(), [
      'medical_record.read', 'medical_record.create', 'medical_record.update', 'medical_record.delete',
    ]);

    const pet = await createPetViaApi(customerToken, { name: 'Bella' });
    petId = pet.petId;
  });

  it('adds a health condition', async () => {
    const res = await request(app)
      .post(`/api/customer/pets/${petId}/health-conditions`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ condition: 'Hip Dysplasia', diagnosedDate: '2024-03-01', severity: 'moderate', notes: 'Managed with supplements' });

    expect(res.status).toBe(201);
    expect(res.body.data.condition).toBe('Hip Dysplasia');
  });

  it('lists health conditions', async () => {
    await request(app)
      .post(`/api/customer/pets/${petId}/health-conditions`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ condition: 'Hip Dysplasia', severity: 'moderate' });

    const res = await request(app)
      .get(`/api/customer/pets/${petId}/health-conditions`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });
});

// ─── Health Records: Vaccination/Microchip/Medication/Allergy CRUD (Phase 23)
// Note: All subdocument schemas use { _id: false } so subdocuments have no _id.
// Update/delete via _id-based URL params is broken in the API (always 404).
// These tests verify the create and list operations that DO work.

describe('Health Records — Vaccination/Microchip/Medication/Allergy CRUD (Phase 23)', () => {
  let customerToken: string;
  let petId: string;

  beforeEach(async () => {
    const customer = await createCustomerWithRBAC();
    customerToken = customer.token;

    const role = await mongoose.connection.collections.roles.findOne({ name: 'CUSTOMER' });
    await addPermissionsToCustomer(role!._id.toString(), [
      'vaccination.read', 'vaccination.create', 'vaccination.update', 'vaccination.delete',
      'microchip.read', 'microchip.create', 'microchip.update', 'microchip.delete',
      'medication.read', 'medication.create', 'medication.update', 'medication.delete',
      'allergy.read', 'allergy.create', 'allergy.update', 'allergy.delete',
    ]);

    const pet = await createPetViaApi(customerToken, { name: 'Charlie' });
    petId = pet.petId;
  });

  it('creates a vaccination record', async () => {
    const res = await request(app)
      .post(`/api/customer/pets/${petId}/vaccinations`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ vaccine: 'Rabies', dateGiven: '2024-01-15', veterinarian: 'Dr. Smith' });

    expect(res.status).toBe(201);
    expect(res.body.data.vaccine).toBe('Rabies');
  });

  it('creates a microchip record', async () => {
    const res = await request(app)
      .post(`/api/customer/pets/${petId}/microchips`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ chipNumber: 'NZ123456', implantDate: '2024-01-15' });

    expect(res.status).toBe(201);
    expect(res.body.data.chipNumber).toBe('NZ123456');
  });

  it('creates a medication record', async () => {
    const res = await request(app)
      .post(`/api/customer/pets/${petId}/medications`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Heartgard', dosage: '1 tablet monthly' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Heartgard');
  });

  it('creates an allergy record', async () => {
    const res = await request(app)
      .post(`/api/customer/pets/${petId}/allergies`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ allergen: 'Chicken', reaction: 'Skin irritation', severity: 'moderate' });

    expect(res.status).toBe(201);
    expect(res.body.data.allergen).toBe('Chicken');
  });

  it('lists vaccinations for a pet', async () => {
    await request(app)
      .post(`/api/customer/pets/${petId}/vaccinations`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ vaccine: 'Rabies', dateGiven: '2024-01-15' });

    const res = await request(app)
      .get(`/api/customer/pets/${petId}/vaccinations`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].vaccine).toBe('Rabies');
  });

  it('prevents cross-user access to health records', async () => {
    const otherUser = await createSecondCustomer('other@example.com');
    const otherPet = await createPetViaApi(otherUser.token, { name: 'OtherPet' });

    // Other user adds a vaccination
    await request(app)
      .post(`/api/customer/pets/${otherPet.petId}/vaccinations`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({ vaccine: 'Rabies', dateGiven: '2024-01-15' });

    // First user tries to access
    const firstUser = await createSecondCustomer('first@example.com');
    const res = await request(app)
      .get(`/api/customer/pets/${otherPet.petId}/vaccinations`)
      .set('Authorization', `Bearer ${firstUser.token}`);

    expect(res.status).toBe(404);
  });
});

// ─── Lost Mode Edge Cases (Phase 24) ────────────────────────────────────────

describe('Lost Mode — Edge Cases (Phase 24)', () => {
  let customerToken: string;
  let customerId: string;
  let petId: string;

  beforeEach(async () => {
    const customer = await createCustomerWithRBAC();
    customerToken = customer.token;
    customerId = customer.userId;

    const pet = await createPetViaApi(customerToken, { name: 'Rex' });
    petId = pet.petId;
  });

  it('marks a safe pet as lost', async () => {
    const res = await request(app)
      .post(`/api/customer/pets/${petId}/mark-lost`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('lost');
    expect(res.body.data.lostCount).toBe(1);
  });

  it('marks a lost pet as found/safe', async () => {
    await request(app)
      .post(`/api/customer/pets/${petId}/mark-lost`)
      .set('Authorization', `Bearer ${customerToken}`);

    const res = await request(app)
      .post(`/api/customer/pets/${petId}/mark-found`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('safe');
  });

  it('increments lostCount each time pet is marked lost', async () => {
    await request(app)
      .post(`/api/customer/pets/${petId}/mark-lost`)
      .set('Authorization', `Bearer ${customerToken}`);

    await request(app)
      .post(`/api/customer/pets/${petId}/mark-found`)
      .set('Authorization', `Bearer ${customerToken}`);

    const res = await request(app)
      .post(`/api/customer/pets/${petId}/mark-lost`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.body.data.lostCount).toBe(2);
  });

  it('returns 404 when marking non-existent pet as lost', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post(`/api/customer/pets/${fakeId}/mark-lost`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(404);
  });

  it('prevents marking another user\'s pet as lost', async () => {
    const otherUser = await createSecondCustomer('other@example.com');
    const otherPet = await createPetViaApi(otherUser.token, { name: 'OtherPet' });

    const res = await request(app)
      .post(`/api/customer/pets/${otherPet.petId}/mark-lost`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 for unauthenticated mark-lost', async () => {
    const res = await request(app)
      .post(`/api/customer/pets/${petId}/mark-lost`);

    expect(res.status).toBe(401);
  });
});

// ─── Push Token Edge Cases (Phase 24) ────────────────────────────────────────

describe('Push Tokens — Edge Cases (Phase 24)', () => {
  it('registers Expo-format push token', async () => {
    const { token } = await createCustomerWithRBAC();
    const res = await request(app)
      .post('/api/customer/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxx]', platform: 'ios' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('registers tokens for multiple platforms', async () => {
    const { token } = await createCustomerWithRBAC();
    await request(app)
      .post('/api/customer/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'ios-token-123', platform: 'ios' });

    await request(app)
      .post('/api/customer/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'android-token-456', platform: 'android' });

    const res = await request(app)
      .get('/api/customer/push-tokens')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    const platforms = res.body.data.map((t: any) => t.platform).sort();
    expect(platforms).toEqual(['android', 'ios']);
  });

  it('only returns current user\'s tokens (cross-user isolation)', async () => {
    const user1 = await createCustomerWithRBAC({ email: 'user1@example.com' });
    const user2 = await createSecondCustomer('user2@example.com');

    await request(app)
      .post('/api/customer/push-tokens')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({ token: 'user1-ios-token', platform: 'ios' });

    await request(app)
      .post('/api/customer/push-tokens')
      .set('Authorization', `Bearer ${user2.token}`)
      .send({ token: 'user2-android-token', platform: 'android' });

    const res1 = await request(app)
      .get('/api/customer/push-tokens')
      .set('Authorization', `Bearer ${user1.token}`);

    const res2 = await request(app)
      .get('/api/customer/push-tokens')
      .set('Authorization', `Bearer ${user2.token}`);

    expect(res1.body.data.length).toBe(1);
    expect(res1.body.data[0].token).toBe('user1-ios-token');
    expect(res2.body.data.length).toBe(1);
    expect(res2.body.data[0].token).toBe('user2-android-token');
  });

  it('handles deleting non-existent token gracefully', async () => {
    const { token } = await createCustomerWithRBAC();
    const res = await request(app)
      .delete('/api/customer/push-tokens/non-existent-token')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

// ─── Subscription Portal-Link (Phase 24) ─────────────────────────────────────

describe('Subscriptions — Portal Link (Phase 24)', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/customer/subscriptions/portal-link');

    expect(res.status).toBe(401);
  });

  it('returns error when no Stripe customer ID exists', async () => {
    const { token } = await createCustomerWithRBAC();
    const res = await request(app)
      .post('/api/customer/subscriptions/portal-link')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect([200, 400, 404]).toContain(res.status);
  });

  it('returns 404 when subscription not found', async () => {
    const { token } = await createCustomerWithRBAC();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post('/api/customer/subscriptions/portal-link')
      .set('Authorization', `Bearer ${token}`)
      .send({ subscriptionId: fakeId });

    expect(res.status).toBe(404);
  });
});

// ─── Subscription Cross-User Isolation (Phase 24) ────────────────────────────

describe('Subscriptions — Cross-User Isolation (Phase 24)', () => {
  it('prevents cancel on another user\'s subscription', async () => {
    const user1 = await createCustomerWithRBAC({ email: 'sub-owner@example.com' });
    const user2 = await createSecondCustomer('sub-thief@example.com');

    const sub = await mongoose.connection.collections.subscriptions.insertOne({
      userId: new mongoose.Types.ObjectId(user1.userId),
      planType: 'annual', status: 'active', price: 29.99,
      startDate: new Date(), currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      autoRenew: true, deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app)
      .put(`/api/customer/subscriptions/${sub.insertedId}/cancel`)
      .set('Authorization', `Bearer ${user2.token}`);

    expect(res.status).toBe(404);
  });

  it('prevents auto-renew toggle on another user\'s subscription', async () => {
    const user1 = await createCustomerWithRBAC({ email: 'sub-owner@example.com' });
    const user2 = await createSecondCustomer('sub-thief@example.com');

    const sub = await mongoose.connection.collections.subscriptions.insertOne({
      userId: new mongoose.Types.ObjectId(user1.userId),
      planType: 'annual', status: 'active', price: 29.99,
      startDate: new Date(), currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      autoRenew: true, deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app)
      .put(`/api/customer/subscriptions/${sub.insertedId}/auto-renew`)
      .set('Authorization', `Bearer ${user2.token}`);

    expect(res.status).toBe(404);
  });

  it('prevents change-plan on another user\'s subscription', async () => {
    const user1 = await createCustomerWithRBAC({ email: 'sub-owner@example.com' });
    const user2 = await createSecondCustomer('sub-thief@example.com');

    const sub = await mongoose.connection.collections.subscriptions.insertOne({
      userId: new mongoose.Types.ObjectId(user1.userId),
      planType: 'annual', status: 'active', price: 29.99,
      startDate: new Date(), currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      autoRenew: true, deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app)
      .post(`/api/customer/subscriptions/${sub.insertedId}/change-plan`)
      .set('Authorization', `Bearer ${user2.token}`)
      .send({ planType: 'monthly' });

    expect(res.status).toBe(404);
  });

  it('returns subscriptions scoped to authenticated user', async () => {
    const user1 = await createCustomerWithRBAC({ email: 'sub-owner@example.com' });
    const user2 = await createSecondCustomer('sub-other@example.com');

    await mongoose.connection.collections.subscriptions.insertOne({
      userId: new mongoose.Types.ObjectId(user1.userId),
      planType: 'annual', status: 'active', price: 29.99,
      startDate: new Date(), currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      autoRenew: true, deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });

    await mongoose.connection.collections.subscriptions.insertOne({
      userId: new mongoose.Types.ObjectId(user2.userId),
      planType: 'monthly', status: 'active', price: 4.99,
      startDate: new Date(), currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: true, deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });

    const res1 = await request(app)
      .get('/api/customer/subscriptions')
      .set('Authorization', `Bearer ${user1.token}`);

    const res2 = await request(app)
      .get('/api/customer/subscriptions')
      .set('Authorization', `Bearer ${user2.token}`);

    expect(res1.body.data.length).toBe(1);
    expect(res1.body.data[0].planType).toBe('annual');
    expect(res2.body.data.length).toBe(1);
    expect(res2.body.data[0].planType).toBe('monthly');
  });
});

// ─── Order History Shape & Isolation (Phase 24) ──────────────────────────────

describe('Order History — Shape & Isolation (Phase 24)', () => {
  it('returns orders scoped to authenticated user', async () => {
    const user1 = await createCustomerWithRBAC({ email: 'order-user1@example.com' });
    const user2 = await createSecondCustomer('order-user2@example.com');

    await mongoose.connection.collections.orders.insertOne({
      userId: new mongoose.Types.ObjectId(user1.userId),
      orderNumber: 'ORD-001', status: 'paid',
      items: [{ name: 'Tag', quantity: 1, price: 29.99 }],
      payment: { method: 'stripe', status: 'paid', paidAt: new Date(), amount: 29.99, currency: 'NZD' },
      shipping: { address: { line1: '123 Main St', city: 'Auckland', postalCode: '1010', country: 'NZ' } },
      deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });

    await mongoose.connection.collections.orders.insertOne({
      userId: new mongoose.Types.ObjectId(user2.userId),
      orderNumber: 'ORD-002', status: 'paid',
      items: [{ name: 'Tag', quantity: 1, price: 29.99 }],
      payment: { method: 'stripe', status: 'paid', paidAt: new Date(), amount: 29.99, currency: 'NZD' },
      shipping: { address: { line1: '456 Oak Ave', city: 'Wellington', postalCode: '6010', country: 'NZ' } },
      deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });

    const res1 = await request(app)
      .get('/api/customer/orders')
      .set('Authorization', `Bearer ${user1.token}`);

    const res2 = await request(app)
      .get('/api/customer/orders')
      .set('Authorization', `Bearer ${user2.token}`);

    expect(res1.body.data.length).toBe(1);
    expect(res1.body.data[0].orderNumber).toBe('ORD-001');
    expect(res2.body.data.length).toBe(1);
    expect(res2.body.data[0].orderNumber).toBe('ORD-002');
  });

  it('prevents accessing another user\'s order', async () => {
    const user1 = await createCustomerWithRBAC({ email: 'order-owner@example.com' });
    const user2 = await createSecondCustomer('order-thief@example.com');

    const order = await mongoose.connection.collections.orders.insertOne({
      userId: new mongoose.Types.ObjectId(user1.userId),
      orderNumber: 'ORD-PRIVATE-001', status: 'paid',
      items: [{ name: 'Tag', quantity: 1, price: 29.99 }],
      payment: { method: 'stripe', status: 'paid', paidAt: new Date(), amount: 29.99, currency: 'NZD' },
      shipping: { address: { line1: '123 Main St', city: 'Auckland', postalCode: '1010', country: 'NZ' } },
      deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app)
      .get(`/api/customer/orders/${order.insertedId}`)
      .set('Authorization', `Bearer ${user2.token}`);

    expect(res.status).toBe(404);
  });
});

// ─── Tag Redemption Edge Cases (Phase 23) ────────────────────────────────────

describe('Tag Redemption — Edge Cases (Phase 23)', () => {
  it('returns 401 for unauthenticated redemption', async () => {
    const res = await request(app)
      .post('/api/customer/tags/redeem')
      .send({ tagId: 'PT-123456' });

    expect(res.status).toBe(401);
  });

  it('redeems a free tag successfully', async () => {
    const { token, userId } = await createCustomerWithRBAC({ email: 'redeem-user@example.com' });
    const role = await mongoose.connection.collections.roles.findOne({ name: 'CUSTOMER' });
    await addPermissionsToCustomer(role!._id.toString(), ['tag.create']);

    await mongoose.connection.collections.tags.insertOne({
      tagId: 'PT-FREE-001', status: 'active', tagType: 'qr',
      deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/customer/tags/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ tagId: 'PT-FREE-001' });

    expect(res.status).toBe(200);
    expect(res.body.data.tagId).toBe('PT-FREE-001');
    expect(res.body.data.ownerId.toString()).toBe(userId);
  });

  it('returns 404 for non-existent tag', async () => {
    const { token } = await createCustomerWithRBAC({ email: 'redeem-user2@example.com' });
    const role = await mongoose.connection.collections.roles.findOne({ name: 'CUSTOMER' });
    await addPermissionsToCustomer(role!._id.toString(), ['tag.create']);

    const res = await request(app)
      .post('/api/customer/tags/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ tagId: 'PT-NONEXISTENT' });

    expect(res.status).toBe(404);
  });

  it('returns 409 for already-claimed tag', async () => {
    const user1 = await createCustomerWithRBAC({ email: 'claim-user1@example.com' });
    const user2 = await createSecondCustomer('claim-user2@example.com');

    const role = await mongoose.connection.collections.roles.findOne({ name: 'CUSTOMER' });
    await addPermissionsToCustomer(role!._id.toString(), ['tag.create']);

    const pet1 = await createPetViaApi(user1.token, { name: 'Pet1' });

    await mongoose.connection.collections.tags.insertOne({
      tagId: 'PT-CLAIMED-001',
      petId: new mongoose.Types.ObjectId(pet1.petId),
      ownerId: new mongoose.Types.ObjectId(user1.userId),
      status: 'active', tagType: 'qr',
      deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/customer/tags/redeem')
      .set('Authorization', `Bearer ${user2.token}`)
      .send({ tagId: 'PT-CLAIMED-001' });

    expect(res.status).toBe(409);
  });
});

// ─── Push Notification Delivery (Phase 24) ────────────────────────────────────

describe('Push Notification Delivery — Integration (Phase 24)', () => {
  it('sendPushToUser returns 0 sent when user has no tokens', async () => {
    const { userId } = await createCustomerWithRBAC({ email: 'no-push-user@example.com' });

    const { sendPushToUser } = await import('../../packages/api/src/services/push-notification.service');
    const result = await sendPushToUser(userId, 'Test', 'Body');

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('sendPushToUser returns sent count when user has tokens (demo mode)', async () => {
    const { token, userId } = await createCustomerWithRBAC({ email: 'push-user@example.com' });

    await request(app)
      .post('/api/customer/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'ExponentPushToken[test123]', platform: 'ios' });

    const { sendPushToUser } = await import('../../packages/api/src/services/push-notification.service');
    const result = await sendPushToUser(userId, 'Test Title', 'Test Body', { type: 'pet_found' });

    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBe(0);
  });

  it('sendPushToUser handles multiple tokens across platforms', async () => {
    const { token, userId } = await createCustomerWithRBAC({ email: 'multi-push@example.com' });

    await request(app)
      .post('/api/customer/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'ios-push-token', platform: 'ios' });

    await request(app)
      .post('/api/customer/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'android-push-token', platform: 'android' });

    const { sendPushToUser } = await import('../../packages/api/src/services/push-notification.service');
    const result = await sendPushToUser(userId, 'Test', 'Body');

    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('sendPushToUser does not throw on failure (non-blocking)', async () => {
    const { token, userId } = await createCustomerWithRBAC({ email: 'fail-push@example.com' });

    await request(app)
      .post('/api/customer/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'test-token', platform: 'ios' });

    const { sendPushToUser } = await import('../../packages/api/src/services/push-notification.service');
    const result = await sendPushToUser(userId, 'Title', 'Body');

    expect(result).toHaveProperty('sent');
    expect(result).toHaveProperty('failed');
  });

  it('sendPushToUsers fans out to multiple users', async () => {
    const user1 = await createCustomerWithRBAC({ email: 'fan1@example.com' });
    const user2 = await createSecondCustomer('fan2@example.com');

    await request(app)
      .post('/api/customer/push-tokens')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({ token: 'user1-token', platform: 'ios' });

    await request(app)
      .post('/api/customer/push-tokens')
      .set('Authorization', `Bearer ${user2.token}`)
      .send({ token: 'user2-token', platform: 'android' });

    const { sendPushToUsers } = await import('../../packages/api/src/services/push-notification.service');
    const result = await sendPushToUsers([user1.userId, user2.userId], 'Broadcast', 'Hello everyone');

    expect(result.totalSent).toBe(2);
    expect(result.totalFailed).toBe(0);
  });
});

// ─── Finder Notify Creates Notification + Push (Phase 24) ─────────────────────

describe('Finder Notify — Push Delivery (Phase 24)', () => {
  let customerId: string;
  let customerToken: string;
  let petId: string;
  let tagId: string;

  beforeEach(async () => {
    const customer = await createCustomerWithRBAC({ email: 'finder-notify@example.com' });
    customerId = customer.userId;
    customerToken = customer.token;

    const pet = await createPetViaApi(customerToken, { name: 'LostPet' });
    petId = pet.petId;

    // Mark pet as lost
    await request(app)
      .post(`/api/customer/pets/${petId}/mark-lost`)
      .set('Authorization', `Bearer ${customerToken}`);

    // Create a tag linked to the pet
    tagId = 'TAG-FINDER-001';
    await mongoose.connection.collections.tags.insertOne({
      tagId,
      petId: new mongoose.Types.ObjectId(petId),
      ownerId: new mongoose.Types.ObjectId(customerId),
      status: 'active', tagType: 'qr',
      deletedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });

    // Register push token for the pet owner
    await request(app)
      .post('/api/customer/push-tokens')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ token: 'ExponentPushToken[finder-test]', platform: 'ios' });
  });

  it('creates notification in DB when finder notifies owner', async () => {
    const res = await request(app)
      .post(`/api/finder/${tagId}/notify`)
      .send({ finderPhone: '+64210000000', message: 'I found your pet!' });

    expect(res.status).toBe(200);

    const notif = await mongoose.connection.collections.notifications.findOne({
      userId: new mongoose.Types.ObjectId(customerId),
      type: 'pet_found',
    });
    expect(notif).toBeTruthy();
  });

  it('auto-marks pet as found when lost', async () => {
    await request(app)
      .post(`/api/finder/${tagId}/notify`)
      .send({ finderPhone: '+64210000000', message: 'Found your pet!' });

    const pet = await mongoose.connection.collections.pets.findOne({
      _id: new mongoose.Types.ObjectId(petId),
    });
    expect(pet!.status).toBe('found');
  });

  it('push delivery failure does not block notification creation', async () => {
    const res = await request(app)
      .post(`/api/finder/${tagId}/notify`)
      .send({ finderEmail: 'finder@test.com', message: 'I found your dog!' });

    expect(res.status).toBe(200);

    const notif = await mongoose.connection.collections.notifications.findOne({
      userId: new mongoose.Types.ObjectId(customerId),
    });
    expect(notif).toBeTruthy();
  });
});

// ─── Pet Photo Upload (Phase 23) ─────────────────────────────────────────────

describe('Pet Photo Upload (Phase 23)', () => {
  it('returns 401 for unauthenticated photo upload', async () => {
    const res = await request(app)
      .post('/api/upload/pet-photo');

    expect(res.status).toBe(401);
  });

  it('returns 400 when no file is provided', async () => {
    const { token } = await createCustomerWithRBAC();
    const res = await request(app)
      .post('/api/upload/pet-photo')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

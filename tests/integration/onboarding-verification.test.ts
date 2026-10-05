import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';

async function createUserWithFlags(
  overrides: Partial<{
    email: string;
    password: string;
    fullName: string;
    phoneNumber: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    status: string;
  }> = {},
) {
  const email = overrides.email || `onboarding-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const passwordHash = await bcrypt.hash(overrides.password || 'Password123!', 12);

  const user = await mongoose.connection.collections.users.insertOne({
    email,
    passwordHash,
    fullName: overrides.fullName || 'Onboarding User',
    phoneNumber: overrides.phoneNumber || '+64215550100',
    role: 'customer',
    status: overrides.status || 'active',
    emailVerified: overrides.emailVerified ?? true,
    phoneVerified: overrides.phoneVerified ?? true,
    responsibilityScore: 0,
    onboardingCompleted: false,
    onboardingSkipped: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const userId = user.insertedId.toString();

  // RBAC: customer routes require pet.read (same as createCustomerWithRBAC)
  let role = await mongoose.connection.collections.roles.findOne({ name: 'CUSTOMER' });
  if (!role) {
    const roleResult = await mongoose.connection.collections.roles.insertOne({
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
    role = await mongoose.connection.collections.roles.findOne({ _id: roleResult.insertedId });
  }
  const roleId = role!._id.toString();

  let perm = await mongoose.connection.collections.permissions.findOne({ name: 'pet.read' });
  if (!perm) {
    const permResult = await mongoose.connection.collections.permissions.insertOne({
      name: 'pet.read',
      displayName: 'pet.read',
      resource: 'pet',
      action: 'read',
      permissionGroupId: new mongoose.Types.ObjectId(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    perm = await mongoose.connection.collections.permissions.findOne({ _id: permResult.insertedId });
  }
  const permId = perm!._id.toString();

  const existingLink = await mongoose.connection.collections.rolepermissions.findOne({
    roleId: new mongoose.Types.ObjectId(roleId),
    permissionId: new mongoose.Types.ObjectId(permId),
  });
  if (!existingLink) {
    await mongoose.connection.collections.rolepermissions.insertOne({
      roleId: new mongoose.Types.ObjectId(roleId),
      permissionId: new mongoose.Types.ObjectId(permId),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const existingUserRole = await mongoose.connection.collections.userroles.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    roleId: new mongoose.Types.ObjectId(roleId),
  });
  if (!existingUserRole) {
    await mongoose.connection.collections.userroles.insertOne({
      userId: new mongoose.Types.ObjectId(userId),
      roleId: new mongoose.Types.ObjectId(roleId),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const token = jwt.sign(
    { id: userId, email, role: 'customer' },
    config.jwtSecret,
    { expiresIn: '1h' },
  );

  return { userId, token, email };
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

describe('Integration: Onboarding verification gate + home address', () => {
  it('PUT onboarding-complete blocks when phone is unverified (admin-created style)', async () => {
    const { token } = await createUserWithFlags({
      emailVerified: true,
      phoneVerified: false,
      status: 'active',
    });

    const res = await request(app)
      .put('/api/customer/settings/onboarding-complete')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('REQUIRES_VERIFICATION');
    expect(res.body.data.emailVerified).toBe(true);
    expect(res.body.data.phoneVerified).toBe(false);
  });

  it('PUT onboarding-complete blocks when email is unverified', async () => {
    const { token } = await createUserWithFlags({
      emailVerified: false,
      phoneVerified: true,
      status: 'active',
    });

    const res = await request(app)
      .put('/api/customer/settings/onboarding-complete')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('REQUIRES_VERIFICATION');
  });

  it('PUT onboarding-complete succeeds when both channels are verified', async () => {
    const { token } = await createUserWithFlags({
      emailVerified: true,
      phoneVerified: true,
      status: 'active',
    });

    const res = await request(app)
      .put('/api/customer/settings/onboarding-complete')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.onboardingCompleted).toBe(true);
  });

  it('PUT onboarding-skip is allowed without verification', async () => {
    const { token } = await createUserWithFlags({
      emailVerified: false,
      phoneVerified: false,
      status: 'active',
    });

    const res = await request(app)
      .put('/api/customer/settings/onboarding-skip')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.onboardingSkipped).toBe(true);
  });

  it('PUT profile email change clears emailVerified', async () => {
    const { token, userId } = await createUserWithFlags({
      emailVerified: true,
      phoneVerified: true,
      email: 'before-change@example.com',
    });

    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'after-change@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('after-change@example.com');
    expect(res.body.data.emailVerified).toBe(false);

    const dbUser = await mongoose.connection.collections.users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
    expect(dbUser?.emailVerified).toBe(false);
    expect(dbUser?.phoneVerified).toBe(true);
  });

  it('PUT profile phone change clears phoneVerified and normalizes phone', async () => {
    const { token, userId } = await createUserWithFlags({
      emailVerified: true,
      phoneVerified: true,
      phoneNumber: '+64215550100',
    });

    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneNumber: '021 555 0199' });

    expect(res.status).toBe(200);
    expect(res.body.data.phoneNumber).toBe('+64215550199');
    expect(res.body.data.phoneVerified).toBe(false);

    const dbUser = await mongoose.connection.collections.users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
    expect(dbUser?.phoneVerified).toBe(false);
  });

  it('POST /customer/addresses creates first address as default Home', async () => {
    const { token } = await createUserWithFlags();

    const res = await request(app)
      .post('/api/customer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Home',
        line1: '12 Queen Street',
        city: 'Auckland',
        zip: '1010',
        country: 'NZ',
        isDefault: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.label).toBe('Home');
    expect(res.body.data.isDefault).toBe(true);
    expect(res.body.data.line1).toBe('12 Queen Street');
  });

  it('Updating default Home address keeps isDefault and updates legacy address', async () => {
    const { token, userId } = await createUserWithFlags();

    const createRes = await request(app)
      .post('/api/customer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Home',
        line1: '12 Queen Street',
        city: 'Auckland',
        zip: '1010',
        country: 'NZ',
        isDefault: true,
      });

    const addressId = createRes.body.data._id;
    expect(addressId).toBeDefined();

    const updateRes = await request(app)
      .put(`/api/customer/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Home',
        line1: '99 Harbour Road',
        line2: 'Mission Bay',
        city: 'Auckland',
        zip: '1071',
        country: 'NZ',
        isDefault: true,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.line1).toBe('99 Harbour Road');
    expect(updateRes.body.data.isDefault).toBe(true);

    const dbUser = await mongoose.connection.collections.users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
    expect(dbUser?.addresses?.length).toBe(1);
    expect(dbUser?.addresses?.[0]?.label).toBe('Home');
    expect(dbUser?.addresses?.[0]?.isDefault).toBe(true);
    expect(dbUser?.address?.line1).toBe('99 Harbour Road');
    expect(dbUser?.address?.zip).toBe('1071');
  });
});

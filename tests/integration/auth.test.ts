import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';

// Helper: create a verified user directly in DB
async function createVerifiedUser(overrides: Partial<{ email: string; password: string; fullName: string; phoneNumber: string }> = {}) {
  const email = overrides.email || 'direct@example.com';
  const password = overrides.password || 'Password123!';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await mongoose.connection.collections.users.insertOne({
    email,
    passwordHash,
    fullName: overrides.fullName || 'Direct User',
    phoneNumber: overrides.phoneNumber || '+64219999999',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const token = jwt.sign(
    { id: user.insertedId.toString(), email, role: 'customer' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  return { userId: user.insertedId.toString(), token, email };
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

describe('Integration: Auth - Registration', () => {
  const validUser = {
    email: 'test@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    fullName: 'Test User',
    phoneNumber: '+64211234567',
    acceptTerms: true,
  };

  it('POST /api/auth/register creates user and returns success', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBeDefined();
    expect(res.body.data.email).toBe('test@example.com');
  });

  it('POST /api/auth/register rejects duplicate email', async () => {
    await request(app).post('/api/auth/register').send(validUser);
    const res = await request(app).post('/api/auth/register').send(validUser);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/auth/register rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/register rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, password: 'short', confirmPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/register rejects mismatched passwords', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, confirmPassword: 'Different123!' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/register rejects missing acceptTerms', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, acceptTerms: false });
    expect(res.status).toBe(400);
  });

  it('passwordHash is not returned in response', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);
    expect(res.body.data.passwordHash).toBeUndefined();
  });
});

describe('Integration: Auth - Login', () => {
  beforeEach(async () => {
    // Create user directly as active/verified so login works
    await createVerifiedUser({
      email: 'login@example.com',
      password: 'Password123!',
      fullName: 'Login User',
      phoneNumber: '+64211234570',
    });
  });

  it('POST /api/auth/login returns token for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe('login@example.com');
  });

  it('POST /api/auth/login returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'WrongPassword!' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/auth/login returns 401 for non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123!' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login returns 403 for unverified user', async () => {
    // Register a new user (gets pending_verification status)
    await request(app).post('/api/auth/register').send({
      email: 'unverified@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      fullName: 'Unverified User',
      phoneNumber: '+64211234571',
      acceptTerms: true,
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unverified@example.com', password: 'Password123!' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('REQUIRES_VERIFICATION');
  });
});

describe('Integration: Auth - Protected Routes', () => {
  let token: string;
  let testEmail: string;

  beforeEach(async () => {
    const user = await createVerifiedUser({ email: 'auth@example.com', password: 'Password123!' });
    token = user.token;
    testEmail = user.email;
  });

  it('GET /api/auth/me returns user data with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testEmail);
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('GET /api/auth/me returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/change-password updates password', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Password123!', newPassword: 'NewPassword456!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Old password should no longer work
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'Password123!' });
    expect(loginRes.status).toBe(401);

    // New password should work
    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'NewPassword456!' });
    expect(newLoginRes.status).toBe(200);
  });

  it('POST /api/auth/change-password rejects wrong current password', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPassword123!', newPassword: 'NewPass123456!' });
    expect(res.status).toBe(401);
  });
});

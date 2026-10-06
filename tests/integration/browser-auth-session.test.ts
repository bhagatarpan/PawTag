import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { setupTestDb, teardownTestDb } from './setup';
import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';
import jwt from 'jsonwebtoken';

describe('Integration: Browser Auth Session Contract (Phase 01)', () => {
  let userId: string;

  beforeAll(async () => {
    await setupTestDb();
    const passwordHash = await bcrypt.hash('Password123!', 12);
    const user = await mongoose.connection.collections.users.insertOne({
      email: 'browser-session@example.com',
      passwordHash,
      fullName: 'Browser Session',
      phoneNumber: '+64210001111',
      role: 'customer',
      status: 'active',
      emailVerified: true,
      phoneVerified: true,
      responsibilityScore: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    userId = user.insertedId.toString();
  }, 30000);

  afterAll(async () => {
    await teardownTestDb();
  }, 10000);

  it('login as browser does not return refreshToken in the JSON body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('x-client-platform', 'web')
      .send({ email: 'browser-session@example.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.refreshToken).toBeUndefined();
    // HttpOnly cookie must be set for browser refresh
    const setCookie = res.headers['set-cookie'] || [];
    const refreshCookie = setCookie.find((c: string) => c.includes('pawtag_refresh_token'));
    expect(refreshCookie).toBeTruthy();
    expect(refreshCookie.toLowerCase()).toContain('httponly');
  });

  it('login as native app still returns refreshToken for SecureStore', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('x-client-platform', 'ios')
      .send({ email: 'browser-session@example.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
  });

  it('refresh as browser uses HttpOnly cookie and does not return refreshToken in body', async () => {
    // Create a valid refresh token directly via auth service helpers
    const { generateRefreshToken, storeRefreshToken } = await import('../../packages/api/src/services/auth.service');
    const tokens = generateRefreshToken();
    await storeRefreshToken(userId, tokens.tokenHash);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `pawtag_refresh_token=${tokens.token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.refreshToken).toBeUndefined();
  });

  it('rejects refresh without cookie or body token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  it('logout clears the refresh cookie', async () => {
    const { generateRefreshToken, storeRefreshToken } = await import('../../packages/api/src/services/auth.service');
    const tokens = generateRefreshToken();
    await storeRefreshToken(userId, tokens.tokenHash);

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `pawtag_refresh_token=${tokens.token}`)
      .send({});

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] || [];
    const cleared = setCookie.find((c: string) => c.includes('pawtag_refresh_token'));
    expect(cleared).toBeTruthy();
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';
import { RefreshToken, User } from '@pawtag/db';
import { hashPassword, generateToken } from '../../packages/api/src/services/auth.service';

let mongoServer: MongoMemoryServer;
let userId: string;
let token: string;
let refreshToken: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const passwordHash = await hashPassword('TestPass123!');
  const user = await User.create({
    email: 'refresh-test@example.com',
    passwordHash,
    fullName: 'Refresh Test',
    phoneNumber: '+64210000001',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
  });
  userId = user._id.toString();
  token = generateToken({ id: userId, email: user.email, role: user.role });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'refresh-test@example.com', password: 'TestPass123!' });
  refreshToken = loginRes.body.data.refreshToken;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await RefreshToken.deleteMany({});
  await User.deleteMany({});
  const passwordHash = await hashPassword('TestPass123!');
  const user = await User.create({
    email: 'refresh-test2@example.com',
    passwordHash,
    fullName: 'Refresh Test 2',
    phoneNumber: '+64210000002',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
  });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'refresh-test2@example.com', password: 'TestPass123!' });
  refreshToken = loginRes.body.data.refreshToken;
});

describe('Refresh Token Flow', () => {
  describe('POST /api/auth/refresh', () => {
    it('should return new tokens with valid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.refreshToken).not.toBe(refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token-123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject missing refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject revoked refresh token (rotation reuse detection)', async () => {
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should issue working access token after refresh', async () => {
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      const newAccessToken = refreshRes.body.data.token;

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newAccessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.email).toBe('refresh-test2@example.com');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should revoke refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(401);
    });

    it('should succeed even without refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Login returns refresh token', () => {
    it('should include refreshToken in login response', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'refresh-test2@example.com', password: 'TestPass123!' });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });
  });
});

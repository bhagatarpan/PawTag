import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { createCustomerWithRBAC } from './helpers';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

describe('Integration: Guardian API Endpoints', () => {
  describe('GET /api/customer/guardian/points', () => {
    it('should return user points balance and tier info', async () => {
      const { userId, token } = await createCustomerWithRBAC({ email: 'guardian-points@test.com' });

      // Set guardian points and tier on the user
      await mongoose.connection.collections.users.updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { $set: { guardianPoints: 150, guardianTier: 'NURTURE', pawRewardsBalance: 25.50 } }
      );

      // Create some ledger entries
      await mongoose.connection.collections.guardianpointsledgers.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        points: 100,
        activity: 'purchase',
        description: 'Tag purchase',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .get('/api/customer/guardian/points')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.points).toBe(150);
      expect(res.body.data.currentTier).toBeDefined();
      expect(res.body.data.pawRewardsBalance).toBe(25.50);
      expect(res.body.data.recentHistory).toBeDefined();
      expect(Array.isArray(res.body.data.recentHistory)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/customer/guardian/points');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/customer/guardian/rewards', () => {
    it('should return user rewards balance', async () => {
      const { userId, token } = await createCustomerWithRBAC({ email: 'guardian-rewards@test.com' });

      await mongoose.connection.collections.users.updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { $set: { pawRewardsBalance: 42.75 } }
      );

      const res = await request(app)
        .get('/api/customer/guardian/rewards')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.balance).toBe(42.75);
    });
  });

  describe('GET /api/customer/guardian/tier', () => {
    it('should return user tier information', async () => {
      const { userId, token } = await createCustomerWithRBAC({ email: 'guardian-tier@test.com' });

      await mongoose.connection.collections.users.updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { $set: { guardianPoints: 250, guardianTier: 'PROTECTOR' } }
      );

      const res = await request(app)
        .get('/api/customer/guardian/tier')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.currentTier).toBeDefined();
      expect(res.body.data.points).toBe(250);
    });
  });

  describe('POST /api/customer/guardian/rewards/redeem', () => {
    it('should return 400 for invalid amount', async () => {
      const { token } = await createCustomerWithRBAC({ email: 'guardian-redeem@test.com' });

      const res = await request(app)
        .post('/api/customer/guardian/rewards/redeem')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: -10 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when amount exceeds balance', async () => {
      const { token } = await createCustomerWithRBAC({ email: 'guardian-redeem2@test.com' });

      const res = await request(app)
        .post('/api/customer/guardian/rewards/redeem')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 99999 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});

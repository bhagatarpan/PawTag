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

describe('Integration: Loyalty / Guardian Activity Endpoints', () => {
  describe('GET /api/customer/guardian/history', () => {
    it('should return combined points and rewards history', async () => {
      const { userId, token } = await createCustomerWithRBAC({ email: 'loyalty-history@test.com' });

      await mongoose.connection.collections.guardianpointsledgers.insertMany([
        {
          userId: new mongoose.Types.ObjectId(userId),
          points: 50,
          activity: 'purchase',
          description: 'Tag purchase',
          createdAt: new Date('2026-01-15'),
          updatedAt: new Date('2026-01-15'),
        },
        {
          userId: new mongoose.Types.ObjectId(userId),
          points: 10,
          activity: 'review',
          description: 'Product review',
          createdAt: new Date('2026-02-10'),
          updatedAt: new Date('2026-02-10'),
        },
      ]);

      await mongoose.connection.collections.pawrewardsledgers.insertMany([
        {
          userId: new mongoose.Types.ObjectId(userId),
          amount: 5.00,
          type: 'earned',
          description: 'Purchase reward',
          createdAt: new Date('2026-01-20'),
          updatedAt: new Date('2026-01-20'),
        },
      ]);

      const res = await request(app)
        .get('/api/customer/guardian/history')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.history).toBeDefined();
      expect(Array.isArray(res.body.data.history)).toBe(true);
      expect(res.body.data.history.length).toBeGreaterThanOrEqual(3);
    });

    it('should return empty history for new user', async () => {
      const { token } = await createCustomerWithRBAC({ email: 'loyalty-empty@test.com' });

      const res = await request(app)
        .get('/api/customer/guardian/history')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.history).toEqual([]);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/customer/guardian/history');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/customer/guardian/benefits', () => {
    it('should return user benefits based on tier', async () => {
      const { userId, token } = await createCustomerWithRBAC({ email: 'loyalty-benefits@test.com' });

      await mongoose.connection.collections.users.updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { $set: { guardianPoints: 100, guardianTier: 'NURTURE' } }
      );

      const res = await request(app)
        .get('/api/customer/guardian/benefits')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.benefits).toBeDefined();
      expect(Array.isArray(res.body.data.benefits)).toBe(true);
      expect(typeof res.body.data.isGoldMember).toBe('boolean');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/customer/guardian/benefits');

      expect(res.status).toBe(401);
    });
  });
});

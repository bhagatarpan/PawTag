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

describe('Integration: Customer Subscriptions API', () => {
  describe('GET /api/customer/subscriptions', () => {
    it('should return empty array when no subscriptions exist', async () => {
      const { token } = await createCustomerWithRBAC({ email: 'sub-empty@test.com' });

      const res = await request(app)
        .get('/api/customer/subscriptions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should return user subscriptions', async () => {
      const { userId, token } = await createCustomerWithRBAC({ email: 'sub-list@test.com' });
      const petId = await createPet(userId, { name: 'Rex' });
      const tagId = await createTag(userId, petId, { tagId: 'TAG-SUB-001' });

      // Create a subscription record
      await mongoose.connection.collections.subscriptions.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        tagId: new mongoose.Types.ObjectId(tagId),
        planName: 'Annual Tag Protection',
        planType: 'annual',
        status: 'active',
        price: 29.99,
        currency: 'NZD',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        autoRenew: true,
        renewalMethod: 'annual',
        totalScans: 0,
        reminderStates: { graceWeeklySentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .get('/api/customer/subscriptions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].planName).toBe('Annual Tag Protection');
      expect(res.body.data[0].status).toBe('active');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/customer/subscriptions');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/customer/subscriptions/:id', () => {
    it('should return a specific subscription', async () => {
      const { userId, token } = await createCustomerWithRBAC({ email: 'sub-get@test.com' });
      const petId = await createPet(userId);
      const tagId = await createTag(userId, petId, { tagId: 'TAG-SUB-GET' });

      const subResult = await mongoose.connection.collections.subscriptions.insertOne({
        userId: new mongoose.Types.ObjectId(userId),
        tagId: new mongoose.Types.ObjectId(tagId),
        planName: 'Monthly Protection',
        planType: 'monthly',
        status: 'active',
        price: 2.99,
        currency: 'NZD',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        autoRenew: true,
        renewalMethod: 'monthly',
        totalScans: 5,
        reminderStates: { graceWeeklySentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const subId = subResult.insertedId.toString();

      const res = await request(app)
        .get(`/api/customer/subscriptions/${subId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.planName).toBe('Monthly Protection');
      expect(res.body.data.status).toBe('active');
    });

    it('should return 404 for non-existent subscription', async () => {
      const { token } = await createCustomerWithRBAC({ email: 'sub-notfound@test.com' });
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .get(`/api/customer/subscriptions/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});

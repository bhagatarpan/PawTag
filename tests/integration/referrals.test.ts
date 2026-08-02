import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { createCustomerWithRBAC, createSuperAdmin } from './helpers';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

describe('Integration: Referrals', () => {
  describe('GET /api/customer/referral', () => {
    it('returns referral code for authenticated customer', async () => {
      const { token } = await createCustomerWithRBAC();
      const res = await request(app)
        .get('/api/customer/referral')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBeDefined();
      expect(res.body.data.code.length).toBe(8);
    });

    it('returns same code on subsequent calls', async () => {
      const { token } = await createCustomerWithRBAC();
      const res1 = await request(app)
        .get('/api/customer/referral')
        .set('Authorization', `Bearer ${token}`);
      const res2 = await request(app)
        .get('/api/customer/referral')
        .set('Authorization', `Bearer ${token}`);

      expect(res1.body.data.code).toBe(res2.body.data.code);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/customer/referral');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/customer/referral/stats', () => {
    it('returns referral stats', async () => {
      const { token } = await createCustomerWithRBAC();
      const res = await request(app)
        .get('/api/customer/referral/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalReferrals).toBe(0);
      expect(res.body.data.completedReferrals).toBe(0);
    });
  });

  describe('GET /api/customer/referral/history', () => {
    it('returns empty history initially', async () => {
      const { token } = await createCustomerWithRBAC();
      const res = await request(app)
        .get('/api/customer/referral/history')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/finder/referral/:code', () => {
    it('returns 404 for invalid referral code', async () => {
      const res = await request(app)
        .get('/api/finder/referral/INVALID123');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns valid status for existing code', async () => {
      const { token } = await createCustomerWithRBAC();

      // First create a referral code
      const codeRes = await request(app)
        .get('/api/customer/referral')
        .set('Authorization', `Bearer ${token}`);
      const code = codeRes.body.data.code;

      // Then validate it as finder
      const res = await request(app)
        .get(`/api/finder/referral/${code}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
    });
  });

  describe('GET /api/admin/referrals', () => {
    it('returns empty referrals list for admin', async () => {
      const { token } = await createSuperAdmin();
      const res = await request(app)
        .get('/api/admin/referrals')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
    });
  });

  describe('GET /api/admin/referrals/stats', () => {
    it('returns referral stats for admin', async () => {
      const { token } = await createSuperAdmin();
      const res = await request(app)
        .get('/api/admin/referrals/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalReferrals).toBe(0);
      expect(res.body.data.totalCodes).toBe(0);
    });
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { createSuperAdmin } from './helpers';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

describe('Integration: Tag Expiry Notifications', () => {
  describe('GET /api/admin/tag-expiry-notifications', () => {
    it('returns empty notifications list', async () => {
      const { token } = await createSuperAdmin();
      const res = await request(app)
        .get('/api/admin/tag-expiry-notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .get('/api/admin/tag-expiry-notifications');

      expect(res.status).toBe(401);
    });

    it('filters by acknowledged status', async () => {
      const { token } = await createSuperAdmin();
      const res = await request(app)
        .get('/api/admin/tag-expiry-notifications?acknowledged=true')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
    });
  });

  describe('GET /api/admin/tag-expiry-notifications/stats', () => {
    it('returns notification stats', async () => {
      const { token } = await createSuperAdmin();
      const res = await request(app)
        .get('/api/admin/tag-expiry-notifications/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('unacknowledged');
      expect(res.body.data).toHaveProperty('critical');
    });
  });

  describe('PUT /api/admin/tag-expiry-notifications/:id/acknowledge', () => {
    it('returns 404 for non-existent notification', async () => {
      const { token } = await createSuperAdmin();
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .put(`/api/admin/tag-expiry-notifications/${fakeId}/acknowledge`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});

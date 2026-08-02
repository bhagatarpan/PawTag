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

describe('Integration: Push Tokens', () => {
  describe('POST /api/customer/push-tokens', () => {
    it('registers a push token', async () => {
      const { token } = await createCustomerWithRBAC();
      const res = await request(app)
        .post('/api/customer/push-tokens')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'expo-push-token-123', platform: 'ios' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('updates existing token for same platform', async () => {
      const { token } = await createCustomerWithRBAC();
      await request(app)
        .post('/api/customer/push-tokens')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'old-token', platform: 'ios' });

      const res = await request(app)
        .post('/api/customer/push-tokens')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'new-token', platform: 'ios' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/customer/push-tokens')
        .send({ token: 'token', platform: 'ios' });

      expect(res.status).toBe(401);
    });

    it('rejects missing token', async () => {
      const { token } = await createCustomerWithRBAC();
      const res = await request(app)
        .post('/api/customer/push-tokens')
        .set('Authorization', `Bearer ${token}`)
        .send({ platform: 'ios' });

      expect(res.status).toBe(400);
    });

    it('rejects invalid platform', async () => {
      const { token } = await createCustomerWithRBAC();
      const res = await request(app)
        .post('/api/customer/push-tokens')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'token', platform: 'invalid' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/customer/push-tokens', () => {
    it('returns empty tokens initially', async () => {
      const { token } = await createCustomerWithRBAC();
      const res = await request(app)
        .get('/api/customer/push-tokens')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('returns registered tokens', async () => {
      const { token } = await createCustomerWithRBAC();
      await request(app)
        .post('/api/customer/push-tokens')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'expo-token-123', platform: 'ios' });

      const res = await request(app)
        .get('/api/customer/push-tokens')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].platform).toBe('ios');
    });
  });

  describe('DELETE /api/customer/push-tokens/:token', () => {
    it('removes a push token', async () => {
      const { token } = await createCustomerWithRBAC();
      await request(app)
        .post('/api/customer/push-tokens')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'expo-token-123', platform: 'ios' });

      const res = await request(app)
        .delete('/api/customer/push-tokens/expo-token-123')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify removed
      const listRes = await request(app)
        .get('/api/customer/push-tokens')
        .set('Authorization', `Bearer ${token}`);
      expect(listRes.body.data.length).toBe(0);
    });
  });
});

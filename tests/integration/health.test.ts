import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../packages/api/src/index';

describe('Integration: API Health', () => {
  describe('GET /health (basic)', () => {
    it('returns ok with timestamp', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
      expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
    });

    it('returns JSON content type', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['content-type']).toMatch(/json/);
    });
  });

  describe('GET /health/live (liveness probe)', () => {
    it('returns alive status with uptime', async () => {
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
      expect(res.body.timestamp).toBeDefined();
    });

    it('always returns 200 when process is running', async () => {
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /health/ready (readiness probe)', () => {
    it('returns readiness status with checks', async () => {
      const res = await request(app).get('/health/ready');
      expect([200, 503]).toContain(res.status);
      expect(res.body.status).toBeDefined();
      expect(res.body.checks).toBeDefined();
      expect(res.body.checks.database).toBeDefined();
      expect(['healthy', 'unhealthy']).toContain(res.body.checks.database.status);
    });

    it('does not expose secrets', async () => {
      const res = await request(app).get('/health/ready');
      const responseStr = JSON.stringify(res.body);
      expect(responseStr).not.toContain('JWT_SECRET');
      expect(responseStr).not.toContain('STRIPE_SECRET_KEY');
      expect(responseStr).not.toContain('DB_URL');
    });
  });

  describe('GET /health/dependencies', () => {
    it('returns dependency status', async () => {
      const res = await request(app).get('/health/dependencies');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.dependencies).toBeDefined();
    });

    it('shows database as configured when DB_URL is set', async () => {
      const res = await request(app).get('/health/dependencies');
      expect(res.body.dependencies.database.configured).toBe(true);
    });

    it('does not expose secret values', async () => {
      const res = await request(app).get('/health/dependencies');
      const responseStr = JSON.stringify(res.body);
      expect(responseStr).not.toMatch(/sk_live_/);
      expect(responseStr).not.toMatch(/sk_test_[a-zA-Z0-9]{20,}/);
      expect(responseStr).not.toMatch(/whsec_[a-zA-Z0-9]{20,}/);
    });
  });

  describe('GET /health/metrics', () => {
    it('returns metrics with timestamp', async () => {
      const res = await request(app).get('/health/metrics');
      expect(res.status).toBe(200);
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('Route not found', () => {
    it('GET /api/nonexistent returns 404', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Route not found');
    });

    it('POST /api/auth/login returns 400 for missing body', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send({});
      expect(res.status).toBe(400);
    });
  });
});

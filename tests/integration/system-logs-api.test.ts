import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { SystemLog, Setting } from '@pawtag/db';
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

async function seedSettings() {
  const settings = [
    { key: 'systemLog.enabled', value: 'true', category: 'systemLog', description: 'Master toggle' },
    { key: 'systemLog.level.debug', value: 'false', category: 'systemLog', description: 'Debug level' },
    { key: 'systemLog.level.info', value: 'true', category: 'systemLog', description: 'Info level' },
    { key: 'systemLog.level.warn', value: 'true', category: 'systemLog', description: 'Warn level' },
    { key: 'systemLog.level.error', value: 'true', category: 'systemLog', description: 'Error level' },
    { key: 'systemLog.level.fatal', value: 'true', category: 'systemLog', description: 'Fatal level' },
    { key: 'systemLog.category.HTTP', value: 'true', category: 'systemLog', description: 'HTTP category' },
    { key: 'systemLog.category.DATABASE', value: 'true', category: 'systemLog', description: 'Database category' },
    { key: 'systemLog.category.AUTH', value: 'true', category: 'systemLog', description: 'Auth category' },
    { key: 'systemLog.category.INTEGRATION', value: 'true', category: 'systemLog', description: 'Integration category' },
    { key: 'systemLog.category.JOB', value: 'true', category: 'systemLog', description: 'Job category' },
    { key: 'systemLog.category.SECURITY', value: 'true', category: 'systemLog', description: 'Security category' },
    { key: 'systemLog.category.NOTIFICATION', value: 'true', category: 'systemLog', description: 'Notification category' },
    { key: 'systemLog.category.CONFIG', value: 'true', category: 'systemLog', description: 'Config category' },
    { key: 'systemLog.category.GENERAL', value: 'true', category: 'systemLog', description: 'General category' },
    { key: 'systemLog.sampling.debug', value: '100', category: 'systemLog', description: 'Debug sampling' },
    { key: 'systemLog.sampling.info', value: '100', category: 'systemLog', description: 'Info sampling' },
    { key: 'systemLog.sampling.warn', value: '100', category: 'systemLog', description: 'Warn sampling' },
    { key: 'systemLog.sampling.error', value: '100', category: 'systemLog', description: 'Error sampling' },
    { key: 'systemLog.sampling.fatal', value: '100', category: 'systemLog', description: 'Fatal sampling' },
    { key: 'systemLog.retentionDays', value: '30', category: 'systemLog', description: 'Retention' },
  ];

  const admin = await createSuperAdmin();
  for (const s of settings) {
    await Setting.findOneAndUpdate(
      { key: s.key },
      { ...s, updatedBy: new mongoose.Types.ObjectId(admin.userId) },
      { upsert: true },
    );
  }
  return admin;
}

async function insertTestLogs(count: number) {
  const logs = [];
  const levels = ['info', 'warn', 'error'];
  const categories = ['HTTP', 'DATABASE', 'AUTH'];
  for (let i = 0; i < count; i++) {
    logs.push({
      logId: `test-log-${i}`,
      timestamp: new Date(Date.now() - i * 1000),
      level: levels[i % levels.length],
      message: `Test log message ${i}`,
      category: categories[i % categories.length],
      service: 'pawtag-api',
      environment: 'test',
      requestId: i < 5 ? 'shared-request-id' : `req-${i}`,
      retentionDays: 30,
      expiresAt: new Date(Date.now() + 30 * 86400000),
    });
  }
  await SystemLog.insertMany(logs);
}

describe('System Logs API', () => {
  describe('GET /api/admin/system-logs', () => {
    it('returns paginated system logs', async () => {
      const { token } = await seedSettings();
      await insertTestLogs(10);

      const res = await request(app)
        .get('/api/admin/system-logs')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(10);
      expect(res.body.data.total).toBe(10);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.totalPages).toBe(1);
    });

    it('filters by level', async () => {
      const { token } = await seedSettings();
      await insertTestLogs(9);

      const res = await request(app)
        .get('/api/admin/system-logs?level=error')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((l: { level: string }) => l.level === 'error')).toBe(true);
    });

    it('filters by category', async () => {
      const { token } = await seedSettings();
      await insertTestLogs(9);

      const res = await request(app)
        .get('/api/admin/system-logs?category=HTTP')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((l: { category: string }) => l.category === 'HTTP')).toBe(true);
    });

    it('searches by message', async () => {
      const { token } = await seedSettings();
      await insertTestLogs(5);

      const res = await request(app)
        .get('/api/admin/system-logs?search=message%201')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('paginates with limit', async () => {
      const { token } = await seedSettings();
      await insertTestLogs(10);

      const res = await request(app)
        .get('/api/admin/system-logs?page=2&limit=3')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(3);
      expect(res.body.data.page).toBe(2);
    });

    it('requires authentication', async () => {
      const res = await request(app).get('/api/admin/system-logs');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/admin/system-logs/summary', () => {
    it('returns summary statistics', async () => {
      const { token } = await seedSettings();
      await insertTestLogs(9);

      const res = await request(app)
        .get('/api/admin/system-logs/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(9);
      expect(res.body.data.errors).toBe(3);
      expect(res.body.data.warnings).toBe(3);
      expect(res.body.data.byCategory).toBeDefined();
      expect(res.body.data.byLevel).toBeDefined();
    });
  });

  describe('GET /api/admin/system-logs/export', () => {
    it('exports as CSV', async () => {
      const { token } = await seedSettings();
      await insertTestLogs(5);

      const res = await request(app)
        .get('/api/admin/system-logs/export?format=csv')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('timestamp,level,category');
    });

    it('exports as JSON', async () => {
      const { token } = await seedSettings();
      await insertTestLogs(5);

      const res = await request(app)
        .get('/api/admin/system-logs/export?format=json')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      const data = JSON.parse(res.text);
      expect(data).toHaveLength(5);
    });
  });

  describe('GET /api/admin/system-logs/settings', () => {
    it('returns all settings', async () => {
      const { token } = await seedSettings();

      const res = await request(app)
        .get('/api/admin/system-logs/settings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.enabled).toBe(true);
      expect(res.body.data.levels).toBeDefined();
      expect(res.body.data.categories).toBeDefined();
      expect(res.body.data.sampling).toBeDefined();
      expect(res.body.data.retentionDays).toBe(30);
    });
  });

  describe('PUT /api/admin/system-logs/settings/:key', () => {
    it('updates a setting', async () => {
      const { token } = await seedSettings();

      const res = await request(app)
        .put('/api/admin/system-logs/settings/systemLog.level.debug')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: 'true' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.key).toBe('systemLog.level.debug');
      expect(res.body.data.value).toBe('true');
    });

    it('rejects invalid setting key', async () => {
      const { token } = await seedSettings();

      const res = await request(app)
        .put('/api/admin/system-logs/settings/invalid.key')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: 'true' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/admin/system-logs/request/:requestId', () => {
    it('returns logs for a specific request', async () => {
      const { token } = await seedSettings();
      await insertTestLogs(5);

      const res = await request(app)
        .get('/api/admin/system-logs/request/shared-request-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(5);
    });
  });
});

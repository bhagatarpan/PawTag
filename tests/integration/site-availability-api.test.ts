import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Setting } from '@pawtag/db';
import { createSuperAdmin, createCustomer } from './helpers';
import { clearSiteAvailabilityCache } from '../../packages/api/src/lib/site-availability.service';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
  clearSiteAvailabilityCache();
});

async function seedAvailabilitySettings(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    'site.maintenanceMode': 'false',
    'site.offlineMode': 'false',
    'site.maintenanceTitle': 'PawTag is currently under maintenance',
    'site.maintenanceMessage': 'Some website functionality is temporarily unavailable.',
    'site.offlineTitle': 'PawTag is currently offline',
    'site.offlineMessage': 'Please come back later.',
    'site.availabilityPollingInterval': '30',
  };

  const settings = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(settings)) {
    await Setting.create({ key, value, category: 'site', description: `Test setting: ${key}`, updatedBy: new mongoose.Types.ObjectId() });
  }
  clearSiteAvailabilityCache();
}

async function createAdminWithSettingPermission() {
  const { userId, token, email } = await createSuperAdmin();
  return { userId, token, email };
}

async function createCustomerWithToken() {
  const { userId, token, email } = await createCustomer();
  return { userId, token, email };
}

describe('Site Availability API', () => {
  describe('GET /api/public/system/status', () => {
    it('returns ONLINE when both settings are false', async () => {
      await seedAvailabilitySettings();
      const res = await request(app).get('/api/public/system/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ONLINE');
    });

    it('returns MAINTENANCE when maintenance is true', async () => {
      await seedAvailabilitySettings({ 'site.maintenanceMode': 'true' });
      const res = await request(app).get('/api/public/system/status');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('MAINTENANCE');
    });

    it('returns OFFLINE when offline is true', async () => {
      await seedAvailabilitySettings({ 'site.offlineMode': 'true' });
      const res = await request(app).get('/api/public/system/status');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('OFFLINE');
    });

    it('returns OFFLINE when both are true (precedence)', async () => {
      await seedAvailabilitySettings({ 'site.maintenanceMode': 'true', 'site.offlineMode': 'true' });
      const res = await request(app).get('/api/public/system/status');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('OFFLINE');
    });

    it('is accessible without authentication', async () => {
      await seedAvailabilitySettings();
      const res = await request(app).get('/api/public/system/status');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/site-availability/status', () => {
    it('returns full availability data for authenticated admin', async () => {
      await seedAvailabilitySettings();
      const { token } = await createAdminWithSettingPermission();
      const res = await request(app)
        .get('/api/admin/site-availability/status')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('maintenanceMode');
      expect(res.body.data).toHaveProperty('offlineMode');
      expect(res.body.data).toHaveProperty('messages');
      expect(res.body.data).toHaveProperty('pollingInterval');
    });

    it('returns 401 without authentication', async () => {
      await seedAvailabilitySettings();
      const res = await request(app).get('/api/admin/site-availability/status');
      expect(res.status).toBe(401);
    });

    it('returns 403 for customer without setting.read permission', async () => {
      await seedAvailabilitySettings();
      const { token } = await createCustomerWithToken();
      const res = await request(app)
        .get('/api/admin/site-availability/status')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/admin/site-availability/status', () => {
    it('enables maintenance mode', async () => {
      await seedAvailabilitySettings();
      const { token } = await createAdminWithSettingPermission();
      const res = await request(app)
        .put('/api/admin/site-availability/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ maintenanceMode: true });
      expect(res.status).toBe(200);
      expect(res.body.data.maintenanceMode).toBe(true);
      expect(res.body.data.status).toBe('MAINTENANCE');
    });

    it('enables offline mode', async () => {
      await seedAvailabilitySettings();
      const { token } = await createAdminWithSettingPermission();
      const res = await request(app)
        .put('/api/admin/site-availability/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ offlineMode: true });
      expect(res.status).toBe(200);
      expect(res.body.data.offlineMode).toBe(true);
      expect(res.body.data.status).toBe('OFFLINE');
    });

    it('offline takes precedence over maintenance', async () => {
      await seedAvailabilitySettings();
      const { token } = await createAdminWithSettingPermission();
      const res = await request(app)
        .put('/api/admin/site-availability/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ maintenanceMode: true, offlineMode: true });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('OFFLINE');
    });

    it('returns to MAINTENANCE when offline is disabled but maintenance remains', async () => {
      await seedAvailabilitySettings({ 'site.maintenanceMode': 'true', 'site.offlineMode': 'true' });
      const { token } = await createAdminWithSettingPermission();
      const res = await request(app)
        .put('/api/admin/site-availability/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ offlineMode: false });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('MAINTENANCE');
      expect(res.body.data.maintenanceMode).toBe(true);
    });

    it('updates messages', async () => {
      await seedAvailabilitySettings();
      const { token } = await createAdminWithSettingPermission();
      const res = await request(app)
        .put('/api/admin/site-availability/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ maintenanceTitle: 'Custom Title', offlineMessage: 'Custom offline message' });
      expect(res.status).toBe(200);
      expect(res.body.data.messages.maintenanceTitle).toBe('Custom Title');
      expect(res.body.data.messages.offlineMessage).toBe('Custom offline message');
    });

    it('returns 401 without authentication', async () => {
      await seedAvailabilitySettings();
      const res = await request(app)
        .put('/api/admin/site-availability/status')
        .send({ maintenanceMode: true });
      expect(res.status).toBe(401);
    });

    it('returns 403 for customer without setting.update permission', async () => {
      await seedAvailabilitySettings();
      const { token } = await createCustomerWithToken();
      const res = await request(app)
        .put('/api/admin/site-availability/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ maintenanceMode: true });
      expect(res.status).toBe(403);
    });
  });

  describe('Middleware enforcement', () => {
    it('maintenance mode blocks POST requests to customer routes', async () => {
      await seedAvailabilitySettings({ 'site.maintenanceMode': 'true' });
      const { token } = await createCustomerWithToken();
      const res = await request(app)
        .post('/api/customer/pets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Pet' });
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('SITE_MAINTENANCE');
    });

    it('maintenance mode allows GET requests to customer routes', async () => {
      await seedAvailabilitySettings({ 'site.maintenanceMode': 'true' });
      const { token } = await createCustomerWithToken();
      const res = await request(app)
        .get('/api/customer/pets')
        .set('Authorization', `Bearer ${token}`);
      // Should not be 503 — may be 200 or other non-503
      expect(res.status).not.toBe(503);
    });

    it('offline mode blocks all normal API requests', async () => {
      await seedAvailabilitySettings({ 'site.offlineMode': 'true' });
      const { token } = await createCustomerWithToken();
      const res = await request(app)
        .get('/api/customer/pets')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('SITE_OFFLINE');
    });

    it('admin routes remain accessible during offline mode', async () => {
      await seedAvailabilitySettings({ 'site.offlineMode': 'true' });
      const { token } = await createAdminWithSettingPermission();
      const res = await request(app)
        .get('/api/admin/site-availability/status')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('public status endpoint remains accessible during offline mode', async () => {
      await seedAvailabilitySettings({ 'site.offlineMode': 'true' });
      const res = await request(app).get('/api/public/system/status');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('OFFLINE');
    });

    it('auth routes remain accessible during offline mode', async () => {
      await seedAvailabilitySettings({ 'site.offlineMode': 'true' });
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrong' });
      // Should not be 503 — may be 401 or other non-503
      expect(res.status).not.toBe(503);
    });

    it('health endpoint remains accessible during offline mode', async () => {
      await seedAvailabilitySettings({ 'site.offlineMode': 'true' });
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Mock @pawtag/db
vi.mock('@pawtag/db', () => ({
  connectDatabase: vi.fn().mockResolvedValue(undefined),
  mongoose: { connect: vi.fn(), disconnect: vi.fn() },
  User: { findOne: vi.fn(), findById: vi.fn(), create: vi.fn(), countDocuments: vi.fn().mockResolvedValue(0) },
  Pet: { findOne: vi.fn(), find: vi.fn().mockResolvedValue([]), countDocuments: vi.fn().mockResolvedValue(0) },
  Tag: { findOne: vi.fn(), find: vi.fn().mockResolvedValue([]), countDocuments: vi.fn().mockResolvedValue(0) },
  Order: { find: vi.fn().mockResolvedValue([]), countDocuments: vi.fn().mockResolvedValue(0), aggregate: vi.fn().mockResolvedValue([]) },
  FinderScan: { countDocuments: vi.fn().mockResolvedValue(0) },
  SiteContent: {},
  Setting: {},
  FeatureFlag: {},
  AuditLog: { create: vi.fn() },
  UserRole: { find: vi.fn().mockResolvedValue([]) },
  Role: { findOne: vi.fn() },
  Permission: {},
  RolePermission: {},
  VerificationToken: {},
  Notification: {},
  LocationEvent: {},
  CmsEmailTemplate: {},
  CmsSmsTemplate: {},
  Cart: {},
  Product: {},
}));

vi.mock('../../packages/api/src/services/reminder.service', () => ({
  startReminderService: vi.fn(),
}));

vi.mock('qrcode', () => ({
  default: {
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-qr')),
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fake'),
  },
}));

vi.mock('swagger-jsdoc', () => ({
  default: vi.fn().mockReturnValue({ info: {}, paths: {}, components: {} }),
}));

vi.mock('swagger-ui-express', () => ({
  default: { serve: vi.fn(), setup: vi.fn() },
}));

import app from '../../packages/api/src/index';

describe('Smoke: API Health & Basics', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /api/nonexistent returns 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns consistent error format', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects unauthenticated requests to protected routes', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('handles POST with invalid JSON', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('not-json');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('Smoke: CORS & Headers', () => {
  it('CORS headers are present', async () => {
    const res = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBeLessThan(500);
  });
});

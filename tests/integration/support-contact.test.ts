import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { SupportRequest } from '@pawtag/db';
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

describe('Phase 19B — Support Contact Intake', () => {
  describe('POST /api/support/contact', () => {
    it('should create a support request and return success', async () => {
      const res = await request(app)
        .post('/api/support/contact')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          message: 'I need help with my tag not scanning properly.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();

      const record = await SupportRequest.findById(res.body.data.id);
      expect(record).toBeTruthy();
      expect(record!.name).toBe('John Doe');
      expect(record!.email).toBe('john@example.com');
      expect(record!.resolved).toBe(false);
    });

    it('should reject with missing name', async () => {
      const res = await request(app)
        .post('/api/support/contact')
        .send({
          email: 'john@example.com',
          message: 'Help me please',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject with invalid email', async () => {
      const res = await request(app)
        .post('/api/support/contact')
        .send({
          name: 'John',
          email: 'not-an-email',
          message: 'Help me please',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject with message too short', async () => {
      const res = await request(app)
        .post('/api/support/contact')
        .send({
          name: 'John',
          email: 'john@example.com',
          message: 'Hi',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject with empty body', async () => {
      const res = await request(app)
        .post('/api/support/contact')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/support-requests', () => {
    it('should return paginated support requests for admin', async () => {
      const { token } = await createSuperAdmin();

      await SupportRequest.create([
        { name: 'User A', email: 'a@test.com', message: 'First request message' },
        { name: 'User B', email: 'b@test.com', message: 'Second request message' },
      ]);

      const res = await request(app)
        .get('/api/admin/support-requests')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.requests).toHaveLength(2);
      expect(res.body.data.pagination.total).toBe(2);
    });

    it('should filter by resolved status', async () => {
      const { token } = await createSuperAdmin();

      await SupportRequest.create([
        { name: 'Resolved', email: 'r@test.com', message: 'Resolved request message', resolved: true },
        { name: 'Pending', email: 'p@test.com', message: 'Pending request message', resolved: false },
      ]);

      const res = await request(app)
        .get('/api/admin/support-requests?resolved=true')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.requests).toHaveLength(1);
      expect(res.body.data.requests[0].name).toBe('Resolved');
    });

    it('should require admin auth', async () => {
      const res = await request(app)
        .get('/api/admin/support-requests');

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/admin/support-requests/:id/resolve', () => {
    it('should mark a request as resolved', async () => {
      const { token } = await createSuperAdmin();

      const req = await SupportRequest.create({
        name: 'Test User',
        email: 'test@test.com',
        message: 'This is a test support request for resolution.',
      });

      const res = await request(app)
        .patch(`/api/admin/support-requests/${req._id}/resolve`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Resolved via email' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.resolved).toBe(true);
      expect(res.body.data.notes).toBe('Resolved via email');
    });

    it('should return 404 for nonexistent request', async () => {
      const { token } = await createSuperAdmin();
      const fakeId = new (await import('mongoose')).Types.ObjectId();

      const res = await request(app)
        .patch(`/api/admin/support-requests/${fakeId}/resolve`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});

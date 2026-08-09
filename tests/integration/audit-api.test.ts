import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { AuditEvent, Setting, FeatureFlag } from '@pawtag/db';
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

describe('Audit API & config event coverage (PH1/PH2)', () => {
  it('admin can query the new audit stream via /api/admin/audit', async () => {
    const { token } = await createSuperAdmin();

    const createRes = await request(app)
      .post('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ key: 'test.auditKey', value: 'v1', category: 'test' });
    expect(createRes.status).toBe(201);

    const res = await request(app)
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    const event = res.body.data.items.find((e: any) => e.action === 'setting_create');
    expect(event).toBeDefined();
    expect(event.actorType).toBe('ADMIN');
    expect(event.resourceId).toBe('test.auditKey');
  });

  it('records before/after on setting update (CONFIG threat model)', async () => {
    const { token } = await createSuperAdmin();
    await Setting.create({ key: 'mfa.testMode', value: 'true', category: 'mfa', updatedBy: new mongoose.Types.ObjectId() });

    const res = await request(app)
      .put('/api/admin/settings/mfa.testMode')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 'false' });
    expect(res.status).toBe(200);

    const event = await AuditEvent.findOne({ action: 'setting_update', resourceType: 'Setting', resourceId: 'mfa.testMode' }).lean();
    expect(event).toBeDefined();
    expect((event! as any).beforeState.value).toBe('true');
    expect((event! as any).afterState.value).toBe('false');
    expect(event!.severity).toBe('HIGH');
  });

  it('records feature-flag changes with correct isEnabled before/after', async () => {
    const { token } = await createSuperAdmin();
    await FeatureFlag.create({ key: 'darkMode', name: 'Dark Mode', isEnabled: false, description: 'test' });

    const res = await request(app)
      .put('/api/admin/feature-flags/darkMode')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: true });
    expect(res.status).toBe(200);

    const event = await AuditEvent.findOne({ action: 'feature_flag_update', resourceId: 'darkMode' }).lean();
    expect(event).toBeDefined();
    expect((event! as any).beforeState.isEnabled).toBe(false);
    expect((event! as any).afterState.isEnabled).toBe(true);
    expect(event!.severity).toBe('CRITICAL');
  });

  it('hash chain verifies end-to-end through the API', async () => {
    const { token } = await createSuperAdmin();
    await request(app)
      .post('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ key: 'chain.test1', value: 'a', category: 'test' });
    await request(app)
      .put('/api/admin/settings/chain.test1')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 'b' });
    await request(app)
      .post('/api/admin/content')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'T', slug: 't', body: 'content', status: 'draft' });

    const res = await request(app)
      .get('/api/admin/audit/verify-chain')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.checked).toBeGreaterThanOrEqual(3);
  });

  it('customer content admin delete emits audit event', async () => {
    const { token } = await createSuperAdmin();
    const content = await request(app)
      .post('/api/admin/content')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'About', slug: 'about', body: 'hello', status: 'draft' });
    expect(content.status).toBe(201);

    const del = await request(app)
      .delete(`/api/admin/content/${content.body.data._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const events = await AuditEvent.find({ resourceType: 'SiteContent' }).lean();
    expect(events.some((e: any) => e.action === 'content_delete')).toBe(true);
    const delEvent = events.find((e: any) => e.action === 'content_delete');
    expect(delEvent!.actorType).toBe('ADMIN');
  });
});
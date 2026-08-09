import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { config } from '../../packages/api/src/config';
import { AuditEvent, Setting, FeatureFlag } from '@pawtag/db';
import { createSuperAdmin } from './helpers';

/** Create an admin-portal user with a specific legacy role (for actor-type classification tests). */
async function createPortalActor(email: string, legacyRole: string, roleName: string) {
  const user = await mongoose.connection.collections.users.insertOne({
    email,
    passwordHash: 'x',
    fullName: email,
    phoneNumber: '+64210000000',
    role: legacyRole,
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const userId = user.insertedId.toString();
  const role = await mongoose.connection.collections.roles.insertOne({
    name: roleName,
    displayName: roleName,
    roleType: 'system',
    isSystemRole: true,
    isSuperAdmin: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await mongoose.connection.collections.userroles.insertOne({
    userId: new mongoose.Types.ObjectId(userId),
    roleId: role.insertedId,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const token = jwt.sign({ id: userId, email, role: legacyRole }, config.jwtSecret, { expiresIn: '1h' });
  return { userId, token, email };
}

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
  it('does not expose the removed legacy audit-log endpoint', async () => {
    const { token } = await createSuperAdmin();

    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

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

  it('admin can view and change audit category policy', async () => {
    const { token } = await createSuperAdmin();

    const initial = await request(app)
      .get('/api/admin/audit/settings')
      .set('Authorization', `Bearer ${token}`);
    expect(initial.status).toBe(200);
    expect(initial.body.data.categories.find((item: any) => item.key === 'READ').enabled).toBe(true);
    expect(initial.body.data.actors.find((item: any) => item.key === 'USER').enabled).toBe(true);

    const update = await request(app)
      .put('/api/admin/audit/settings/category/READ')
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false });
    expect(update.status).toBe(200);
    expect(update.body.data.enabled).toBe(false);

    const policyEvent = await AuditEvent.findOne({
      action: 'audit_policy_updated',
      resourceId: 'category:READ',
    }).lean();
    expect(policyEvent).toBeDefined();
    expect(policyEvent!.outcome).toBe('SUCCESS');

    await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const disabledReadRequest = await AuditEvent.findOne({ action: 'http_get', resourceId: '/api/admin/settings' }).lean();
    expect(disabledReadRequest).toBeNull();

    const restore = await request(app)
      .put('/api/admin/audit/settings/category/READ')
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true });
    expect(restore.status).toBe(200);
    expect(restore.body.data.enabled).toBe(true);

    await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const readEvent = await AuditEvent.findOne({ eventType: 'http.request.completed', action: 'http_get' }).sort({ occurredAt: -1 }).lean();
    expect(readEvent).toBeDefined();
    expect(readEvent!.actorType).toBe('ADMIN');
    expect(readEvent!.eventCategory).toBe('READ');
  });

  it('classifies CSR and web editor activity under their own actor types, not ADMIN', async () => {
    const csr = await createPortalActor('csr@example.com', 'customer_service', 'SUPER_ADMIN_CSR');
    await Setting.create({ key: 'mfa.testMode', value: 'true', category: 'mfa', updatedBy: new mongoose.Types.ObjectId() });

    const res = await request(app)
      .put('/api/admin/settings/mfa.testMode')
      .set('Authorization', `Bearer ${csr.token}`)
      .send({ value: 'false' });
    expect(res.status).toBe(200);

    const domainEvent = await AuditEvent.findOne({ action: 'setting_update', resourceId: 'mfa.testMode' }).lean();
    expect(domainEvent).toBeDefined();
    expect(domainEvent!.actorType).toBe('CSR');

    const editor = await createPortalActor('editor@example.com', 'website_editor', 'SUPER_ADMIN_EDITOR');
    await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${editor.token}`);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const requestEvent = await AuditEvent.findOne({ eventType: 'http.request.completed', actorId: editor.userId }).lean();
    expect(requestEvent).toBeDefined();
    expect(requestEvent!.actorType).toBe('WEB_EDITOR');
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

  it('records nested profile fields before and after an actor update', async () => {
    const { token } = await createSuperAdmin();

    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        address: { line1: '1 New Street', city: 'Auckland', country: 'NZ' },
        emergencyContact: { name: 'Emergency Person', phone: '+64210000000', relationship: 'Friend' },
      });
    expect(res.status).toBe(200);

    const event = await AuditEvent.findOne({ action: 'profile_updated' }).lean();
    expect(event).toBeDefined();
    expect((event!.afterState as any).address.line1).toBe('1 New Street');
    expect((event!.afterState as any).emergencyContact.relationship).toBe('Friend');
    expect(event!.changedFields?.map((field) => field.field)).toEqual(['address', 'emergencyContact']);
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

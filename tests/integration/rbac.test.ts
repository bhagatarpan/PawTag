import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { Role, Permission, PermissionGroup, PermissionScope, UserRole, RolePermission } from '@pawtag/db';
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

const BASE = '/api/admin/rbac';

// ═══════════════════════════════════════════
// PERMISSION GROUPS
// ═══════════════════════════════════════════

describe('RBAC — Permission Groups', () => {
  it('GET /permission-groups returns empty array', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app).get(`${BASE}/permission-groups`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('POST /permission-groups creates a group', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app)
      .post(`${BASE}/permission-groups`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'pet', displayName: 'Pet Management', description: 'Pet-related permissions' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('PET');
  });

  it('GET /permission-groups/:id returns a group', async () => {
    const { token } = await createSuperAdmin();
    const createRes = await request(app)
      .post(`${BASE}/permission-groups`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'order', displayName: 'Order Management' });
    const id = createRes.body.data._id;
    const res = await request(app).get(`${BASE}/permission-groups/${id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('ORDER');
  });

  it('PUT /permission-groups/:id updates a group', async () => {
    const { token } = await createSuperAdmin();
    const createRes = await request(app)
      .post(`${BASE}/permission-groups`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'tag', displayName: 'Tag Management' });
    const id = createRes.body.data._id;
    const res = await request(app)
      .put(`${BASE}/permission-groups/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Tag & NFC Management' });
    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('Tag & NFC Management');
  });

  it('DELETE /permission-groups/:id deletes a group', async () => {
    const { token } = await createSuperAdmin();
    const createRes = await request(app)
      .post(`${BASE}/permission-groups`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'temp', displayName: 'Temporary' });
    const id = createRes.body.data._id;
    const res = await request(app).delete(`${BASE}/permission-groups/${id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('GET /permission-groups/:id returns 404 for nonexistent', async () => {
    const { token } = await createSuperAdmin();
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`${BASE}/permission-groups/${fakeId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('POST /permission-groups rejects invalid input', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app)
      .post(`${BASE}/permission-groups`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('requires auth', async () => {
    const res = await request(app).get(`${BASE}/permission-groups`);
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════
// PERMISSIONS
// ═══════════════════════════════════════════

describe('RBAC — Permissions', () => {
  it('GET /permissions returns empty array', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app).get(`${BASE}/permissions`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('POST /permissions creates a permission', async () => {
    const { token } = await createSuperAdmin();
    const group = await PermissionGroup.create({ name: 'PET', displayName: 'Pet', isActive: true });
    const res = await request(app)
      .post(`${BASE}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'pet.read', displayName: 'Read Pets', resource: 'pet', action: 'read', permissionGroupId: group._id.toString() });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('pet.read');
  });

  it('GET /permissions/:id returns a permission', async () => {
    const { token } = await createSuperAdmin();
    const group = await PermissionGroup.create({ name: 'ORDER', displayName: 'Order', isActive: true });
    const perm = await Permission.create({ name: 'order.read', displayName: 'Read Orders', resource: 'order', action: 'read', permissionGroupId: group._id, isActive: true });
    const res = await request(app).get(`${BASE}/permissions/${perm._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('order.read');
  });

  it('PUT /permissions/:id updates a permission', async () => {
    const { token } = await createSuperAdmin();
    const group = await PermissionGroup.create({ name: 'TAG', displayName: 'Tag', isActive: true });
    const perm = await Permission.create({ name: 'tag.read', displayName: 'Read Tags', resource: 'tag', action: 'read', permissionGroupId: group._id, isActive: true });
    const res = await request(app)
      .put(`${BASE}/permissions/${perm._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Read Tags (Updated)' });
    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('Read Tags (Updated)');
  });

  it('DELETE /permissions/:id deletes a permission', async () => {
    const { token } = await createSuperAdmin();
    const group = await PermissionGroup.create({ name: 'TEMP', displayName: 'Temp', isActive: true });
    const perm = await Permission.create({ name: 'temp.read', displayName: 'Read Temp', resource: 'temp', action: 'read', permissionGroupId: group._id, isActive: true });
    const res = await request(app).delete(`${BASE}/permissions/${perm._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('GET /permissions/:id returns 404 for nonexistent', async () => {
    const { token } = await createSuperAdmin();
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`${BASE}/permissions/${fakeId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════
// ROLES
// ═══════════════════════════════════════════

describe('RBAC — Roles', () => {
  it('GET /roles returns roles', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app).get(`${BASE}/roles`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /roles creates a role', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app)
      .post(`${BASE}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'SUPPORT_AGENT', displayName: 'Support Agent', description: 'Handles customer support' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('SUPPORT_AGENT');
  });

  it('GET /roles/:id returns a role', async () => {
    const { token } = await createSuperAdmin();
    const role = await Role.create({ name: 'TEST_ROLE', displayName: 'Test Role', roleType: 'custom', isSystemRole: false, isSuperAdmin: false, isActive: true });
    const res = await request(app).get(`${BASE}/roles/${role._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('TEST_ROLE');
  });

  it('PUT /roles/:id updates a role', async () => {
    const { token } = await createSuperAdmin();
    const role = await Role.create({ name: 'UPDATE_ME', displayName: 'Update Me', roleType: 'custom', isSystemRole: false, isSuperAdmin: false, isActive: true });
    const res = await request(app)
      .put(`${BASE}/roles/${role._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Updated Role' });
    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('Updated Role');
  });

  it('DELETE /roles/:id deletes a role', async () => {
    const { token } = await createSuperAdmin();
    const role = await Role.create({ name: 'DELETE_ME', displayName: 'Delete Me', roleType: 'custom', isSystemRole: false, isSuperAdmin: false, isActive: true });
    const res = await request(app).delete(`${BASE}/roles/${role._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('POST /roles/:id/clone clones a role', async () => {
    const { token } = await createSuperAdmin();
    const role = await Role.create({ name: 'CLONE_ME', displayName: 'Clone Me', roleType: 'custom', isSystemRole: false, isSuperAdmin: false, isActive: true });
    const res = await request(app)
      .post(`${BASE}/roles/${role._id}/clone`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CLONED_ROLE', displayName: 'Cloned Role' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('CLONED_ROLE');
  });

  it('GET /roles/:id/permissions returns role permissions', async () => {
    const { token } = await createSuperAdmin();
    const role = await Role.create({ name: 'PERM_TEST', displayName: 'Perm Test', roleType: 'custom', isSystemRole: false, isSuperAdmin: false, isActive: true });
    const res = await request(app).get(`${BASE}/roles/${role._id}/permissions`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /roles/:id/permissions assigns permissions', async () => {
    const { token } = await createSuperAdmin();
    const role = await Role.create({ name: 'ASSIGN_TEST', displayName: 'Assign Test', roleType: 'custom', isSystemRole: false, isSuperAdmin: false, isActive: true });
    const group = await PermissionGroup.create({ name: 'PET', displayName: 'Pet', isActive: true });
    const perm = await Permission.create({ name: 'pet.read', displayName: 'Read Pets', resource: 'pet', action: 'read', permissionGroupId: group._id, isActive: true });
    const res = await request(app)
      .post(`${BASE}/roles/${role._id}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ permissionIds: [perm._id.toString()] });
    expect(res.status).toBe(200);
  });

  it('DELETE /roles/:roleId/permissions/:permId removes permission', async () => {
    const { token } = await createSuperAdmin();
    const role = await Role.create({ name: 'REMOVE_PERM', displayName: 'Remove Perm', roleType: 'custom', isSystemRole: false, isSuperAdmin: false, isActive: true });
    const group = await PermissionGroup.create({ name: 'TEMP', displayName: 'Temp', isActive: true });
    const perm = await Permission.create({ name: 'temp.read', displayName: 'Read Temp', resource: 'temp', action: 'read', permissionGroupId: group._id, isActive: true });
    await RolePermission.create({ roleId: role._id, permissionId: perm._id });
    const res = await request(app)
      .delete(`${BASE}/roles/${role._id}/permissions/${perm._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('GET /roles/:id returns 404 for nonexistent', async () => {
    const { token } = await createSuperAdmin();
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`${BASE}/roles/${fakeId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════
// SCOPES
// ═══════════════════════════════════════════

describe('RBAC — Scopes', () => {
  it('GET /scopes returns scopes', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app).get(`${BASE}/scopes`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /scopes creates a scope', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app)
      .post(`${BASE}/scopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'own_pets', displayName: 'Own Pets', description: 'Access to own pets only' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('own_pets');
  });

  it('PUT /scopes/:id updates a scope', async () => {
    const { token } = await createSuperAdmin();
    const scope = await PermissionScope.create({ name: 'all_pets', displayName: 'All Pets', isActive: true });
    const res = await request(app)
      .put(`${BASE}/scopes/${scope._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'All Pets (Updated)' });
    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('All Pets (Updated)');
  });

  it('DELETE /scopes/:id deletes a scope', async () => {
    const { token } = await createSuperAdmin();
    const scope = await PermissionScope.create({ name: 'temp_scope', displayName: 'Temp Scope', isActive: true });
    const res = await request(app).delete(`${BASE}/scopes/${scope._id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════
// USER ROLE ASSIGNMENTS
// ═══════════════════════════════════════════

describe('RBAC — User Role Assignments', () => {
  it('GET /users/:userId/roles returns user roles', async () => {
    const { token, userId } = await createSuperAdmin();
    const res = await request(app).get(`${BASE}/users/${userId}/roles`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /users/:userId/roles assigns a role', async () => {
    const { token, userId } = await createSuperAdmin();
    const role = await Role.create({ name: 'CUSTOMSupport', displayName: 'Support', roleType: 'custom', isSystemRole: false, isSuperAdmin: false, isActive: true });
    const res = await request(app)
      .post(`${BASE}/users/${userId}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleId: role._id.toString() });
    expect(res.status).toBe(200);
  });

  it('DELETE /users/:userId/roles/:roleId removes a role', async () => {
    const { token, userId } = await createSuperAdmin();
    const role = await Role.create({ name: 'TO_REMOVE', displayName: 'To Remove', roleType: 'custom', isSystemRole: false, isSuperAdmin: false, isActive: true });
    await UserRole.create({ userId: new mongoose.Types.ObjectId(userId), roleId: role._id, isActive: true });
    const res = await request(app)
      .delete(`${BASE}/users/${userId}/roles/${role._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('GET /users/:userId/effective-permissions returns permissions', async () => {
    const { token, userId } = await createSuperAdmin();
    const res = await request(app).get(`${BASE}/users/${userId}/effective-permissions`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ═══════════════════════════════════════════
// PERMISSION CHECK
// ═══════════════════════════════════════════

describe('RBAC — Permission Check', () => {
  it('GET /check/:permissionName returns check result', async () => {
    const { token } = await createSuperAdmin();
    const res = await request(app).get(`${BASE}/check/pet.read`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.hasPermission).toBe('boolean');
  });
});

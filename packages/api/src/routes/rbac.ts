import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validation';
import {
  Role,
  Permission,
  PermissionGroup,
  PermissionScope,
  UserRole,
  RolePermission,
  User,
} from '@pawtag/db';
import { getEffectivePermissions } from '../services/authorization.service';
import { auditService, type AuditContext } from '../services/audit';
import { createAuditContextFromRequest, type AuditRequest } from '../middleware/audit';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

async function auditRbacEvent(
  req: AuditRequest,
  input: Parameters<typeof auditService.log>[1],
  overrides: Partial<AuditContext> = {},
): Promise<void> {
  const reqContext = req.auditContext as AuditContext;
  if (!reqContext) {
    throw new Error('Audit middleware not applied - request has no audit context');
  }
  const context: AuditContext = {
    ...reqContext,
    ...overrides,
  } as AuditContext;
  await auditService.log(context, input);
}

// ──────────────────────────────────────────────
// Permission Groups
// ──────────────────────────────────────────────

const createGroupSchema = z.object({
  name: z.string().min(1).max(50).transform((v) => v.toUpperCase()),
  displayName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateGroupSchema = createGroupSchema.partial();

router.get('/permission-groups', requirePermission('permission_group.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const groups = await PermissionGroup.find().sort({ sortOrder: 1, name: 1 });
    res.json({ success: true, data: groups });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch permission groups' });
  }
});

router.get('/permission-groups/:id', requirePermission('permission_group.read'), async (req: AuthRequest, res: Response) => {
  try {
    const group = await PermissionGroup.findById(req.params.id);
    if (!group) { res.status(404).json({ success: false, error: 'Permission group not found' }); return; }
    res.json({ success: true, data: group });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch permission group' });
  }
});

router.post('/permission-groups', requirePermission('permission_group.create'), validate(createGroupSchema), async (req: AuthRequest, res: Response) => {
  try {
    const group = await PermissionGroup.create({ ...req.body, createdBy: req.user!.id });
    await auditRbacEvent(req, {
      action: 'permission_group_create',
      eventType: 'permission_group.created',
      eventCategory: 'CREATE',
      operationType: 'CREATE',
      resourceType: 'PermissionGroup',
      resourceId: group._id.toString(),
      afterState: { name: group.name, displayName: group.displayName },
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
    });
    res.status(201).json({ success: true, data: group });
  } catch (error: any) {
    if (error.code === 11000) { res.status(400).json({ success: false, error: 'A permission group with this name already exists' }); return; }
    res.status(500).json({ success: false, error: 'Failed to create permission group' });
  }
});

router.put('/permission-groups/:id', requirePermission('permission_group.update'), validate(updateGroupSchema), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await PermissionGroup.findById(req.params.id);
    if (!existing) { res.status(404).json({ success: false, error: 'Permission group not found' }); return; }
    const beforeState = { name: existing.name, displayName: existing.displayName, description: existing.description };
    const group = await PermissionGroup.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user!.id },
      { new: true },
    );
    if (!group) { res.status(404).json({ success: false, error: 'Permission group not found' }); return; }
    const afterState = { name: group.name, displayName: group.displayName, description: group.description };
    const changedFields = ['name', 'displayName', 'description', 'icon', 'sortOrder']
      .filter((f) => req.body[f] !== undefined)
      .map((f) => ({ field: f, before: (existing as any)[f], after: (group as any)[f] }));
    await auditRbacEvent(req, {
      action: 'permission_group_update',
      eventType: 'permission_group.updated',
      eventCategory: 'UPDATE',
      operationType: 'UPDATE',
      resourceType: 'PermissionGroup',
      resourceId: group._id.toString(),
      beforeState,
      afterState,
      changedFields: changedFields,
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
    });
    res.json({ success: true, data: group });
  } catch (error: any) {
    if (error.code === 11000) { res.status(400).json({ success: false, error: 'A permission group with this name already exists' }); return; }
    res.status(500).json({ success: false, error: 'Failed to update permission group' });
  }
});

router.delete('/permission-groups/:id', requirePermission('permission_group.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const permCount = await Permission.countDocuments({ permissionGroupId: req.params.id });
    if (permCount > 0) {
      res.status(400).json({ success: false, error: `Cannot delete group with ${permCount} permissions. Remove or reassign permissions first.` });
      return;
    }
    const group = await PermissionGroup.findByIdAndDelete(req.params.id);
    if (!group) { res.status(404).json({ success: false, error: 'Permission group not found' }); return; }
    await auditRbacEvent(req, {
      action: 'permission_group_delete',
      eventType: 'permission_group.deleted',
      eventCategory: 'DELETE',
      operationType: 'DELETE',
      resourceType: 'PermissionGroup',
      resourceId: req.params.id,
      beforeState: { name: group.name, displayName: group.displayName },
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
    });
    res.json({ success: true, data: { message: 'Permission group deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete permission group' });
  }
});

// ──────────────────────────────────────────────
// Permissions
// ──────────────────────────────────────────────

const createPermissionSchema = z.object({
  name: z.string().min(1).max(100).transform((v) => v.toLowerCase()),
  displayName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  resource: z.string().min(1).max(50).transform((v) => v.toLowerCase()),
  action: z.string().min(1).max(50).transform((v) => v.toLowerCase()),
  permissionGroupId: z.string().min(1),
});

const updatePermissionSchema = createPermissionSchema.partial();

router.get('/permissions', requirePermission('permission.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { groupId } = req.query;
    const query: any = {};
    if (groupId) query.permissionGroupId = groupId;
    const perms = await Permission.find(query)
      .populate('permissionGroupId', 'name displayName')
      .sort({ resource: 1, action: 1 });
    res.json({ success: true, data: perms });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch permissions' });
  }
});

router.get('/permissions/:id', requirePermission('permission.read'), async (req: AuthRequest, res: Response) => {
  try {
    const perm = await Permission.findById(req.params.id).populate('permissionGroupId', 'name displayName');
    if (!perm) { res.status(404).json({ success: false, error: 'Permission not found' }); return; }
    res.json({ success: true, data: perm });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch permission' });
  }
});

router.post('/permissions', requirePermission('permission.create'), validate(createPermissionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const groupExists = await PermissionGroup.findById(req.body.permissionGroupId);
    if (!groupExists) { res.status(400).json({ success: false, error: 'Permission group not found' }); return; }

    const perm = await Permission.create({ ...req.body, createdBy: req.user!.id });
    await auditRbacEvent(req, {
      action: 'permission_create',
      eventType: 'permission.created',
      eventCategory: 'CREATE',
      operationType: 'CREATE',
      resourceType: 'Permission',
      resourceId: perm._id.toString(),
      afterState: { name: perm.name, resource: perm.resource, action: perm.action, permissionGroupId: perm.permissionGroupId?.toString() },
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
    });
    res.status(201).json({ success: true, data: perm });
  } catch (error: any) {
    if (error.code === 11000) { res.status(400).json({ success: false, error: 'A permission with this name already exists' }); return; }
    res.status(500).json({ success: false, error: 'Failed to create permission' });
  }
});

router.put('/permissions/:id', requirePermission('permission.update'), validate(updatePermissionSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (req.body.permissionGroupId) {
      const groupExists = await PermissionGroup.findById(req.body.permissionGroupId);
      if (!groupExists) { res.status(400).json({ success: false, error: 'Permission group not found' }); return; }
    }
    const existing = await Permission.findById(req.params.id);
    if (!existing) { res.status(404).json({ success: false, error: 'Permission not found' }); return; }
    const beforeState = { name: existing.name, resource: existing.resource, action: existing.action, permissionGroupId: existing.permissionGroupId?.toString() };
    const perm = await Permission.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user!.id },
      { new: true },
    ).populate('permissionGroupId', 'name displayName');
    if (!perm) { res.status(404).json({ success: false, error: 'Permission not found' }); return; }
    const afterState = { name: perm.name, resource: perm.resource, action: perm.action, permissionGroupId: perm.permissionGroupId?.toString() };
    const changedFields = Object.keys(req.body).map((f) => ({ field: f, before: (existing as any)[f], after: (perm as any)[f] }));
    await auditRbacEvent(req, {
      action: 'permission_update',
      eventType: 'permission.updated',
      eventCategory: 'UPDATE',
      operationType: 'UPDATE',
      resourceType: 'Permission',
      resourceId: perm._id.toString(),
      beforeState,
      afterState,
      changedFields,
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
    });
    res.json({ success: true, data: perm });
  } catch (error: any) {
    if (error.code === 11000) { res.status(400).json({ success: false, error: 'A permission with this name already exists' }); return; }
    res.status(500).json({ success: false, error: 'Failed to update permission' });
  }
});

router.delete('/permissions/:id', requirePermission('permission.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const rpCount = await RolePermission.countDocuments({ permissionId: req.params.id });
    if (rpCount > 0) {
      await Permission.findByIdAndUpdate(req.params.id, { isActive: false, updatedBy: req.user!.id });
      await auditRbacEvent(req, {
        action: 'permission_deactivate',
        eventType: 'permission.deactivated',
        eventCategory: 'UPDATE',
        operationType: 'UPDATE',
        resourceType: 'Permission',
        resourceId: req.params.id,
        metadata: { note: `Deactivated instead of deleted — used by ${rpCount} role(s)`, roleCount: rpCount },
        outcome: 'SUCCESS',
        severity: 'MEDIUM',
      });
      res.json({ success: true, data: { message: `Permission deactivated (currently used by ${rpCount} role(s))` } });
      return;
    }
    const perm = await Permission.findByIdAndDelete(req.params.id);
    if (!perm) { res.status(404).json({ success: false, error: 'Permission not found' }); return; }
    await auditRbacEvent(req, {
      action: 'permission_delete',
      eventType: 'permission.deleted',
      eventCategory: 'DELETE',
      operationType: 'DELETE',
      resourceType: 'Permission',
      resourceId: req.params.id,
      beforeState: { name: perm.name, resource: perm.resource, action: perm.action },
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
    });
    res.json({ success: true, data: { message: 'Permission deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete permission' });
  }
});

// ──────────────────────────────────────────────
// Roles
// ──────────────────────────────────────────────

const createRoleSchema = z.object({
  name: z.string().min(1).max(50).transform((v) => v.toUpperCase()),
  displayName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  roleType: z.enum(['system', 'custom']).optional(),
  isSuperAdmin: z.boolean().optional(),
});

const updateRoleSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

router.get('/roles', requirePermission('role.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const roles = await Role.find().sort({ isSuperAdmin: -1, name: 1 });
    res.json({ success: true, data: roles });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch roles' });
  }
});

router.get('/roles/:id', requirePermission('role.read'), async (req: AuthRequest, res: Response) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) { res.status(404).json({ success: false, error: 'Role not found' }); return; }
    res.json({ success: true, data: role });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch role' });
  }
});

router.post('/roles', requirePermission('role.create'), validate(createRoleSchema), async (req: AuthRequest, res: Response) => {
  try {
    const role = await Role.create({ ...req.body, createdBy: req.user!.id, roleType: req.body.roleType || 'custom' });
    await auditRbacEvent(req, {
      action: 'role_create',
      eventType: 'role.created',
      eventCategory: 'CREATE',
      operationType: 'CREATE',
      resourceType: 'Role',
      resourceId: role._id.toString(),
      afterState: { name: role.name, displayName: role.displayName, roleType: role.roleType, isSuperAdmin: role.isSuperAdmin },
      outcome: 'SUCCESS',
      severity: 'HIGH',
    });
    res.status(201).json({ success: true, data: role });
  } catch (error: any) {
    if (error.code === 11000) { res.status(400).json({ success: false, error: 'A role with this name already exists' }); return; }
    res.status(500).json({ success: false, error: 'Failed to create role' });
  }
});

router.put('/roles/:id', requirePermission('role.update'), validate(updateRoleSchema), async (req: AuthRequest, res: Response) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) { res.status(404).json({ success: false, error: 'Role not found' }); return; }
    if (role.isSystemRole && req.body.isActive === false) {
      const otherAdminRole = await Role.findOne({ _id: { $ne: role._id }, isSuperAdmin: true, isActive: true });
      if (!otherAdminRole) { res.status(400).json({ success: false, error: 'Cannot deactivate the only super admin role' }); return; }
    }
    const beforeState = { name: role.name, displayName: role.displayName, isActive: role.isActive, isSuperAdmin: role.isSuperAdmin, description: role.description };
    Object.assign(role, { ...req.body, updatedBy: req.user!.id });
    await role.save();
    const changedFields = Object.keys(req.body).map((f) => ({ field: f, before: (beforeState as any)[f], after: (role as any)[f] }));
    await auditRbacEvent(req, {
      action: 'role_update',
      eventType: 'role.updated',
      eventCategory: 'UPDATE',
      operationType: 'UPDATE',
      resourceType: 'Role',
      resourceId: role._id.toString(),
      beforeState,
      afterState: { name: role.name, displayName: role.displayName, isActive: role.isActive, isSuperAdmin: role.isSuperAdmin, description: role.description },
      changedFields,
      outcome: 'SUCCESS',
      severity: 'HIGH',
    });
    res.json({ success: true, data: role });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update role' });
  }
});

router.delete('/roles/:id', requirePermission('role.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) { res.status(404).json({ success: false, error: 'Role not found' }); return; }
    if (role.isSystemRole) { res.status(400).json({ success: false, error: 'System roles cannot be deleted. Deactivate them instead.' }); return; }

    const userCount = await UserRole.countDocuments({ roleId: req.params.id, isActive: true });
    if (userCount > 0) { res.status(400).json({ success: false, error: `Cannot delete role assigned to ${userCount} user(s). Remove assignments first.` }); return; }

    await RolePermission.deleteMany({ roleId: req.params.id });
    await Role.findByIdAndDelete(req.params.id);
    await auditRbacEvent(req, {
      action: 'role_delete',
      eventType: 'role.deleted',
      eventCategory: 'DELETE',
      operationType: 'DELETE',
      resourceType: 'Role',
      resourceId: req.params.id,
      beforeState: { name: role.name, displayName: role.displayName, roleType: role.roleType },
      metadata: { rolePermissionsRemoved: true },
      outcome: 'SUCCESS',
      severity: 'HIGH',
    });
    res.json({ success: true, data: { message: 'Role deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete role' });
  }
});

router.post('/roles/:id/clone', requirePermission('role.create'), async (req: AuthRequest, res: Response) => {
  try {
    const sourceRole = await Role.findById(req.params.id);
    if (!sourceRole) { res.status(404).json({ success: false, error: 'Source role not found' }); return; }
    const cloneName = `${sourceRole.name}_CLONE`;
    const cloneDisplayName = `${sourceRole.displayName} (Clone)`;
    const beforePerms: string[] = [];
    const sourcePerms = await RolePermission.find({ roleId: req.params.id });
    for (const rp of sourcePerms) { beforePerms.push((rp.permissionId as any)?.toString?.() || rp.permissionId.toString()); }
    const clone = await Role.create({
      name: cloneName,
      displayName: cloneDisplayName,
      description: `Cloned from ${sourceRole.name}`,
      roleType: 'custom',
      isSuperAdmin: false,
      isActive: true,
      createdBy: req.user!.id,
    });
    if (sourcePerms.length > 0) {
      await RolePermission.insertMany(
        sourcePerms.map((rp) => ({
          roleId: clone._id,
          permissionId: rp.permissionId,
          scopeId: rp.scopeId,
          createdBy: req.user!.id,
        })),
      );
    }
    await auditRbacEvent(req, {
      action: 'role_clone',
      eventType: 'role.cloned',
      eventCategory: 'CREATE',
      operationType: 'CREATE',
      resourceType: 'Role',
      resourceId: clone._id.toString(),
      afterState: { name: clone.name, displayName: clone.displayName, sourceRoleId: req.params.id, permissionCount: beforePerms.length },
      metadata: { sourceRoleName: sourceRole.name, clonedRoleName: cloneName },
      outcome: 'SUCCESS',
      severity: 'HIGH',
    });
    res.status(201).json({ success: true, data: clone });
  } catch (error: any) {
    if (error.code === 11000) { res.status(400).json({ success: false, error: 'Role already cloned. Rename or modify the cloned role first.' }); return; }
    res.status(500).json({ success: false, error: 'Failed to clone role' });
  }
});

// ──────────────────────────────────────────────
// Role-Permission Assignments
// ──────────────────────────────────────────────

const assignPermissionSchema = z.object({
  permissionId: z.string().min(1),
  scopeId: z.string().optional(),
});

router.get('/roles/:id/permissions', requirePermission('role.read'), async (req: AuthRequest, res: Response) => {
  try {
    const rolePerms = await RolePermission.find({ roleId: req.params.id })
      .populate('permissionId')
      .populate('scopeId');
    res.json({ success: true, data: rolePerms });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch role permissions' });
  }
});

router.post('/roles/:id/permissions', requirePermission('role.assign_permission'), validate(assignPermissionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) { res.status(404).json({ success: false, error: 'Role not found' }); return; }
    const perm = await Permission.findById(req.body.permissionId);
    if (!perm) { res.status(404).json({ success: false, error: 'Permission not found' }); return; }
    if (req.body.scopeId) {
      const scope = await PermissionScope.findById(req.body.scopeId);
      if (!scope) { res.status(404).json({ success: false, error: 'Scope not found' }); return; }
    }

    const existing = await RolePermission.findOne({ roleId: req.params.id, permissionId: req.body.permissionId });
    if (existing) {
      const oldScope = existing.scopeId?.toString?.();
      existing.scopeId = req.body.scopeId || (undefined as any);
      (existing as any).createdBy = req.user!.id;
      await existing.save();
      const populated = await RolePermission.findById(existing._id).populate('permissionId').populate('scopeId');
      await auditRbacEvent(req, {
        action: 'role_permission_update',
        eventType: 'role_permission.updated',
        eventCategory: 'AUTHZ',
        operationType: 'UPDATE',
        resourceType: 'RolePermission',
        resourceId: existing._id.toString(),
        beforeState: { roleId: req.params.id, permissionId: req.body.permissionId, scopeId: oldScope },
        afterState: { roleId: req.params.id, permissionId: req.body.permissionId, scopeId: req.body.scopeId },
        changedFields: [{ field: 'scopeId', before: oldScope, after: req.body.scopeId }],
        outcome: 'SUCCESS',
        severity: 'HIGH',
      });
      res.json({ success: true, data: populated });
      return;
    }

    const [rp] = await RolePermission.create([{
      roleId: req.params.id,
      permissionId: req.body.permissionId,
      scopeId: req.body.scopeId,
      createdBy: req.user!.id,
    }]);
    const populated = await RolePermission.findById(rp._id).populate('permissionId').populate('scopeId');
    await auditRbacEvent(req, {
      action: 'role_permission_assign',
      eventType: 'role_permission.assigned',
      eventCategory: 'AUTHZ',
      operationType: 'CREATE',
      resourceType: 'RolePermission',
      resourceId: rp._id.toString(),
      afterState: { roleId: req.params.id, permissionId: req.body.permissionId, scopeId: req.body.scopeId },
      outcome: 'SUCCESS',
      severity: 'HIGH',
    });
    res.status(201).json({ success: true, data: populated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to assign permission' });
  }
});

router.delete('/roles/:roleId/permissions/:permId', requirePermission('role.remove_permission'), async (req: AuthRequest, res: Response) => {
  try {
    const rp = await RolePermission.findOneAndDelete({ roleId: req.params.roleId, permissionId: req.params.permId });
    if (!rp) { res.status(404).json({ success: false, error: 'Role permission assignment not found' }); return; }
    const rpId = (rp as any)._id?.toString?.() || rp.toString();
    await auditRbacEvent(req, {
      action: 'role_permission_remove',
      eventType: 'role_permission.removed',
      eventCategory: 'AUTHZ',
      operationType: 'DELETE',
      resourceType: 'RolePermission',
      resourceId: rpId,
      beforeState: { roleId: req.params.roleId, permissionId: req.params.permId, scopeId: (rp as any).scopeId?.toString?.() },
      outcome: 'SUCCESS',
      severity: 'HIGH',
    });
    res.json({ success: true, data: { message: 'Permission removed from role' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to remove permission' });
  }
});

// ──────────────────────────────────────────────
// Permission Scopes
// ──────────────────────────────────────────────

const createScopeSchema = z.object({
  code: z.string().min(1).max(20).transform((v) => v.toUpperCase()),
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
});

const updateScopeSchema = createScopeSchema.partial();

router.get('/scopes', requirePermission('permission.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const scopes = await PermissionScope.find().sort({ code: 1 });
    res.json({ success: true, data: scopes });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch scopes' });
  }
});

router.post('/scopes', requirePermission('permission.create'), validate(createScopeSchema), async (req: AuthRequest, res: Response) => {
  try {
    const scope = await PermissionScope.create(req.body);
    await auditRbacEvent(req, {
      action: 'scope_create',
      eventType: 'scope.created',
      eventCategory: 'CREATE',
      operationType: 'CREATE',
      resourceType: 'PermissionScope',
      resourceId: scope._id.toString(),
      afterState: { code: scope.code, name: scope.name },
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
    });
    res.status(201).json({ success: true, data: scope });
  } catch (error: any) {
    if (error.code === 11000) { res.status(400).json({ success: false, error: 'A scope with this code already exists' }); return; }
    res.status(500).json({ success: false, error: 'Failed to create scope' });
  }
});

router.put('/scopes/:id', requirePermission('permission.update'), validate(updateScopeSchema), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await PermissionScope.findById(req.params.id);
    if (!existing) { res.status(404).json({ success: false, error: 'Scope not found' }); return; }
    const beforeState = { code: existing.code, name: existing.name, description: existing.description };
    const scope = await PermissionScope.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!scope) { res.status(404).json({ success: false, error: 'Scope not found' }); return; }
    const afterState = { code: scope.code, name: scope.name, description: scope.description };
    const changedFields = Object.keys(req.body).map((f) => ({ field: f, before: (existing as any)[f], after: (scope as any)[f] }));
    await auditRbacEvent(req, {
      action: 'scope_update',
      eventType: 'scope.updated',
      eventCategory: 'UPDATE',
      operationType: 'UPDATE',
      resourceType: 'PermissionScope',
      resourceId: scope._id.toString(),
      beforeState,
      afterState,
      changedFields,
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
    });
    res.json({ success: true, data: scope });
  } catch (error: any) {
    if (error.code === 11000) { res.status(400).json({ success: false, error: 'A scope with this code already exists' }); return; }
    res.status(500).json({ success: false, error: 'Failed to update scope' });
  }
});

router.delete('/scopes/:id', requirePermission('permission.delete'), async (req: AuthRequest, res: Response) => {
  try {
    const rpCount = await RolePermission.countDocuments({ scopeId: req.params.id });
    if (rpCount > 0) {
      res.status(400).json({ success: false, error: `Cannot delete scope used by ${rpCount} role-permission assignments` });
      return;
    }
    const scope = await PermissionScope.findByIdAndDelete(req.params.id);
    if (!scope) { res.status(404).json({ success: false, error: 'Scope not found' }); return; }
    await auditRbacEvent(req, {
      action: 'scope_delete',
      eventType: 'scope.deleted',
      eventCategory: 'DELETE',
      operationType: 'DELETE',
      resourceType: 'PermissionScope',
      resourceId: req.params.id,
      beforeState: { code: scope.code, name: scope.name },
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
    });
    res.json({ success: true, data: { message: 'Scope deleted' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete scope' });
  }
});

// ──────────────────────────────────────────────
// User Role Assignments
// ──────────────────────────────────────────────

const assignRoleSchema = z.object({
  roleId: z.string().min(1),
});

router.get('/users/:userId/roles', requirePermission('user.read'), async (req: AuthRequest, res: Response) => {
  try {
    const assignments = await UserRole.find({ userId: req.params.userId, isActive: true })
      .populate('roleId', 'name displayName description isSuperAdmin isActive')
      .populate('assignedBy', 'fullName email')
      .sort({ assignedAt: -1 });
    res.json({ success: true, data: assignments });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch user roles' });
  }
});

router.post('/users/:userId/roles', requirePermission('user.assign_role'), validate(assignRoleSchema), async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ _id: req.params.userId, deletedAt: null });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    const role = await Role.findById(req.body.roleId);
    if (!role) { res.status(404).json({ success: false, error: 'Role not found' }); return; }

    const existing = await UserRole.findOne({ userId: req.params.userId, roleId: req.body.roleId });
    if (existing) {
      if (existing.isActive) { res.status(400).json({ success: false, error: 'User already has this role' }); return; }
      existing.isActive = true;
      existing.assignedBy = req.user!.id as any;
      await existing.save();
      await auditRbacEvent(req, {
        action: 'user_role_assign',
        eventType: 'user_role.assigned',
        eventCategory: 'AUTHZ',
        operationType: 'UPDATE',
        resourceType: 'UserRole',
        resourceId: existing._id.toString(),
        beforeState: { userId: req.params.userId, roleId: req.body.roleId, isActive: false },
        afterState: { userId: req.params.userId, roleId: req.body.roleId, isActive: true },
        outcome: 'SUCCESS',
        severity: 'HIGH',
      });
      const populated = await UserRole.findById(existing._id).populate('roleId', 'name displayName');
      res.json({ success: true, data: populated });
      return;
    }

    const ur = await UserRole.create({
      userId: req.params.userId,
      roleId: req.body.roleId,
      assignedBy: req.user!.id,
    });
    const populated = await UserRole.findById(ur._id).populate('roleId', 'name displayName');
    await auditRbacEvent(req, {
      action: 'user_role_assign',
      eventType: 'user_role.assigned',
      eventCategory: 'AUTHZ',
      operationType: 'CREATE',
      resourceType: 'UserRole',
      resourceId: ur._id.toString(),
      afterState: { userId: req.params.userId, roleId: req.body.roleId, isActive: true },
      outcome: 'SUCCESS',
      severity: 'HIGH',
    });
    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    if (error.code === 11000) { res.status(400).json({ success: false, error: 'User already has this role' }); return; }
    res.status(500).json({ success: false, error: 'Failed to assign role' });
  }
});

router.delete('/users/:userId/roles/:roleId', requirePermission('user.remove_role'), async (req: AuthRequest, res: Response) => {
  try {
    const role = await Role.findById(req.params.roleId);
    if (role?.isSuperAdmin) {
      const superAdminCount = await UserRole.countDocuments({
        roleId: req.params.roleId,
        isActive: true,
      });
      if (superAdminCount <= 1) { res.status(400).json({ success: false, error: 'Cannot remove the last Super Admin. Assign another user as Super Admin first.' }); return; }
    }
    const ur = await UserRole.findOneAndUpdate(
      { userId: req.params.userId, roleId: req.params.roleId, isActive: true },
      { isActive: false },
      { new: true },
    );
    if (!ur) { res.status(404).json({ success: false, error: 'Role assignment not found' }); return; }
    await auditRbacEvent(req, {
      action: 'user_role_remove',
      eventType: 'user_role.removed',
      eventCategory: 'AUTHZ',
      operationType: 'DELETE',
      resourceType: 'UserRole',
      resourceId: ur._id.toString(),
      beforeState: { userId: req.params.userId, roleId: req.params.roleId, isActive: true },
      afterState: { userId: req.params.userId, roleId: req.params.roleId, isActive: false },
      outcome: 'SUCCESS',
      severity: 'HIGH',
    });
    res.json({ success: true, data: { message: 'Role removed from user' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to remove role' });
  }
});

// ──────────────────────────────────────────────
// Effective Permissions (for debugging)
// ──────────────────────────────────────────────

router.get('/users/:userId/effective-permissions', requirePermission('user.read'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await getEffectivePermissions(req.params.userId);
    res.json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch effective permissions' });
  }
});

// ──────────────────────────────────────────────
// Check specific permission (for UI)
// ──────────────────────────────────────────────

router.get('/check/:permissionName', async (req: AuthRequest, res: Response) => {
  try {
    const { userHasPermission } = await import('../services/authorization.service');
    const result = await userHasPermission(req.user!.id, req.params.permissionName, req.query.scope as string | undefined);
    res.json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to check permission' });
  }
});

export default router;

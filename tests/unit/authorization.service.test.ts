import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock @pawtag/db models ────────────────────────────────────────
vi.mock('@pawtag/db', () => ({
  UserRole: {
    find: vi.fn(),
  },
  Role: {
    find: vi.fn(),
  },
  Permission: {
    findOne: vi.fn(),
    find: vi.fn(),
  },
  RolePermission: {
    find: vi.fn(),
  },
}));

import { UserRole, Role, Permission, RolePermission } from '@pawtag/db';
import { userHasPermission, getEffectivePermissions } from '../../packages/api/src/services/authorization.service';

const mockUserRoleFind = vi.mocked(UserRole.find);
const mockRoleFind = vi.mocked(Role.find);
const mockPermissionFindOne = vi.mocked(Permission.findOne);
const mockPermissionFind = vi.mocked(Permission.find);
const mockRolePermissionFind = vi.mocked(RolePermission.find);

function chainQuery(result: any[]) {
  const chain: any = {
    populate: vi.fn().mockReturnThis(),
    lean: vi.fn().mockReturnValue(result),
    then: (resolve: any) => resolve(result),
  };
  // Allow .populate().populate().lean() chaining
  chain.populate.mockReturnValue(chain);
  return chain;
}

describe('authorization.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('userHasPermission', () => {
    it('returns allowed:true for super admin', async () => {
      mockUserRoleFind.mockReturnValue(chainQuery([
        {
          roleId: { _id: 'role-1', isSuperAdmin: true, isActive: true },
        },
      ]));

      const result = await userHasPermission('user-1', 'manage_users');

      expect(result).toEqual({ allowed: true, scope: null });
    });

    it('returns allowed:false when user has no roles', async () => {
      mockUserRoleFind.mockReturnValue(chainQuery([]));

      const result = await userHasPermission('user-1', 'manage_users');

      expect(result).toEqual({ allowed: false, scope: null });
    });

    it('returns allowed:false when permission is not found', async () => {
      mockUserRoleFind.mockReturnValue(chainQuery([
        { roleId: { _id: 'role-1', isSuperAdmin: false, isActive: true } },
      ]));
      mockPermissionFindOne.mockResolvedValue(null);

      const result = await userHasPermission('user-1', 'nonexistent_permission');

      expect(result).toEqual({ allowed: false, scope: null });
    });

    it('returns allowed:true when role has permission (no scope required)', async () => {
      mockUserRoleFind.mockReturnValue(chainQuery([
        { roleId: { _id: 'role-1', isSuperAdmin: false, isActive: true } },
      ]));
      mockPermissionFindOne.mockResolvedValue({ _id: 'perm-1', name: 'manage_users', isActive: true } as any);
      mockRolePermissionFind.mockReturnValue(chainQuery([
        { roleId: 'role-1', permissionId: 'perm-1', scopeId: null },
      ]));

      const result = await userHasPermission('user-1', 'manage_users');

      expect(result).toEqual({ allowed: true, scope: null });
    });

    it('returns allowed:true when role has permission with matching scope', async () => {
      mockUserRoleFind.mockReturnValue(chainQuery([
        { roleId: { _id: 'role-1', isSuperAdmin: false, isActive: true } },
      ]));
      mockPermissionFindOne.mockResolvedValue({ _id: 'perm-1', name: 'manage_pets', isActive: true } as any);
      mockRolePermissionFind.mockReturnValue(chainQuery([
        {
          roleId: 'role-1',
          permissionId: 'perm-1',
          scopeId: { code: 'own' },
        },
      ]));

      const result = await userHasPermission('user-1', 'manage_pets', 'own');

      expect(result).toEqual({ allowed: true, scope: 'own' });
    });

    it('returns allowed:false when role has permission with wrong scope', async () => {
      mockUserRoleFind.mockReturnValue(chainQuery([
        { roleId: { _id: 'role-1', isSuperAdmin: false, isActive: true } },
      ]));
      mockPermissionFindOne.mockResolvedValue({ _id: 'perm-1', name: 'manage_pets', isActive: true } as any);
      mockRolePermissionFind.mockReturnValue(chainQuery([
        {
          roleId: 'role-1',
          permissionId: 'perm-1',
          scopeId: { code: 'own' },
        },
      ]));

      const result = await userHasPermission('user-1', 'manage_pets', 'all');

      expect(result).toEqual({ allowed: false, scope: null });
    });
  });

  describe('getEffectivePermissions', () => {
    it('returns all permissions for super admin', async () => {
      mockUserRoleFind.mockReturnValue(chainQuery([
        { roleId: { _id: 'role-1', isSuperAdmin: true, isActive: true } },
      ]));
      mockPermissionFind.mockReturnValue(chainQuery([
        { name: 'manage_users', displayName: 'Manage Users', resource: 'users', action: 'manage' },
        { name: 'manage_pets', displayName: 'Manage Pets', resource: 'pets', action: 'manage' },
      ]));

      const result = await getEffectivePermissions('user-1');

      expect(result.roleNames).toEqual(['All Permissions (Super Admin)']);
      expect(result.permissions).toHaveLength(2);
      expect(result.permissions[0]).toEqual({
        name: 'manage_users',
        displayName: 'Manage Users',
        resource: 'users',
        action: 'manage',
        scope: undefined,
      });
    });

    it('returns role-specific permissions for non-admin user', async () => {
      mockUserRoleFind.mockReturnValue(chainQuery([
        { roleId: { _id: 'role-1', isSuperAdmin: false, isActive: true } },
      ]));
      mockRoleFind.mockReturnValue(chainQuery([
        { _id: 'role-1', displayName: 'Shop Manager', isActive: true },
      ]));
      mockRolePermissionFind.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockReturnValue([
              {
                permissionId: { name: 'manage_products', displayName: 'Manage Products', resource: 'products', action: 'manage' },
                scopeId: { code: 'own' },
              },
              {
                permissionId: { name: 'view_orders', displayName: 'View Orders', resource: 'orders', action: 'read' },
                scopeId: null,
              },
            ]),
          }),
        }),
      } as any);

      const result = await getEffectivePermissions('user-1');

      expect(result.roleIds).toEqual(['role-1']);
      expect(result.roleNames).toEqual(['Shop Manager']);
      expect(result.permissions).toHaveLength(2);
      expect(result.permissions[0].scope).toBe('own');
      expect(result.permissions[1].scope).toBeUndefined();
    });
  });
});

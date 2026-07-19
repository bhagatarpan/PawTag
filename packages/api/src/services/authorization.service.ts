import { Role, UserRole, RolePermission, Permission } from '@pawtag/db';

interface PermissionCheckResult {
  allowed: boolean;
  scope?: string | null;
}

async function getUserRoles(userId: string): Promise<{ roleId: string; isSuperAdmin: boolean }[]> {
  const assignments = await UserRole.find({ userId, isActive: true })
    .populate<{ roleId: { _id: string; isSuperAdmin: boolean } }>({
      path: 'roleId',
      select: 'isSuperAdmin isActive',
      match: { isActive: true },
    });

  return assignments
    .filter((a) => a.roleId)
    .map((a) => ({
      roleId: (a.roleId as unknown as { _id: string })._id.toString(),
      isSuperAdmin: (a.roleId as unknown as { isSuperAdmin: boolean }).isSuperAdmin,
    }));
}

export async function userHasPermission(
  userId: string,
  permissionName: string,
  scopeCode?: string,
): Promise<PermissionCheckResult> {
  const userRoles = await getUserRoles(userId);

  if (userRoles.some((r) => r.isSuperAdmin)) {
    return { allowed: true, scope: null };
  }

  if (userRoles.length === 0) {
    return { allowed: false, scope: null };
  }

  const permission = await Permission.findOne({ name: permissionName, isActive: true });
  if (!permission) {
    return { allowed: false, scope: null };
  }

  const roleIds = userRoles.map((r) => r.roleId);
  const rolePerms = await RolePermission.find({
    roleId: { $in: roleIds },
    permissionId: permission._id,
  }).populate<{ scopeId: { code: string } | null }>({
    path: 'scopeId',
    select: 'code',
  });

  if (rolePerms.length === 0) {
    return { allowed: false, scope: null };
  }

  if (!scopeCode) {
    return { allowed: true, scope: null };
  }

  const matchingScope = rolePerms.find((rp) => {
    const scope = rp.scopeId as unknown as { code: string } | null;
    return scope && scope.code === scopeCode;
  });

  if (matchingScope) {
    return { allowed: true, scope: scopeCode };
  }

  return { allowed: false, scope: null };
}

export async function getEffectivePermissions(
  userId: string,
): Promise<{
  roleIds: string[];
  roleNames: string[];
  permissions: { name: string; displayName: string; resource: string; action: string; scope?: string }[];
}> {
  const userRoles = await getUserRoles(userId);

  if (userRoles.some((r) => r.isSuperAdmin)) {
    const allPerms = await Permission.find({ isActive: true }).lean();
    return {
      roleIds: userRoles.map((r) => r.roleId),
      roleNames: ['All Permissions (Super Admin)'],
      permissions: allPerms.map((p) => ({
        name: p.name,
        displayName: p.displayName,
        resource: p.resource,
        action: p.action,
        scope: undefined,
      })),
    };
  }

  const roleIds = userRoles.map((r) => r.roleId);
  const roles = await Role.find({ _id: { $in: roleIds }, isActive: true }).lean();

  const rolePerms = await RolePermission.find({ roleId: { $in: roleIds } })
    .populate<{ permissionId: { name: string; displayName: string; resource: string; action: string } }>({
      path: 'permissionId',
      select: 'name displayName resource action',
      match: { isActive: true },
    })
    .populate<{ scopeId: { code: string } | null }>({
      path: 'scopeId',
      select: 'code',
    })
    .lean();

  const permissions = rolePerms
    .filter((rp) => rp.permissionId)
    .map((rp) => {
      const perm = rp.permissionId as unknown as { name: string; displayName: string; resource: string; action: string };
      const scope = rp.scopeId as unknown as { code: string } | null;
      return {
        name: perm.name,
        displayName: perm.displayName,
        resource: perm.resource,
        action: perm.action,
        scope: scope?.code || undefined,
      };
    });

  return {
    roleIds,
    roleNames: roles.map((r) => r.displayName),
    permissions,
  };
}



import { User } from '@pawtag/db';

export interface ActorInfo {
  fullName: string;
  displayName: string;
  roleName: string;
}

export async function resolveActor(
  userId: string,
  fallbackType: 'customer' | 'admin' = 'admin',
): Promise<ActorInfo> {
  const user = await User.findById(userId)
    .select('fullName role roles')
    .populate({
      path: 'roles',
      select: 'name displayName isSuperAdmin isSystemRole isActive',
      options: { sort: { isSuperAdmin: -1, isSystemRole: -1 } },
    })
    .lean();

  if (!user) {
    return {
      fullName: 'Unknown User',
      displayName: fallbackType === 'customer' ? 'Customer' : 'Unknown',
      roleName: fallbackType === 'customer' ? 'CUSTOMER' : 'UNKNOWN',
    };
  }

  const rolesArr = (user.roles as any[]) || [];
  // Pick the highest-privileged active role (isSuperAdmin > isSystemRole)
  const sortedRoles = [...rolesArr].sort((a: any, b: any) => {
    const aSuper = a.isSuperAdmin ? 1 : 0;
    const bSuper = b.isSuperAdmin ? 1 : 0;
    if (aSuper !== bSuper) return bSuper - aSuper;
    const aSys = a.isSystemRole ? 1 : 0;
    const bSys = b.isSystemRole ? 1 : 0;
    return bSys - aSys;
  });
  const activeRole = sortedRoles.find((r: any) => r.isActive) || sortedRoles[0];
  if (activeRole) {
    return {
      fullName: user.fullName || 'Unknown User',
      displayName: activeRole.displayName || 'Unknown',
      roleName: activeRole.name || 'UNKNOWN',
    };
  }

  const legacyRole = (user as any).role || (fallbackType === 'customer' ? 'CUSTOMER' : 'ADMIN');
  return {
    fullName: user.fullName || 'Unknown User',
    displayName: legacyRole.charAt(0).toUpperCase() + legacyRole.slice(1).toLowerCase(),
    roleName: legacyRole.toUpperCase(),
  };
}

export function formatCancelledBy(fullName: string, roleDisplayName: string): string {
  if (roleDisplayName.toLowerCase() === 'customer') {
    return `Customer (${fullName})`;
  }
  return `${fullName} (${roleDisplayName})`;
}

export function formatCancellationPortalLabel(portal: string): string {
  switch (portal) {
    case 'customer-web': return 'Customer Web Portal';
    case 'customer-mobile': return 'Customer Mobile App';
    case 'admin-web': return 'Admin Web Portal';
    case 'system': return 'System (Auto)';
    default: return portal;
  }
}

export function formatCancelledByDescription(
  portal: string,
  fullName: string,
  roleDisplayName: string,
): string {
  const portalLabel = formatCancellationPortalLabel(portal);
  if (portal === 'system') {
    return `Order is auto-cancelled by System`;
  }
  if (portal.startsWith('customer')) {
    return `Order is Cancelled via ${portalLabel} by ${fullName}`;
  }
  return `Order is Cancelled via ${portalLabel} by ${fullName} (${roleDisplayName})`;
}

export function formatActivityMessage(
  cancelledBy: string,
  reason: string,
  at: Date = new Date(),
): string {
  return `Order cancelled by ${cancelledBy}: ${reason} : AT : ${at.toISOString()}`;
}

export function formatSystemActivityMessage(
  reason: string,
  at: Date = new Date(),
): string {
  return `Order auto-cancelled by System: ${reason} : AT : ${at.toISOString()}`;
}

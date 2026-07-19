import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { UserRole } from '@pawtag/db';

/**
 * @deprecated Use requirePermission() from ./permission.ts instead.
 * This middleware is kept for backward compatibility only.
 * All new routes should use requirePermission() for fine-grained RBAC.
 */
export function authorize(..._roles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    // Check RBAC UserRole assignments (database-driven, not hard-coded)
    try {
      const assignments = await UserRole.find({ userId: req.user.id, isActive: true })
        .populate<{ roleId: { name: string; isActive: boolean } }>({
          path: 'roleId',
          select: 'name isActive',
          match: { isActive: true },
        });

      const assignedRoleNames = assignments
        .filter((a) => a.roleId)
        .map((a) => {
          const role = a.roleId as unknown as { name: string };
          return role.name;
        });

      // Check if user has any of the required roles
      const hasRole = _roles.some((r) =>
        assignedRoleNames.some((assigned) => assigned.toUpperCase() === r.toUpperCase()),
      );

      if (hasRole) {
        next();
        return;
      }
    } catch {
      // Fall through to deny
    }

    res.status(403).json({ success: false, error: 'Insufficient permissions' });
  };
}

// Convenience middleware (deprecated — use requirePermission() instead)
export const adminOnly = authorize('SUPER_ADMIN', 'ADMIN');
export const superAdminOnly = authorize('SUPER_ADMIN');
export const supportOrAdmin = authorize('SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE');
export const authenticated = authorize('SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SERVICE', 'PET_OWNER', 'WEBSITE_EDITOR');

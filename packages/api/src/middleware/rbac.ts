import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

type Role = 'super_admin' | 'admin' | 'support' | 'customer';

export function authorize(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    if (!roles.includes(req.user.role as Role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

// Convenience middleware
export const adminOnly = authorize('super_admin', 'admin');
export const superAdminOnly = authorize('super_admin');
export const supportOrAdmin = authorize('super_admin', 'admin', 'support');
export const authenticated = authorize('super_admin', 'admin', 'support', 'customer');

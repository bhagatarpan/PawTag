import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { userHasPermission } from '../services/authorization.service';

export function requirePermission(permissionName: string, scopeCode?: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    try {
      const result = await userHasPermission(req.user.id, permissionName, scopeCode);
      if (!result.allowed) {
        res.status(403).json({ success: false, error: 'Insufficient permissions' });
        return;
      }
      next();
    } catch (error) {
      res.status(500).json({ success: false, error: 'Authorization check failed' });
    }
  };
}

export function requireAnyPermission(permissionNames: string[], scopeCode?: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    try {
      for (const perm of permissionNames) {
        const result = await userHasPermission(req.user.id, perm, scopeCode);
        if (result.allowed) {
          next();
          return;
        }
      }
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Authorization check failed' });
    }
  };
}

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { userHasPermission } from '../services/authorization.service';
import { auditService, type AuditContext } from '../services/audit';
import logger from '../lib/logger';

/**
 * Emit an AUTHZ FAILURE event for a denied/invalid authorization attempt.
 * Never blocks the response; never silently dropped (errors are logged).
 */
function auditDenied(req: AuthRequest, permissionName: string, code: string): void {
  const context = req.auditContext as AuditContext | undefined;
  if (!context) return;
  auditService
    .log(context, {
      action: 'access_denied',
      eventType: 'authorization_failure',
      eventCategory: 'AUTHZ',
      operationType: 'CHECK',
      resourceType: 'permission',
      resourceId: permissionName,
      outcome: 'FAILURE',
      severity: 'HIGH',
      status: 'denied',
      reason: `missing permission ${permissionName}`,
      metadata: { permissionCode: code, method: (req as any).method, path: (req as any).originalUrl },
    })
    .catch((err) => {
      logger.error({ err, permissionName }, 'Failed to persist access-denied audit event');
    });
}

export function requirePermission(permissionName: string, scopeCode?: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      auditDenied(req, permissionName, 'not_authenticated');
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    try {
      const result = await userHasPermission(req.user.id, permissionName, scopeCode);
      if (!result.allowed) {
        auditDenied(req, permissionName, 'insufficient_permission');
        res.status(403).json({ success: false, error: 'Insufficient permissions' });
        return;
      }
      next();
    } catch {
      auditDenied(req, permissionName, 'authorization_check_failed');
      res.status(500).json({ success: false, error: 'Authorization check failed' });
    }
  };
}
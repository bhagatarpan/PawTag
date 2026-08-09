import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { auditService, type AuditContext } from '../services/audit';
import logger from '../lib/logger';

/**
 * Record a validation failure as an audit event (outcome FAILURE).
 * Never blocks the response; never silently dropped.
 */
function auditValidationFailure(req: Request, errors: { field: string; message: string }[]): void {
  const context = (req as any).auditContext as AuditContext | undefined;
  if (!context) return;
  auditService
    .log(context, {
      action: 'validation_failed',
      eventType: 'validation_failure',
      eventCategory: 'AUTHZ',
      operationType: 'CHECK',
      resourceType: 'request',
      resourceId: `${req.method} ${req.originalUrl}`,
      outcome: 'FAILURE',
      severity: 'LOW',
      status: 'rejected',
      reason: 'request body failed validation',
      metadata: { method: req.method, path: req.originalUrl, errors },
    })
    .catch((err) => logger.error({ err }, 'Failed to persist validation-failure audit event'));
}

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      auditValidationFailure(req, errors);
      res.status(400).json({ success: false, error: 'Validation failed', details: errors });
      return;
    }
    req.body = result.data;
    next();
  };
}
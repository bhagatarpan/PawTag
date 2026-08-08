import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuditContext {
  requestId: string;
  correlationId: string;
  traceId: string;
  transactionId: string;
  startTime: number;
  durationMs?: number;
  actorType: string;
  actorId?: string;
  actorUsername?: string;
  actorEmail?: string;
  impersonatorId?: string;
  delegatedById?: string;
  sessionId?: string;
  authenticationMethod?: string;
  authenticationContext?: Record<string, unknown>;
  sourceIp: string;
  forwardedIp?: string;
  userAgent: string;
  deviceId?: string;
  applicationName: string;
  applicationVersion: string;
  apiVersion: string;
  environment: string;
  tenantId?: string;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  auditContext?: AuditContext;
}

// Re-export AuditRequest as alias for backward compatibility
export type AuditRequest = AuthRequest;

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      id: string;
      email: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

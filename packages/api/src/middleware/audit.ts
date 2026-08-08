import { Request, Response, NextFunction } from 'express';
import { v7 as uuidv7 } from 'uuid';
import { config } from '../config';
import { AuthRequest, AuditContext, AuditRequest } from './auth';

export type { AuditRequest, AuditContext } from './auth';

function getClientIp(req: Request): string {
  return req.ip ||
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.headers['x-real-ip']?.toString() ||
    req.socket?.remoteAddress ||
    'unknown';
}

function getForwardedIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = forwarded.toString().split(',').map((ip) => ip.trim());
    return ips.length > 1 ? ips[1] : undefined;
  }
  return req.headers['x-real-ip']?.toString();
}

function getDeviceId(req: Request): string | undefined {
  return req.headers['x-device-id']?.toString() ||
    req.headers['sec-ch-ua-platform']?.toString() ||
    undefined;
}

export function auditMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const requestId = req.headers['x-request-id']?.toString() || uuidv7();
  const correlationId = req.headers['x-correlation-id']?.toString() || uuidv7();
  const traceId = req.headers['x-trace-id']?.toString() || uuidv7();
  const transactionId = req.headers['x-transaction-id']?.toString() || uuidv7();

  req.auditContext = {
    requestId,
    correlationId,
    traceId,
    transactionId,
    startTime: Date.now(),
    actorType: 'UNKNOWN',
    sourceIp: getClientIp(req),
    forwardedIp: getForwardedIp(req),
    userAgent: req.headers['user-agent']?.toString() || 'unknown',
    deviceId: getDeviceId(req),
    applicationName: req.headers['x-app-name']?.toString() || 'pawtag-api',
    applicationVersion: req.headers['x-app-version']?.toString() || '1.0.0',
    apiVersion: req.headers['x-api-version']?.toString() || 'v1',
    environment: config.nodeEnv || 'development',
    tenantId: req.headers['x-tenant-id']?.toString(),
  };

  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Correlation-ID', correlationId);
  res.setHeader('X-Trace-ID', traceId);
  res.setHeader('X-Transaction-ID', transactionId);

  const originalSend = res.send;
  res.send = function (body?: unknown): Response {
    if (req.auditContext) {
      req.auditContext.durationMs = Date.now() - req.auditContext.startTime;
    }
    return originalSend.call(this, body);
  };

  next();
}

export function setAuditActor(
  req: AuditRequest,
  actor: {
    actorType: string;
    actorId?: string;
    actorUsername?: string;
    actorEmail?: string;
    impersonatorId?: string;
    delegatedById?: string;
    sessionId?: string;
    authenticationMethod?: string;
    authenticationContext?: Record<string, unknown>;
  },
): void {
  if (req.auditContext) {
    req.auditContext = {
      ...req.auditContext,
      actorType: actor.actorType,
      actorId: actor.actorId,
      actorUsername: actor.actorUsername,
      actorEmail: actor.actorEmail,
      impersonatorId: actor.impersonatorId,
      delegatedById: actor.delegatedById,
      sessionId: actor.sessionId,
      authenticationMethod: actor.authenticationMethod,
      authenticationContext: actor.authenticationContext,
    };
  }
}

export function getAuditContext(req: AuditRequest): AuditRequest['auditContext'] {
  return req.auditContext;
}

export function createAuditContextFromRequest(req: AuditRequest, overrides: Partial<AuditRequest['auditContext']> = {}): AuditRequest['auditContext'] {
  const context = req.auditContext;
  if (!context) {
    throw new Error('Audit middleware not applied - request has no audit context');
  }
  return {
    ...context,
    ...overrides,
  } as AuditRequest['auditContext'];
}

export function createTransactionId(): string {
  return uuidv7();
}

export function createCorrelationId(): string {
  return uuidv7();
}

export function createTraceId(): string {
  return uuidv7();
}
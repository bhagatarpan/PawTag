import { Request, Response, NextFunction } from 'express';
import { v7 as uuidv7 } from 'uuid';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthRequest, AuditContext, AuditRequest } from './auth';
import { auditService } from '../services/audit';
import { Setting } from '@pawtag/db';
import logger from '../lib/logger';

// Cache for identifyAnonymousActors setting (5 second TTL)
let cachedIdentifySetting: string | null = null;
let cachedIdentifyAt = 0;
const IDENTIFY_CACHE_TTL_MS = 5000;

async function shouldIdentifyAnonymousActors(): Promise<boolean> {
  if (cachedIdentifySetting !== null && Date.now() - cachedIdentifyAt < IDENTIFY_CACHE_TTL_MS) {
    return cachedIdentifySetting !== 'false';
  }
  try {
    const setting = await Setting.findOne({ key: 'audit.settings.identifyAnonymousActors' }).lean();
    cachedIdentifySetting = setting?.value || 'true';
    cachedIdentifyAt = Date.now();
    return cachedIdentifySetting !== 'false';
  } catch {
    return true; // Default to enabled
  }
}

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

function getRequestPath(req: Request): string {
  return req.originalUrl.split('?')[0];
}

/**
 * Try to identify the user from the JWT token without verifying it.
 * This is used for audit logging when auth middleware fails.
 */
function identifyFromToken(req: Request): { actorId?: string; actorEmail?: string; actorUsername?: string } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.split(' ')[1];
  try {
    // Decode without verification to get user info for audit logging
    const decoded = jwt.decode(token) as { id?: string; email?: string } | null;
    if (decoded?.id && decoded?.email) {
      return {
        actorId: decoded.id,
        actorEmail: decoded.email,
        actorUsername: decoded.email.split('@')[0],
      };
    }
  } catch { /* token is malformed, ignore */ }
  return null;
}

function shouldAuditRequest(req: Request): boolean {
  const path = getRequestPath(req);
  if (path === '/health' || path === '/favicon.ico' || path.startsWith('/api/docs')) return false;
  if (path.startsWith('/api/admin/audit')) return false;
  if (path.startsWith('/api/public/cms') || path.startsWith('/api/finder/shop') || path.startsWith('/api/finder/content')) return false;
  // Skip automated polling endpoints (notification badge checks, etc.)
  if (path.includes('/unread-count') || path.includes('/poll')) return false;
  return path.startsWith('/api/');
}

function requestCategory(req: Request): string {
  const path = getRequestPath(req);
  if (path.startsWith('/api/auth')) return 'AUTH';
  if (path.startsWith('/api/webhooks')) return 'INTEGRATION';
  if (/\/(export|print|download|qr|sticker)(\/|$)/i.test(path)) return 'EXPORT';
  if (path.includes('/upload')) return 'FILE';
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return 'READ';
  if (req.method === 'POST') return 'CREATE';
  if (req.method === 'PUT' || req.method === 'PATCH') return 'UPDATE';
  if (req.method === 'DELETE') return 'DELETE';
  return 'SYSTEM';
}

function requestActor(req: AuthRequest): string {
  const path = getRequestPath(req);
  if (req.auditContext?.actorType && req.auditContext.actorType !== 'UNKNOWN') return req.auditContext.actorType;
  if (path.startsWith('/api/finder')) return 'FINDER';
  if (path.startsWith('/api/webhooks')) return 'WEBHOOK';
  return 'UNKNOWN';
}

async function auditCompletedRequest(req: AuthRequest, res: Response): Promise<void> {
  if (!shouldAuditRequest(req)) return;
  const path = getRequestPath(req);
  const category = requestCategory(req);
  const actorType = requestActor(req);
  const outcome = res.statusCode >= 400 ? 'FAILURE' : 'SUCCESS';
  const queryKeys = Object.keys(req.query || {});
  const bodyFields = req.body && typeof req.body === 'object' ? Object.keys(req.body) : [];

  // If actor is UNKNOWN, check if we can identify from JWT token (if setting is enabled)
  let identifiedActor = {};
  if (actorType === 'UNKNOWN' && (req.auditContext as any)?.potentialActorId) {
    const identifyEnabled = await shouldIdentifyAnonymousActors();
    if (identifyEnabled) {
      identifiedActor = {
        actorId: (req.auditContext as any).potentialActorId,
        actorEmail: (req.auditContext as any).potentialActorEmail,
        actorUsername: (req.auditContext as any).potentialActorUsername,
      };
    }
  }

  auditService.log({
    ...(req.auditContext as AuditContext),
    actorType: actorType as any,
    ...identifiedActor,
  }, {
    action: `http_${req.method.toLowerCase()}`,
    eventType: 'http.request.completed',
    eventCategory: category as any,
    operationType: req.method,
    resourceType: 'HTTP_ENDPOINT',
    resourceId: path,
    outcome,
    status: String(res.statusCode),
    severity: outcome === 'FAILURE' ? 'MEDIUM' : 'INFO',
    durationMs: req.auditContext?.durationMs,
    metadata: {
      method: req.method,
      path,
      queryKeys,
      bodyFields,
      responseStatus: res.statusCode,
    },
  }).catch((error) => logger.error({ err: error, path }, 'Failed to persist request audit event'));
}

export function auditMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const requestId = req.headers['x-request-id']?.toString() || uuidv7();
  const correlationId = req.headers['x-correlation-id']?.toString() || uuidv7();
  const traceId = req.headers['x-trace-id']?.toString() || uuidv7();
  const transactionId = req.headers['x-transaction-id']?.toString() || uuidv7();

  // Try to identify user from JWT token (even if auth fails)
  const potentialActor = identifyFromToken(req);

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
    // Store potential actor info for audit logging if auth fails
    potentialActorId: potentialActor?.actorId,
    potentialActorEmail: potentialActor?.actorEmail,
    potentialActorUsername: potentialActor?.actorUsername,
  } as any;

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

  res.once('finish', () => auditCompletedRequest(req, res));

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

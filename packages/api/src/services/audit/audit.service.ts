import { createAuditEventId, AuditEvent, type IAuditEventDocument, type ActorType, type EventCategory, type EventSeverity, type EventOutcome, type IChangedField } from '@pawtag/db';
import { createHash } from 'crypto';
import logger from '../../lib/logger';

export interface AuditContext {
  actorType: ActorType;
  actorId?: string;
  actorUsername?: string;
  actorEmail?: string;
  impersonatorId?: string;
  delegatedById?: string;
  sessionId?: string;
  authenticationMethod?: string;
  authenticationContext?: Record<string, unknown>;
  sourceIp?: string;
  forwardedIp?: string;
  userAgent?: string;
  deviceId?: string;
  applicationName?: string;
  applicationVersion?: string;
  apiVersion?: string;
  environment?: string;
  country?: string;
  region?: string;
  networkProvider?: string;
  tenantId?: string;
  transactionId?: string;
  correlationId?: string;
  requestId?: string;
  traceId?: string;
  parentEventId?: string;
  eventSequenceNumber?: number;
}

export interface AuditEventInput {
  action: string;
  eventType: string;
  eventCategory: EventCategory;
  operationType: string;
  resourceType: string;
  resourceId?: string;
  resourceVersionBefore?: number;
  resourceVersionAfter?: number;
  businessOperation?: string;
  reason?: string;
  outcome?: EventOutcome;
  status?: string;
  severity?: EventSeverity;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  changedFields?: IChangedField[];
  metadata?: Record<string, unknown>;
  durationMs?: number;
  legalHold?: boolean;
  retentionPolicy?: string;
  retentionExpiresAt?: Date;
}

const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /jwt/i,
  /session/i,
  /cookie/i,
  /authorization/i,
  /auth/i,
  /credential/i,
  /ssn/i,
  /social[_-]?security/i,
  /credit[_-]?card/i,
  /cvv/i,
  /cvc/i,
  /expiry/i,
  /pin/i,
  /otp/i,
  /mfa/i,
  /totp/i,
  /backup[_-]?code/i,
  /recovery[_-]?code/i,
];

const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secretKey',
  'privateKey',
  'sessionId',
  'sessionSecret',
  'csrfToken',
  'otp',
  'otpHash',
  'verificationToken',
  'resetToken',
  'magicLink',
  'authCode',
  'authorizationCode',
  'clientSecret',
  'webhookSecret',
  'signingKey',
  'encryptionKey',
  'stripeSecretKey',
  'stripeWebhookSecret',
  'sendgridApiKey',
  'mailgunApiKey',
  'twilioAuthToken',
  'awsSecretAccessKey',
  'gcpPrivateKey',
  'azureClientSecret',
]);

function isSensitiveField(fieldName: string): boolean {
  const lower = fieldName.toLowerCase();
  if (SENSITIVE_FIELD_NAMES.has(lower)) return true;
  return SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(lower));
}

function redactValue(value: unknown, fieldName: string): unknown {
  if (isSensitiveField(fieldName)) {
    if (typeof value === 'string' && value.length > 0) {
      return '[REDACTED]';
    }
    return '[REDACTED]';
  }
  return value;
}

function deepRedact(obj: unknown, parentPath = ''): Record<string, unknown> {
  if (obj === null || obj === undefined) return {};
  if (typeof obj !== 'object') return {};
  if (Array.isArray(obj)) {
    return obj.map((item, index) => deepRedact(item, `${parentPath}[${index}]`)) as unknown as Record<string, unknown>;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const fullPath = parentPath ? `${parentPath}.${key}` : key;
    if (isSensitiveField(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = deepRedact(value, fullPath);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function computeHash(data: unknown): string {
  const json = JSON.stringify(data, Object.keys(data as object).sort());
  return createHash('sha256').update(json).digest('hex');
}

function computeEventHash(event: Partial<IAuditEventDocument>): string {
  const hashData = {
    auditEventId: event.auditEventId,
    transactionId: event.transactionId,
    correlationId: event.correlationId,
    occurredAt: event.occurredAt,
    actorType: event.actorType,
    actorId: event.actorId,
    action: event.action,
    eventType: event.eventType,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    outcome: event.outcome,
    beforeStateHash: event.beforeStateHash,
    afterStateHash: event.afterStateHash,
    previousEventHash: event.previousEventHash,
    schemaVersion: event.schemaVersion,
  };
  return computeHash(hashData);
}

interface QueuedEvent {
  event: Partial<IAuditEventDocument>;
  resolve: (value: IAuditEventDocument) => void;
  reject: (error: Error) => void;
  priority: 'critical' | 'high' | 'normal' | 'low';
}

const eventQueue: QueuedEvent[] = [];
let isProcessing = false;
const MAX_QUEUE_SIZE = 10000;
const FLUSH_INTERVAL_MS = 100;
const BATCH_SIZE = 100;

let lastEventHashByStream = new Map<string, string>();

function getStreamKey(event: Partial<IAuditEventDocument>): string {
  return `${event.actorType}:${event.resourceType}:${event.resourceId || 'global'}`;
}

async function persistEvent(event: Partial<IAuditEventDocument>): Promise<IAuditEventDocument> {
  const streamKey = getStreamKey(event);
  const previousHash = lastEventHashByStream.get(streamKey) || '';
  event.previousEventHash = previousHash;
  event.eventHash = computeEventHash(event);
  lastEventHashByStream.set(streamKey, event.eventHash);

  const doc = new AuditEvent(event as any);
  await doc.save();
  return doc;
}

async function processQueue(): Promise<void> {
  if (isProcessing || eventQueue.length === 0) return;
  isProcessing = true;

  let batch: typeof eventQueue = [];
  try {
    eventQueue.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    batch = eventQueue.splice(0, BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(({ event }) => persistEvent(event)),
    );

    for (let i = 0; i < batch.length; i++) {
      const { resolve, reject } = batch[i];
      const result = results[i];
      if (result.status === 'fulfilled') {
        resolve(result.value);
      } else {
        logger.error({ err: result.reason }, 'Failed to persist audit event');
        reject(result.reason);
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Audit queue processing error');
    for (const { reject } of batch) {
      reject(error as Error);
    }
  } finally {
    isProcessing = false;
    if (eventQueue.length > 0) {
      setImmediate(processQueue);
    }
  }
}

function scheduleFlush(): void {
  setTimeout(() => {
    if (eventQueue.length > 0) {
      processQueue();
    }
  }, FLUSH_INTERVAL_MS);
}

export const auditService = {
  async log(context: AuditContext, input: AuditEventInput): Promise<IAuditEventDocument> {
    const auditEventId = createAuditEventId();
    const now = new Date();

    const event: Partial<IAuditEventDocument> = {
      auditEventId,
      transactionId: context.transactionId,
      correlationId: context.correlationId,
      requestId: context.requestId,
      traceId: context.traceId,
      parentEventId: context.parentEventId,
      eventSequenceNumber: context.eventSequenceNumber ?? 0,
      occurredAt: now,
      recordedAt: now,
      durationMs: input.durationMs,
      actorType: context.actorType,
      actorId: context.actorId,
      actorUsername: context.actorUsername,
      actorEmail: context.actorEmail,
      impersonatorId: context.impersonatorId,
      delegatedById: context.delegatedById,
      sessionId: context.sessionId,
      authenticationMethod: context.authenticationMethod,
      authenticationContext: context.authenticationContext,
      sourceIp: context.sourceIp,
      forwardedIp: context.forwardedIp,
      userAgent: context.userAgent,
      deviceId: context.deviceId,
      applicationName: context.applicationName,
      applicationVersion: context.applicationVersion,
      apiVersion: context.apiVersion,
      environment: context.environment,
      country: context.country,
      region: context.region,
      networkProvider: context.networkProvider,
      action: input.action,
      eventType: input.eventType,
      eventCategory: input.eventCategory,
      operationType: input.operationType,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      resourceVersionBefore: input.resourceVersionBefore,
      resourceVersionAfter: input.resourceVersionAfter,
      businessOperation: input.businessOperation,
      reason: input.reason,
      outcome: input.outcome ?? 'SUCCESS',
      status: input.status,
      severity: input.severity ?? 'INFO',
      beforeState: input.beforeState ? deepRedact(input.beforeState) : undefined,
      afterState: input.afterState ? deepRedact(input.afterState) : undefined,
      changedFields: input.changedFields?.map((f) => ({
        ...f,
        before: redactValue(f.before, f.field),
        after: redactValue(f.after, f.field),
        sensitive: isSensitiveField(f.field),
      })),
      metadata: input.metadata ? deepRedact(input.metadata) : undefined,
      beforeStateHash: input.beforeState ? computeHash(deepRedact(input.beforeState)) : undefined,
      afterStateHash: input.afterState ? computeHash(deepRedact(input.afterState)) : undefined,
      hashAlgorithm: 'SHA-256',
      schemaVersion: 1,
      tenantId: context.tenantId,
      isImmutable: true,
      legalHold: input.legalHold ?? false,
      retentionPolicy: input.retentionPolicy,
      retentionExpiresAt: input.retentionExpiresAt,
    };

    const priority = input.severity === 'CRITICAL' ? 'critical' : input.severity === 'HIGH' ? 'high' : 'normal';

    if (priority === 'critical' || priority === 'high') {
      try {
        return await persistEvent(event);
      } catch (error) {
        logger.error({ err: error, auditEventId }, 'Critical audit event persistence failed');
        throw error;
      }
    }

    if (eventQueue.length >= MAX_QUEUE_SIZE) {
      logger.warn({ queueSize: eventQueue.length }, 'Audit queue full, processing immediately');
      await processQueue();
    }

    return new Promise((resolve, reject) => {
      eventQueue.push({ event, resolve, reject, priority });
      scheduleFlush();
    });
  },

  async logSync(context: AuditContext, input: AuditEventInput): Promise<IAuditEventDocument> {
    return this.log(context, input);
  },

  createChildEvent(
    parentEvent: IAuditEventDocument,
    context: Partial<AuditContext> & { actorType: ActorType },
    input: AuditEventInput,
  ): Promise<IAuditEventDocument> {
    return this.log(
      {
        ...context,
        transactionId: context.transactionId ?? parentEvent.transactionId,
        correlationId: context.correlationId ?? parentEvent.correlationId,
        requestId: context.requestId ?? parentEvent.requestId,
        traceId: context.traceId ?? parentEvent.traceId,
        parentEventId: parentEvent.auditEventId,
        eventSequenceNumber: (parentEvent.eventSequenceNumber ?? 0) + 1,
      } as AuditContext,
      input,
    );
  },

  async verifyHashChain(_streamKey: string, limit = 1000): Promise<{ valid: boolean; brokenAt?: string; error?: string }> {
    const events = await AuditEvent.find({})
      .sort({ occurredAt: 1 })
      .limit(limit)
      .lean();

    let previousHash = '';
    for (const event of events) {
      if (event.previousEventHash !== previousHash) {
        return { valid: false, brokenAt: event.auditEventId, error: 'Hash chain broken' };
      }
      const computedHash = computeEventHash(event);
      if (event.eventHash !== computedHash) {
        return { valid: false, brokenAt: event.auditEventId, error: 'Event hash mismatch' };
      }
      previousHash = event.eventHash;
    }
    return { valid: true };
  },

  getQueueStats(): { size: number; isProcessing: boolean } {
    return { size: eventQueue.length, isProcessing };
  },

  async flush(): Promise<void> {
    await processQueue();
  },

  isSensitiveField,
  deepRedact,
  computeHash,
};

export { isSensitiveField, deepRedact, computeHash, redactValue };
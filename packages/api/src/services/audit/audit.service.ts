import { createAuditEventId, AuditEvent, type IAuditEventDocument, type ActorType, type EventCategory, type EventSeverity, type EventOutcome, type IChangedField } from '@pawtag/db';
import { createHash } from 'crypto';
import logger from '../../lib/logger';
import { isAuditEnabled } from './audit.policy';

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
  /** Policy changes remain auditable even when the changed policy disables a category or actor. */
  forceAudit?: boolean;
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

const streamWriteTails = new Map<string, Promise<void>>();

function buildStreamKey(actorType: string, resourceType: string, resourceId?: string): string {
  return `${actorType}|${resourceType}|${resourceId || 'global'}`;
}

async function findLatestStreamHash(event: Partial<IAuditEventDocument>): Promise<string> {
  const query: Record<string, unknown> = {
    actorType: event.actorType,
    resourceType: event.resourceType || 'GLOBAL',
  };
  if (event.resourceId) {
    query.resourceId = event.resourceId;
  } else {
    query.resourceId = { $exists: false };
  }
  const last = await AuditEvent.findOne(query)
    .sort({ recordedAt: -1, eventSequenceNumber: -1, occurredAt: -1 })
    .select('eventHash actorType resourceType resourceId streamKey')
    .lean();
  if (!last?.eventHash) return '';
  return last.eventHash as string;
}

async function persistEvent(event: Partial<IAuditEventDocument>): Promise<IAuditEventDocument> {
  const streamKey = buildStreamKey(event.actorType || 'UNKNOWN', event.resourceType || 'GLOBAL', event.resourceId);
  const previousWrite = streamWriteTails.get(streamKey);
  let release!: () => void;
  const currentWrite = new Promise<void>((resolve) => { release = resolve; });
  streamWriteTails.set(streamKey, currentWrite);

  try {
    // Requests are persisted in batches. Serialize events within a stream so
    // concurrent writes cannot produce competing previous hashes.
    if (previousWrite) await previousWrite.catch(() => {});

    // The database is authoritative. This also handles restore/test workflows
    // where an in-memory cache may outlive the corresponding collection data.
    const previousHash = await findLatestStreamHash(event);
    event.recordedAt = new Date();
    event.streamKey = streamKey;
    event.previousEventHash = previousHash;
    event.eventHash = computeEventHash(event);

    const doc = new AuditEvent(event as any);
    await doc.save();
    return doc;
  } finally {
    release();
    if (streamWriteTails.get(streamKey) === currentWrite) streamWriteTails.delete(streamKey);
  }
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

function parseStreamKey(streamKey: string): Record<string, unknown> {
  const parts = streamKey.split('|');
  const query: Record<string, unknown> = {};
  if (parts[0]) query.actorType = parts[0];
  if (parts[1] && parts[1] !== 'GLOBAL') query.resourceType = parts[1];
  const resourceId = parts.slice(2).join('|');
  if (resourceId && resourceId !== 'global') query.resourceId = resourceId;
  return query;
}

async function verifyStream(query: Record<string, unknown>, limit: number): Promise<{ valid: boolean; brokenAt?: string; error?: string; checked: number }> {
  const events = await AuditEvent.find(query)
    .sort({ recordedAt: 1, eventSequenceNumber: 1, occurredAt: 1 })
    .limit(limit)
    .lean();

  let previousHash = '';
  let checkedCount = 0;
  for (const event of events) {
    if (event.previousEventHash !== previousHash) {
      return { valid: false, checked: checkedCount, brokenAt: event.auditEventId, error: 'Hash chain broken' };
    }
    const computed = computeEventHash(event);
    if (event.eventHash !== computed) {
      return { valid: false, checked: checkedCount, brokenAt: event.auditEventId, error: 'Event hash mismatch' };
    }
    previousHash = event.eventHash as string;
    checkedCount++;
  }
  return { valid: true, checked: events.length };
}

async function verifyHashChain(streamKey?: string, limit = 1000): Promise<{ valid: boolean; checked: number; brokenAt?: string; error?: string; streams?: number }> {
  let streams: Array<{ streamKey: string; query: Record<string, unknown> }>;

  if (streamKey) {
    const query = parseStreamKey(streamKey);
    streams = [{ streamKey, query }];
  } else {
    const buckets = await AuditEvent.aggregate([
      {
        $group: {
          _id: { actorType: '$actorType', resourceType: '$resourceType', resourceId: { $ifNull: ['$resourceId', ''] } },
        },
      },
    ]);
    const bucketsByKey = new Map<string, Record<string, unknown>>();
for (const bucket of buckets) {
        const actorType = (bucket._id.actorType as string) || 'UNKNOWN';
        const resourceType = (bucket._id.resourceType as string) || 'GLOBAL';
        const resourceId = bucket._id.resourceId as string;
        const query: Record<string, unknown> = { actorType };
        if (resourceType === 'GLOBAL') query.resourceType = { $exists: false };
        else query.resourceType = resourceType;
        if (resourceId) query.resourceId = resourceId;
        else query.resourceId = { $exists: false };
      const key = buildStreamKey(actorType, resourceType, resourceId || undefined);
      bucketsByKey.set(key, query);
    }
    streams = Array.from(bucketsByKey.entries()).map(([key, q]) => ({ streamKey: key, query: q }));
  }

  let checked = 0;
  for (const { query } of streams) {
    const result = await verifyStream(query, limit);
    checked += result.checked;
    if (!result.valid) {
      return { valid: false, checked, brokenAt: result.brokenAt, error: result.error };
    }
  }
  return { valid: true, checked };
}

export const auditService = {
  async log(context: AuditContext, input: AuditEventInput): Promise<IAuditEventDocument | undefined> {
    if (!input.forceAudit && !(await isAuditEnabled(input.eventCategory, context.actorType))) return undefined;
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

  async logSync(context: AuditContext, input: AuditEventInput): Promise<IAuditEventDocument | undefined> {
    return this.log(context, input);
  },

  createChildEvent(
    parentEvent: IAuditEventDocument,
    context: Partial<AuditContext> & { actorType: ActorType },
    input: AuditEventInput,
  ): Promise<IAuditEventDocument | undefined> {
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

  getQueueStats(): { size: number; isProcessing: boolean } {
    return { size: eventQueue.length, isProcessing };
  },

  async flush(): Promise<void> {
    await processQueue();
  },

  isSensitiveField,
  deepRedact,
  computeHash,
  verifyHashChain,
};

export { isSensitiveField, deepRedact, computeHash, redactValue, verifyHashChain };

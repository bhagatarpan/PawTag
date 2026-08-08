import mongoose, { Schema, Document } from 'mongoose';
import { v7 as uuidv7 } from 'uuid';

export type ActorType =
  | 'USER'
  | 'ADMIN'
  | 'SERVICE'
  | 'SYSTEM'
  | 'SCHEDULED_JOB'
  | 'API_CLIENT'
  | 'WEBHOOK'
  | 'AI_AGENT'
  | 'FINDER'
  | 'UNKNOWN';

export type EventCategory =
  | 'AUTH'
  | 'AUTHZ'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'READ'
  | 'EXPORT'
  | 'TRANSITION'
  | 'FINANCIAL'
  | 'SECURITY'
  | 'ADMIN'
  | 'SYSTEM'
  | 'INTEGRATION'
  | 'FILE'
  | 'CONFIG';

export type EventSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type EventOutcome = 'SUCCESS' | 'FAILURE' | 'PARTIAL' | 'PENDING';

export interface IChangedField {
  field: string;
  before: unknown;
  after: unknown;
  sensitive?: boolean;
}

export interface IAuditEventDocument extends Document {
  auditEventId: string;
  transactionId?: string;
  correlationId?: string;
  requestId?: string;
  traceId?: string;
  parentEventId?: string;
  eventSequenceNumber: number;
  occurredAt: Date;
  recordedAt: Date;
  durationMs?: number;

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
  outcome: EventOutcome;
  status?: string;
  severity: EventSeverity;

  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  changedFields?: IChangedField[];
  beforeStateHash?: string;
  afterStateHash?: string;

  metadata?: Record<string, unknown>;

  eventHash?: string;
  previousEventHash?: string;
  hashAlgorithm: string;

  schemaVersion: number;
  tenantId?: string;

  isImmutable: boolean;
  legalHold: boolean;
  retentionPolicy?: string;
  retentionExpiresAt?: Date;
  archivedAt?: Date;
}

const ChangedFieldSchema = new Schema<IChangedField>(
  {
    field: { type: String, required: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    sensitive: { type: Boolean, default: false },
  },
  { _id: false },
);

const AuditEventSchema = new Schema<IAuditEventDocument>(
  {
    auditEventId: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv7(),
      index: true,
    },
    transactionId: { type: String, index: true },
    correlationId: { type: String, index: true },
    requestId: { type: String, index: true },
    traceId: { type: String, index: true },
    parentEventId: { type: String, index: true },
    eventSequenceNumber: { type: Number, default: 0 },

    occurredAt: { type: Date, required: true, default: Date.now, index: true },
    recordedAt: { type: Date, required: true, default: Date.now },
    durationMs: { type: Number },

    actorType: {
      type: String,
      required: true,
      enum: ['USER', 'ADMIN', 'SERVICE', 'SYSTEM', 'SCHEDULED_JOB', 'API_CLIENT', 'WEBHOOK', 'AI_AGENT', 'FINDER', 'UNKNOWN'],
      index: true,
    },
    actorId: { type: String, index: true },
    actorUsername: { type: String },
    actorEmail: { type: String },
    impersonatorId: { type: String, index: true },
    delegatedById: { type: String },
    sessionId: { type: String, index: true },
    authenticationMethod: { type: String },
    authenticationContext: { type: Schema.Types.Mixed },

    sourceIp: { type: String },
    forwardedIp: { type: String },
    userAgent: { type: String },
    deviceId: { type: String },
    applicationName: { type: String },
    applicationVersion: { type: String },
    apiVersion: { type: String },
    environment: { type: String },

    country: { type: String },
    region: { type: String },
    networkProvider: { type: String },

    action: { type: String, required: true, index: true },
    eventType: { type: String, required: true, index: true },
    eventCategory: {
      type: String,
      required: true,
      enum: ['AUTH', 'AUTHZ', 'CREATE', 'UPDATE', 'DELETE', 'READ', 'EXPORT', 'TRANSITION', 'FINANCIAL', 'SECURITY', 'ADMIN', 'SYSTEM', 'INTEGRATION', 'FILE', 'CONFIG'],
      index: true,
    },
    operationType: { type: String, required: true },
    resourceType: { type: String, required: true, index: true },
    resourceId: { type: String, index: true },
    resourceVersionBefore: { type: Number },
    resourceVersionAfter: { type: Number },
    businessOperation: { type: String },
    reason: { type: String },
    outcome: {
      type: String,
      required: true,
      enum: ['SUCCESS', 'FAILURE', 'PARTIAL', 'PENDING'],
      default: 'SUCCESS',
      index: true,
    },
    status: { type: String },
    severity: {
      type: String,
      required: true,
      enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'INFO',
      index: true,
    },

    beforeState: { type: Schema.Types.Mixed },
    afterState: { type: Schema.Types.Mixed },
    changedFields: [ChangedFieldSchema],
    beforeStateHash: { type: String },
    afterStateHash: { type: String },

    metadata: { type: Schema.Types.Mixed },

    eventHash: { type: String },
    previousEventHash: { type: String },
    hashAlgorithm: { type: String, default: 'SHA-256' },

    schemaVersion: { type: Number, required: true, default: 1 },
    tenantId: { type: String, index: true },

    isImmutable: { type: Boolean, default: true },
    legalHold: { type: Boolean, default: false, index: true },
    retentionPolicy: { type: String },
    retentionExpiresAt: { type: Date, index: true },
    archivedAt: { type: Date, index: true },
  },
  {
    timestamps: { createdAt: 'recordedAt', updatedAt: false },
    collection: 'audit_events',
  },
);

AuditEventSchema.index({ actorType: 1, actorId: 1, occurredAt: -1 });
AuditEventSchema.index({ resourceType: 1, resourceId: 1, occurredAt: -1 });
AuditEventSchema.index({ eventCategory: 1, severity: 1, occurredAt: -1 });
AuditEventSchema.index({ transactionId: 1, eventSequenceNumber: 1 });
AuditEventSchema.index({ correlationId: 1, occurredAt: -1 });
AuditEventSchema.index({ tenantId: 1, occurredAt: -1 });
AuditEventSchema.index({ legalHold: 1, retentionExpiresAt: 1 });
AuditEventSchema.index({ eventHash: 1 });
AuditEventSchema.index({ 'changedFields.field': 1 });

AuditEventSchema.set('autoIndex', true);

export const AuditEvent = mongoose.model<IAuditEventDocument>('AuditEvent', AuditEventSchema);

export function createAuditEventId(): string {
  return uuidv7();
}
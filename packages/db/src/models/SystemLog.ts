import mongoose, { Schema, Document } from 'mongoose';
import { v7 as uuidv7 } from 'uuid';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type LogCategory =
  | 'HTTP'
  | 'DATABASE'
  | 'AUTH'
  | 'INTEGRATION'
  | 'JOB'
  | 'SECURITY'
  | 'NOTIFICATION'
  | 'CONFIG'
  | 'GENERAL';

export interface ISystemLogDocument extends Document {
  logId: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  category: LogCategory;
  service: string;
  environment: string;
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  transactionId?: string;
  userId?: string;
  feature?: string;
  operation?: string;
  error?: {
    name?: string;
    message?: string;
    code?: string;
    fingerprint?: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
  durationMs?: number;
  source?: string;
  retentionDays: number;
  expiresAt: Date;
}

const ErrorSchema = new Schema(
  {
    name: { type: String },
    message: { type: String },
    code: { type: String },
    fingerprint: { type: String },
    stack: { type: String },
  },
  { _id: false },
);

const SystemLogSchema = new Schema<ISystemLogDocument>(
  {
    logId: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv7(),
      index: true,
    },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    level: {
      type: String,
      required: true,
      enum: ['debug', 'info', 'warn', 'error', 'fatal'],
      index: true,
    },
    message: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: ['HTTP', 'DATABASE', 'AUTH', 'INTEGRATION', 'JOB', 'SECURITY', 'NOTIFICATION', 'CONFIG', 'GENERAL'],
      default: 'GENERAL',
      index: true,
    },
    service: { type: String, required: true, default: 'pawtag-api', index: true },
    environment: { type: String, required: true, default: 'development' },
    requestId: { type: String, index: true },
    correlationId: { type: String, index: true },
    traceId: { type: String, index: true },
    transactionId: { type: String },
    userId: { type: String },
    feature: { type: String },
    operation: { type: String },
    error: { type: ErrorSchema },
    metadata: { type: Schema.Types.Mixed },
    durationMs: { type: Number },
    source: { type: String },
    retentionDays: { type: Number, required: true, default: 30 },
    expiresAt: { type: Date, required: true, index: true },
  },
  {
    timestamps: false,
    collection: 'system_logs',
  },
);

SystemLogSchema.index({ level: 1, timestamp: -1 });
SystemLogSchema.index({ category: 1, timestamp: -1 });
SystemLogSchema.index({ service: 1, timestamp: -1 });
SystemLogSchema.index({ requestId: 1 });
SystemLogSchema.index({ correlationId: 1 });
SystemLogSchema.index({ traceId: 1 });
SystemLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

SystemLogSchema.set('autoIndex', true);

export const SystemLog = mongoose.model<ISystemLogDocument>('SystemLog', SystemLogSchema);

export function createSystemLogId(): string {
  return uuidv7();
}

import mongoose, { Schema, Document } from 'mongoose';

export interface IBackgroundJobDocument extends Document {
  name: string;
  displayName: string;
  description: string;
  category: 'financial' | 'notification' | 'maintenance' | 'reconciliation' | 'compliance';

  enabled: boolean;
  intervalMs: number;
  lockName: string;
  lockLeaseMs: number;
  maxConcurrent: number;
  processTarget: 'worker' | 'api' | 'both';

  filePath: string;
  functionName: string;

  status: 'idle' | 'running' | 'error' | 'disabled';
  lastRunAt?: Date;
  lastRunDurationMs?: number;
  lastRunResult?: 'success' | 'error' | 'skipped';
  lastError?: string;
  nextRunAt?: Date;
  currentWorkerId?: string;

  runHistory: Array<{
    startedAt: Date;
    completedAt: Date;
    durationMs: number;
    result: 'success' | 'error' | 'skipped';
    error?: string;
    itemsProcessed?: number;
    workerId?: string;
  }>;
  maxHistorySize: number;

  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;

  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

const BackgroundJobSchema = new Schema<IBackgroundJobDocument>(
  {
    name: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ['financial', 'notification', 'maintenance', 'reconciliation', 'compliance'],
      required: true,
      index: true,
    },

    enabled: { type: Boolean, default: true, index: true },
    intervalMs: { type: Number, required: true, min: 1000 },
    lockName: { type: String, required: true },
    lockLeaseMs: { type: Number, default: 120000 },
    maxConcurrent: { type: Number, default: 1 },
    processTarget: { type: String, enum: ['worker', 'api', 'both'], default: 'worker' },

    filePath: { type: String, required: true },
    functionName: { type: String, required: true },

    status: { type: String, enum: ['idle', 'running', 'error', 'disabled'], default: 'idle' },
    lastRunAt: { type: Date },
    lastRunDurationMs: { type: Number },
    lastRunResult: { type: String, enum: ['success', 'error', 'skipped'] },
    lastError: { type: String },
    nextRunAt: { type: Date },
    currentWorkerId: { type: String },

    runHistory: [
      {
        startedAt: { type: Date, required: true },
        completedAt: { type: Date, required: true },
        durationMs: { type: Number, required: true },
        result: { type: String, enum: ['success', 'error', 'skipped'], required: true },
        error: { type: String },
        itemsProcessed: { type: Number },
        workerId: { type: String },
      },
    ],
    maxHistorySize: { type: Number, default: 500 },

    notifyOnSuccess: { type: Boolean, default: false },
    notifyOnFailure: { type: Boolean, default: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

BackgroundJobSchema.index({ enabled: 1, nextRunAt: 1 });
BackgroundJobSchema.index({ status: 1 });

export const BackgroundJob = mongoose.model<IBackgroundJobDocument>('BackgroundJob', BackgroundJobSchema);

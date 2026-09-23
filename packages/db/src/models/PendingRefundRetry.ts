import mongoose, { Schema, Document } from 'mongoose';

export interface IPendingRefundRetryDocument extends Document {
  orderId: string;
  refundId: string;
  attemptNumber: number;
  scheduledAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  lastAttemptAt?: Date;
  lastError?: string;
}

const PendingRefundRetrySchema = new Schema<IPendingRefundRetryDocument>(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    refundId: { type: String, required: true },
    attemptNumber: { type: Number, required: true, default: 1 },
    scheduledAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    lastAttemptAt: { type: Date },
    lastError: { type: String },
  },
  { timestamps: true },
);

PendingRefundRetrySchema.index({ status: 1, scheduledAt: 1 });

export const PendingRefundRetry = mongoose.model<IPendingRefundRetryDocument>(
  'PendingRefundRetry',
  PendingRefundRetrySchema,
);

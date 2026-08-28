import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookEventDocument extends Document {
  source: 'stripe';
  event: string;
  eventId: string; // External event ID for idempotency
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead';
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  nextRetryAt?: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookEventSchema = new Schema<IWebhookEventDocument>(
  {
    source: { type: String, required: true, enum: ['stripe'] },
    event: { type: String, required: true },
    eventId: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'dead'],
      default: 'pending',
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    lastError: { type: String },
    nextRetryAt: { type: Date },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes for efficient querying
WebhookEventSchema.index({ source: 1, eventId: 1 }, { unique: true }); // Idempotency
WebhookEventSchema.index({ status: 1, nextRetryAt: 1 }); // Retry queue
WebhookEventSchema.index({ status: 1, createdAt: -1 }); // Admin listing

export const WebhookEvent = mongoose.model<IWebhookEventDocument>('WebhookEvent', WebhookEventSchema);

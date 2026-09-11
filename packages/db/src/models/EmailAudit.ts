import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailAuditDocument extends Document {
  templateId?: mongoose.Types.ObjectId;
  templateSlug: string;
  templateVersion?: number;
  businessFlow: string;
  recipientEmail: string;
  recipientName?: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  previewText?: string;
  htmlContent: string;
  plainTextContent?: string;
  variables: Array<{ key: string; value: string; source?: string }>;
  status: 'queued' | 'processing' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed' | 'complained';
  provider: string;
  providerMessageId?: string;
  providerResponse?: Record<string, any>;
  deliveryTimeline: Array<{ event: string; timestamp: Date; details?: string }>;
  failureReason?: string;
  failureStage?: string;
  retryCount: number;
  nextRetryAt?: Date;
  relatedEntityType?: 'customer' | 'order' | 'subscription' | 'pet' | 'tag' | 'referral';
  relatedEntityId?: mongoose.Types.ObjectId;
  relatedEntityDisplay?: string;
  isTest: boolean;
  ipAddress?: string;
  userAgent?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  failedAt?: Date;
}

const EmailAuditSchema = new Schema<IEmailAuditDocument>(
  {
    templateId: { type: Schema.Types.ObjectId, ref: 'CmsEmailTemplate' },
    templateSlug: { type: String, required: true, index: true },
    templateVersion: { type: Number },
    businessFlow: { type: String, default: 'other', index: true },
    recipientEmail: { type: String, required: true, index: true },
    recipientName: { type: String },
    senderEmail: { type: String, required: true },
    senderName: { type: String, required: true },
    subject: { type: String, required: true },
    previewText: { type: String },
    htmlContent: { type: String, required: true },
    plainTextContent: { type: String },
    variables: [{
      key: { type: String, required: true },
      value: { type: String, default: '' },
      source: { type: String },
    }],
    status: {
      type: String,
      enum: ['queued', 'processing', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'complained'],
      default: 'queued',
      index: true,
    },
    provider: { type: String, default: 'resend' },
    providerMessageId: { type: String, index: true },
    providerResponse: { type: Schema.Types.Mixed },
    deliveryTimeline: [{
      event: { type: String, required: true },
      timestamp: { type: Date, required: true },
      details: { type: String },
    }],
    failureReason: { type: String },
    failureStage: { type: String },
    retryCount: { type: Number, default: 0 },
    nextRetryAt: { type: Date },
    relatedEntityType: { type: String, enum: ['customer', 'order', 'subscription', 'pet', 'tag', 'referral'] },
    relatedEntityId: { type: Schema.Types.ObjectId },
    relatedEntityDisplay: { type: String },
    isTest: { type: Boolean, default: false, index: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    sentAt: { type: Date, index: true },
    deliveredAt: { type: Date },
    openedAt: { type: Date },
    clickedAt: { type: Date },
    failedAt: { type: Date },
  },
  { timestamps: true },
);

EmailAuditSchema.index({ createdAt: -1 });
EmailAuditSchema.index({ recipientEmail: 1, createdAt: -1 });
EmailAuditSchema.index({ templateSlug: 1, createdAt: -1 });
EmailAuditSchema.index({ status: 1, createdAt: -1 });
EmailAuditSchema.index({ relatedEntityType: 1, relatedEntityId: 1 });
EmailAuditSchema.index({ isTest: 1, createdAt: -1 });

// TTL index for automatic cleanup (configurable retention, default 1 year)
EmailAuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const EmailAudit = mongoose.model<IEmailAuditDocument>(
  'EmailAudit',
  EmailAuditSchema,
);

import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailVariableDefinition {
  key: string;
  label: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  example: string;
  required: boolean;
  source: string;
}

export interface ICmsEmailTemplateDocument extends Document {
  name: string;
  slug: string;
  subject: string;
  title: string;
  subtitle?: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  preheader?: string;
  footerText?: string;
  senderEmail: string;
  senderName: string;
  variables: string[];
  status: 'active' | 'inactive' | 'draft' | 'archived';
  // ─── Communications Centre fields ───
  businessFlow: 'account_security' | 'pet_tag' | 'lost_found' | 'orders_commerce' | 'subscriptions' | 'guardian_loyalty' | 'referrals' | 'admin_system' | 'other';
  purpose: string;
  triggerDescription: string;
  recipientDescription: string;
  emailType: 'transactional' | 'system' | 'marketing';
  isCritical: boolean;
  version: number;
  variableDefinitions: IEmailVariableDefinition[];
  lastTestedAt?: Date;
  lastTestedBy?: mongoose.Types.ObjectId;
  // ─── Existing fields ───
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  deletedAt?: Date;
}

const CmsEmailTemplateSchema = new Schema<ICmsEmailTemplateDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    subject: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    body: { type: String, required: true },
    ctaText: { type: String, trim: true },
    ctaUrl: { type: String, trim: true },
    preheader: { type: String, trim: true, maxlength: 200 },
    footerText: { type: String, trim: true },
    senderEmail: { type: String, required: true, trim: true },
    senderName: { type: String, required: true, trim: true },
    variables: [{ type: String }],
    status: { type: String, enum: ['active', 'inactive', 'draft', 'archived'], default: 'active', index: true },
    // ─── Communications Centre fields ───
    businessFlow: { type: String, enum: ['account_security', 'pet_tag', 'lost_found', 'orders_commerce', 'subscriptions', 'guardian_loyalty', 'referrals', 'admin_system', 'other'], default: 'other', index: true },
    purpose: { type: String, default: '' },
    triggerDescription: { type: String, default: '' },
    recipientDescription: { type: String, default: '' },
    emailType: { type: String, enum: ['transactional', 'system', 'marketing'], default: 'transactional' },
    isCritical: { type: Boolean, default: false },
    version: { type: Number, default: 1 },
    variableDefinitions: [{
      key: { type: String, required: true },
      label: { type: String, required: true },
      description: { type: String, default: '' },
      type: { type: String, enum: ['string', 'number', 'boolean', 'date', 'array', 'object'], default: 'string' },
      example: { type: String, default: '' },
      required: { type: Boolean, default: false },
      source: { type: String, default: '' },
    }],
    lastTestedAt: { type: Date },
    lastTestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    // ─── Existing fields ───
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

CmsEmailTemplateSchema.index({ slug: 1 });
CmsEmailTemplateSchema.index({ status: 1 });
CmsEmailTemplateSchema.index({ deletedAt: 1 });
CmsEmailTemplateSchema.index({ businessFlow: 1 });
CmsEmailTemplateSchema.index({ emailType: 1 });

export const CmsEmailTemplate = mongoose.model<ICmsEmailTemplateDocument>('CmsEmailTemplate', CmsEmailTemplateSchema);

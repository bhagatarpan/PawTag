import mongoose, { Schema, Document } from 'mongoose';

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
  status: 'active' | 'inactive';
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
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

CmsEmailTemplateSchema.index({ slug: 1 });
CmsEmailTemplateSchema.index({ status: 1 });
CmsEmailTemplateSchema.index({ deletedAt: 1 });

export const CmsEmailTemplate = mongoose.model<ICmsEmailTemplateDocument>('CmsEmailTemplate', CmsEmailTemplateSchema);

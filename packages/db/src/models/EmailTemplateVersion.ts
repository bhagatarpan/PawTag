import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailTemplateVersionDocument extends Document {
  templateId: mongoose.Types.ObjectId;
  templateSlug: string;
  version: number;
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
  variableDefinitions: Array<{
    key: string;
    label: string;
    description: string;
    type: string;
    example: string;
    required: boolean;
    source: string;
  }>;
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
  changeDescription?: string;
}

const EmailTemplateVersionSchema = new Schema<IEmailTemplateVersionDocument>(
  {
    templateId: { type: Schema.Types.ObjectId, ref: 'CmsEmailTemplate', required: true, index: true },
    templateSlug: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    subject: { type: String, required: true },
    title: { type: String, required: true },
    subtitle: { type: String },
    body: { type: String, required: true },
    ctaText: { type: String },
    ctaUrl: { type: String },
    preheader: { type: String },
    footerText: { type: String },
    senderEmail: { type: String, required: true },
    senderName: { type: String, required: true },
    variables: [{ type: String }],
    variableDefinitions: [{
      key: { type: String, required: true },
      label: { type: String, required: true },
      description: { type: String, default: '' },
      type: { type: String, default: 'string' },
      example: { type: String, default: '' },
      required: { type: Boolean, default: false },
      source: { type: String, default: '' },
    }],
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, required: true, default: Date.now },
    changeDescription: { type: String },
  },
  { timestamps: true },
);

EmailTemplateVersionSchema.index({ templateId: 1, version: -1 });
EmailTemplateVersionSchema.index({ templateSlug: 1, version: -1 });

export const EmailTemplateVersion = mongoose.model<IEmailTemplateVersionDocument>(
  'EmailTemplateVersion',
  EmailTemplateVersionSchema,
);

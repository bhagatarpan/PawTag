import mongoose, { Schema, Document } from 'mongoose';

export interface ICmsAuthPageDocument extends Document {
  pageType: 'login' | 'register' | 'forgot_password' | 'reset_password' | 'verify_email';
  title: string;
  subtitle?: string;
  content: Record<string, unknown>;
  isActive: boolean;
  deletedAt?: Date;
}

const CmsAuthPageSchema = new Schema<ICmsAuthPageDocument>(
  {
    pageType: {
      type: String,
      required: true,
      enum: ['login', 'register', 'forgot_password', 'reset_password', 'verify_email'],
      unique: true,
    },
    title: { type: String, required: true },
    subtitle: { type: String },
    content: { type: Schema.Types.Mixed, required: true, default: {} },
    isActive: { type: Boolean, required: true, default: true },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

CmsAuthPageSchema.index({ pageType: 1 }, { unique: true });
CmsAuthPageSchema.index({ isActive: 1 });

const CmsAuthPage = mongoose.models.CmsAuthPage || mongoose.model<ICmsAuthPageDocument>(
  'CmsAuthPage',
  CmsAuthPageSchema
);

export default CmsAuthPage;
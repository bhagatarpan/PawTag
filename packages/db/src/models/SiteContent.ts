import mongoose, { Schema, Document } from 'mongoose';

export interface ISiteContentDocument extends Document {
  slug: string;
  title: string;
  body: string;
  status: 'draft' | 'published' | 'archived';
  metaTitle?: string;
  metaDescription?: string;
  createdBy: mongoose.Types.ObjectId;
  publishedAt?: Date;
}

const SiteContentSchema = new Schema<ISiteContentDocument>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    metaTitle: { type: String },
    metaDescription: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    publishedAt: { type: Date },
  },
  { timestamps: true },
);

SiteContentSchema.index({ slug: 1 });
SiteContentSchema.index({ status: 1 });

export const SiteContent = mongoose.model<ISiteContentDocument>(
  'SiteContent',
  SiteContentSchema,
);

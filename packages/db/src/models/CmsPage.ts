import mongoose, { Schema, Document } from 'mongoose';

export interface ICmsPageSection {
  sectionId: string;
  type: string;
  title?: string;
  subtitle?: string;
  content?: Record<string, unknown>;
  visible: boolean;
  order: number;
  status: 'draft' | 'published';
  scheduledPublishAt?: Date;
  scheduledUnpublishAt?: Date;
}

export interface ICmsPageDocument extends Document {
  slug: string;
  title: string;
  description?: string;
  template: string;
  sections: ICmsPageSection[];
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  canonicalUrl?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  schemaJsonLd?: Record<string, unknown>;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: Date;
  scheduledPublishAt?: Date;
  scheduledUnpublishAt?: Date;
  version: number;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  deletedAt?: Date;
}

const CmsPageSectionSchema = new Schema<ICmsPageSection>(
  {
    sectionId: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String },
    subtitle: { type: String },
    content: { type: Schema.Types.Mixed, default: {} },
    visible: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    scheduledPublishAt: { type: Date },
    scheduledUnpublishAt: { type: Date },
  },
  { _id: false },
);

const CmsPageSchema = new Schema<ICmsPageDocument>(
  {
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 500 },
    template: { type: String, default: 'default', index: true },
    sections: [CmsPageSectionSchema],
    metaTitle: { type: String, maxlength: 70 },
    metaDescription: { type: String, maxlength: 160 },
    metaKeywords: [{ type: String }],
    canonicalUrl: { type: String },
    ogImage: { type: String },
    ogTitle: { type: String },
    ogDescription: { type: String },
    twitterCard: { type: String },
    twitterTitle: { type: String },
    twitterDescription: { type: String },
    twitterImage: { type: String },
    schemaJsonLd: { type: Schema.Types.Mixed },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    publishedAt: { type: Date },
    scheduledPublishAt: { type: Date },
    scheduledUnpublishAt: { type: Date },
    version: { type: Number, default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

CmsPageSchema.index({ slug: 1 });
CmsPageSchema.index({ status: 1 });
CmsPageSchema.index({ template: 1 });
CmsPageSchema.index({ deletedAt: 1 });
CmsPageSchema.index({ scheduledPublishAt: 1, status: 1 });

export const CmsPage = mongoose.model<ICmsPageDocument>('CmsPage', CmsPageSchema);

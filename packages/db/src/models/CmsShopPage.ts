import mongoose, { Schema, Document } from 'mongoose';

export interface ICmsShopPageDocument extends Document {
  slug: string;
  title: string;
  subtitle?: string;
  content: Record<string, unknown>;
  metaTitle?: string;
  metaDescription?: string;
  isActive: boolean;
  deletedAt?: Date;
}

const CmsShopPageSchema = new Schema<ICmsShopPageDocument>(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    subtitle: { type: String },
    content: { type: Schema.Types.Mixed, required: true, default: {} },
    metaTitle: { type: String },
    metaDescription: { type: String },
    isActive: { type: Boolean, required: true, default: true },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

CmsShopPageSchema.index({ slug: 1 }, { unique: true });
CmsShopPageSchema.index({ isActive: 1 });

const CmsShopPage = mongoose.models.CmsShopPage || mongoose.model<ICmsShopPageDocument>(
  'CmsShopPage',
  CmsShopPageSchema
);

export default CmsShopPage;
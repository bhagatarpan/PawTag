import mongoose, { Schema, Document } from 'mongoose';

export interface ICmsNavigationItem {
  label: string;
  url: string;
  target?: '_self' | '_blank';
  icon?: string;
  pageId?: mongoose.Types.ObjectId;
  visible: boolean;
  order: number;
  children?: ICmsNavigationItem[];
}

export interface ICmsNavigationDocument extends Document {
  name: string;
  slug: string;
  location: 'header' | 'footer' | 'sidebar' | 'mobile';
  items: ICmsNavigationItem[];
  status: 'draft' | 'published';
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  deletedAt?: Date;
}

const CmsNavigationItemSchema = new Schema<ICmsNavigationItem>(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    target: { type: String, enum: ['_self', '_blank'], default: '_self' },
    icon: { type: String },
    pageId: { type: Schema.Types.ObjectId, ref: 'CmsPage' },
    visible: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    children: [{ type: Schema.Types.Mixed }],
  },
  { _id: false },
);

const CmsNavigationSchema = new Schema<ICmsNavigationDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    location: { type: String, enum: ['header', 'footer', 'sidebar', 'mobile'], required: true, index: true },
    items: [CmsNavigationItemSchema],
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

CmsNavigationSchema.index({ location: 1 });
CmsNavigationSchema.index({ deletedAt: 1 });

export const CmsNavigation = mongoose.model<ICmsNavigationDocument>('CmsNavigation', CmsNavigationSchema);

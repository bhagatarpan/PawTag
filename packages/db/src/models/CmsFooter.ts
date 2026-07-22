import mongoose, { Schema, Document } from 'mongoose';

export interface ICmsFooterLink {
  label: string;
  url: string;
  target?: '_self' | '_blank';
  visible: boolean;
  order: number;
}

export interface ICmsFooterGroup {
  groupId: string;
  title: string;
  links: ICmsFooterLink[];
  visible: boolean;
  order: number;
}

export interface ICmsFooterDocument extends Document {
  name: string;
  groups: ICmsFooterGroup[];
  copyright?: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
  };
  status: 'draft' | 'published';
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  deletedAt?: Date;
}

const CmsFooterLinkSchema = new Schema<ICmsFooterLink>(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    target: { type: String, enum: ['_self', '_blank'], default: '_self' },
    visible: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const CmsFooterGroupSchema = new Schema<ICmsFooterGroup>(
  {
    groupId: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    links: [CmsFooterLinkSchema],
    visible: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const CmsFooterSchema = new Schema<ICmsFooterDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    groups: [CmsFooterGroupSchema],
    copyright: { type: String },
    socialLinks: {
      facebook: { type: String },
      twitter: { type: String },
      instagram: { type: String },
      linkedin: { type: String },
      youtube: { type: String },
      tiktok: { type: String },
    },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

CmsFooterSchema.index({ deletedAt: 1 });

export const CmsFooter = mongoose.model<ICmsFooterDocument>('CmsFooter', CmsFooterSchema);

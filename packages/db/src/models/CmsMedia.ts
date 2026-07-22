import mongoose, { Schema, Document } from 'mongoose';

export interface ICmsMediaDocument extends Document {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  url: string;
  alt?: string;
  caption?: string;
  title?: string;
  folder?: string;
  tags?: string[];
  hash: string;
  thumbnails?: Record<string, string>;
  metadata?: Record<string, unknown>;
  uploadedBy: mongoose.Types.ObjectId;
  deletedAt?: Date;
}

const CmsMediaSchema = new Schema<ICmsMediaDocument>(
  {
    filename: { type: String, required: true, index: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true, index: true },
    size: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number },
    url: { type: String, required: true },
    alt: { type: String, trim: true, maxlength: 250 },
    caption: { type: String, trim: true, maxlength: 500 },
    title: { type: String, trim: true, maxlength: 200 },
    folder: { type: String, default: '/', index: true },
    tags: [{ type: String, trim: true }],
    hash: { type: String, required: true, index: true },
    thumbnails: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

CmsMediaSchema.index({ folder: 1 });
CmsMediaSchema.index({ mimeType: 1 });
CmsMediaSchema.index({ tags: 1 });
CmsMediaSchema.index({ hash: 1 });
CmsMediaSchema.index({ deletedAt: 1 });

export const CmsMedia = mongoose.model<ICmsMediaDocument>('CmsMedia', CmsMediaSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface ICmsPageVersionDocument extends Document {
  pageId: mongoose.Types.ObjectId;
  version: number;
  snapshot: Record<string, unknown>;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const CmsPageVersionSchema = new Schema<ICmsPageVersionDocument>(
  {
    pageId: { type: Schema.Types.ObjectId, ref: 'CmsPage', required: true, index: true },
    version: { type: Number, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

CmsPageVersionSchema.index({ pageId: 1, version: -1 });

export const CmsPageVersion = mongoose.model<ICmsPageVersionDocument>('CmsPageVersion', CmsPageVersionSchema);

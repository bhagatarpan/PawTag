import mongoose, { Schema, Document } from 'mongoose';

export interface ICmsRedirectDocument extends Document {
  from: string;
  to: string;
  type: 'temporary' | 'permanent';
  status: 'active' | 'inactive';
  hitCount: number;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  deletedAt?: Date;
}

const CmsRedirectSchema = new Schema<ICmsRedirectDocument>(
  {
    from: { type: String, required: true, unique: true, index: true },
    to: { type: String, required: true },
    type: { type: String, enum: ['temporary', 'permanent'], default: 'permanent' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    hitCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

CmsRedirectSchema.index({ from: 1 });
CmsRedirectSchema.index({ status: 1 });
CmsRedirectSchema.index({ deletedAt: 1 });

export const CmsRedirect = mongoose.model<ICmsRedirectDocument>('CmsRedirect', CmsRedirectSchema);

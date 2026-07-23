import mongoose, { Schema, Document } from 'mongoose';

export interface ICmsSmsTemplateDocument extends Document {
  name: string;
  slug: string;
  message: string;
  variables: string[];
  status: 'active' | 'inactive';
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  deletedAt?: Date;
}

const CmsSmsTemplateSchema = new Schema<ICmsSmsTemplateDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    message: { type: String, required: true, trim: true },
    variables: [{ type: String }],
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

CmsSmsTemplateSchema.index({ slug: 1 });
CmsSmsTemplateSchema.index({ status: 1 });
CmsSmsTemplateSchema.index({ deletedAt: 1 });

export const CmsSmsTemplate = mongoose.model<ICmsSmsTemplateDocument>('CmsSmsTemplate', CmsSmsTemplateSchema);

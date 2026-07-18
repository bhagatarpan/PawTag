import mongoose, { Schema, Document } from 'mongoose';

export interface ISettingDocument extends Document {
  key: string;
  value: string;
  category: string;
  description?: string;
  updatedBy: mongoose.Types.ObjectId;
}

const SettingSchema = new Schema<ISettingDocument>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: String, required: true },
    category: { type: String, required: true, index: true },
    description: { type: String },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

SettingSchema.index({ category: 1 });

export const Setting = mongoose.model<ISettingDocument>('Setting', SettingSchema);

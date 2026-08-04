import mongoose, { Schema, Document } from 'mongoose';

export interface ISupportRequestDocument extends Document {
  name: string;
  email: string;
  message: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupportRequestSchema = new Schema<ISupportRequestDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    message: { type: String, required: true, trim: true },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

SupportRequestSchema.index({ resolved: 1, createdAt: -1 });
SupportRequestSchema.index({ email: 1 });

export const SupportRequest = mongoose.model<ISupportRequestDocument>(
  'SupportRequest',
  SupportRequestSchema,
);

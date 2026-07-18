import mongoose, { Schema, Document } from 'mongoose';

export interface IFeatureFlagDocument extends Document {
  key: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  allowedRoles?: string[];
  percentage?: number;
}

const FeatureFlagSchema = new Schema<IFeatureFlagDocument>(
  {
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    isEnabled: { type: Boolean, default: false },
    allowedRoles: [{ type: String }],
    percentage: { type: Number, min: 0, max: 100 },
  },
  { timestamps: true },
);

export const FeatureFlag = mongoose.model<IFeatureFlagDocument>(
  'FeatureFlag',
  FeatureFlagSchema,
);

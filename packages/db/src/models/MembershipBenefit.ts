import mongoose, { Schema, Document } from 'mongoose';

export interface IMembershipBenefitDocument extends Document {
  key: string;
  name: string;
  description: string;
  type: 'boolean' | 'number' | 'string';
  category: string;
  defaultValue: boolean | number | string | null;
  enabled: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const MembershipBenefitSchema = new Schema<IMembershipBenefitDocument>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['boolean', 'number', 'string'], required: true },
    category: { type: String, required: true, trim: true },
    defaultValue: { type: Schema.Types.Mixed, default: null },
    enabled: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

MembershipBenefitSchema.index({ category: 1, displayOrder: 1 });
MembershipBenefitSchema.index({ enabled: 1 });

export const MembershipBenefit = mongoose.model<IMembershipBenefitDocument>(
  'MembershipBenefit',
  MembershipBenefitSchema
);

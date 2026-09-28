import mongoose, { Schema, Document } from 'mongoose';

export interface IMembershipTierBenefitDocument extends Document {
  benefitKey: string;
  tier: string;
  enabled: boolean;
  value: boolean | number | string | null;
  createdAt: Date;
  updatedAt: Date;
}

const MembershipTierBenefitSchema = new Schema<IMembershipTierBenefitDocument>(
  {
    benefitKey: { type: String, required: true, trim: true },
    tier: { type: String, required: true, lowercase: true },
    enabled: { type: Boolean, default: true },
    value: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

MembershipTierBenefitSchema.index({ benefitKey: 1, tier: 1 }, { unique: true });
MembershipTierBenefitSchema.index({ tier: 1 });

export const MembershipTierBenefit = mongoose.model<IMembershipTierBenefitDocument>(
  'MembershipTierBenefit',
  MembershipTierBenefitSchema
);

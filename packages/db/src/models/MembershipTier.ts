import mongoose, { Schema, Document } from 'mongoose';

export interface IMembershipTierDocument extends Document {
  tier: string;
  name: string;
  displayName: string;
  description: string;
  price: number;
  currency: string;
  tagLimit: number;
  stripeProductId?: string;
  stripePriceId?: string;
  isActive: boolean;
  comingSoon: boolean;
  displayOrder: number;
  icon: string;
  color: string;
  gradient: string;
  createdAt: Date;
  updatedAt: Date;
}

const MembershipTierSchema = new Schema<IMembershipTierDocument>(
  {
    tier: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true },
    displayName: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NZD' },
    tagLimit: { type: Number, required: true, min: 1 },
    stripeProductId: { type: String },
    stripePriceId: { type: String },
    isActive: { type: Boolean, default: true },
    comingSoon: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    icon: { type: String, default: 'Crown' },
    color: { type: String, default: '#F59E0B' },
    gradient: { type: String, default: 'from-yellow-400 to-amber-500' },
  },
  { timestamps: true }
);

MembershipTierSchema.index({ isActive: 1, displayOrder: 1 });

export const MembershipTier = mongoose.model<IMembershipTierDocument>(
  'MembershipTier',
  MembershipTierSchema
);

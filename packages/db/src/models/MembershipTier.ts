import mongoose, { Schema, Document } from 'mongoose';

export interface IMembershipTierBenefits {
  medicalAlert: boolean;
  petHealthRecords: boolean;
  emailNotifications: boolean;
  freeShippingThreshold: number; // 0 = lifetime free shipping, null = no free shipping
  pointsMultiplier: number; // 1, 2, or 3
  inAppNotifications: boolean;
  criticalEmergencyContact: boolean;
  emergencyPersonEmail: boolean;
  emergencyPersonInApp: boolean;
  accessoryDiscount: number; // percentage (0, 5, 10)
  petRecovery: boolean;
  blackFridayDeal: boolean;
}

export interface IMembershipTierDocument extends Document {
  tier: 'gold' | 'platinum' | 'black';
  name: string;
  displayName: string;
  description: string;
  price: number;
  currency: string;
  benefits: IMembershipTierBenefits;
  tagLimit: number;
  stripeProductId?: string;
  stripePriceId?: string;
  isActive: boolean;
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
      enum: ['gold', 'platinum', 'black'],
      required: true,
      unique: true,
    },
    name: { type: String, required: true },
    displayName: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NZD' },
    benefits: {
      medicalAlert: { type: Boolean, default: false },
      petHealthRecords: { type: Boolean, default: false },
      emailNotifications: { type: Boolean, default: false },
      freeShippingThreshold: { type: Number, default: null },
      pointsMultiplier: { type: Number, default: 1, min: 1, max: 3 },
      inAppNotifications: { type: Boolean, default: false },
      criticalEmergencyContact: { type: Boolean, default: false },
      emergencyPersonEmail: { type: Boolean, default: false },
      emergencyPersonInApp: { type: Boolean, default: false },
      accessoryDiscount: { type: Number, default: 0, min: 0, max: 100 },
      petRecovery: { type: Boolean, default: false },
      blackFridayDeal: { type: Boolean, default: false },
    },
    tagLimit: { type: Number, required: true, min: 1 },
    stripeProductId: { type: String },
    stripePriceId: { type: String },
    isActive: { type: Boolean, default: true },
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

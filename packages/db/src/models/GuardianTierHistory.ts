import mongoose, { Schema, Document } from 'mongoose';

export interface IGuardianTierHistoryDocument extends Document {
  userId: mongoose.Types.ObjectId;
  tier: 'CARE' | 'NURTURE' | 'PROTECTOR' | 'SAFEGUARD';
  points: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GuardianTierHistorySchema = new Schema<IGuardianTierHistoryDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tier: { 
      type: String, 
      enum: ['CARE', 'NURTURE', 'PROTECTOR', 'SAFEGUARD'], 
      required: true, 
      index: true 
    },
    points: { type: Number, required: true },
    effectiveFrom: { type: Date, required: true, index: true },
    effectiveTo: { type: Date, index: true },
  },
  { timestamps: true }
);

// Indexes for efficient queries
GuardianTierHistorySchema.index({ userId: 1, effectiveFrom: -1 });
GuardianTierHistorySchema.index({ userId: 1, tier: 1, effectiveFrom: -1 });
GuardianTierHistorySchema.index({ tier: 1, effectiveFrom: -1 });

export const GuardianTierHistory = mongoose.model<IGuardianTierHistoryDocument>(
  'GuardianTierHistory',
  GuardianTierHistorySchema
);

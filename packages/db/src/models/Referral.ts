import mongoose, { Schema, Document } from 'mongoose';

export interface IReferralDocument extends Document {
  referrerId: mongoose.Types.ObjectId;
  refereeId: mongoose.Types.ObjectId;
  referralCode: string;
  status: 'pending' | 'completed' | 'rewarded';
  referrerRewardMonths: number;
  refereeRewardMonths: number;
  orderId?: mongoose.Types.ObjectId;
  createdAt: Date;
  completedAt?: Date;
}

const ReferralSchema = new Schema<IReferralDocument>({
  referrerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  refereeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  referralCode: { type: String, required: true, uppercase: true },
  status: { type: String, enum: ['pending', 'completed', 'rewarded'], default: 'pending' },
  referrerRewardMonths: { type: Number, default: 1 },
  refereeRewardMonths: { type: Number, default: 1 },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  completedAt: { type: Date },
}, { timestamps: true });

ReferralSchema.index({ referrerId: 1 });
ReferralSchema.index({ refereeId: 1 });
ReferralSchema.index({ referralCode: 1 });

export const Referral = mongoose.model<IReferralDocument>('Referral', ReferralSchema);

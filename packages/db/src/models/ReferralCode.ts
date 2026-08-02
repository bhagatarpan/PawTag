import mongoose, { Schema, Document } from 'mongoose';

export interface IReferralCodeDocument extends Document {
  userId: mongoose.Types.ObjectId;
  code: string;
  isActive: boolean;
  createdAt: Date;
}

const ReferralCodeSchema = new Schema<IReferralCodeDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  code: { type: String, required: true, unique: true, uppercase: true, minlength: 8, maxlength: 8 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

ReferralCodeSchema.index({ code: 1 });
ReferralCodeSchema.index({ userId: 1 });

export const ReferralCode = mongoose.model<IReferralCodeDocument>('ReferralCode', ReferralCodeSchema);

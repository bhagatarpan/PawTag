import mongoose, { Schema, Document } from 'mongoose';

export interface IVerificationTokenDocument extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'email_verification' | 'phone_otp' | 'password_reset';
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  attempts: number;
  resendCount: number;
  lastSentAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

const VerificationTokenSchema = new Schema<IVerificationTokenDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['email_verification', 'phone_otp', 'password_reset'], required: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0, min: 0 },
    resendCount: { type: Number, default: 0, min: 0 },
    lastSentAt: { type: Date },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true },
);

VerificationTokenSchema.index({ userId: 1, type: 1 });
VerificationTokenSchema.index({ tokenHash: 1, type: 1 });
VerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const VerificationToken = mongoose.model<IVerificationTokenDocument>(
  'VerificationToken',
  VerificationTokenSchema,
);

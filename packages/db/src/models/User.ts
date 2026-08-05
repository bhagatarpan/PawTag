import mongoose, { Schema, Document } from 'mongoose';

export interface IUserDocument extends Document {
  email: string;
  passwordHash: string;
  fullName: string;
  phoneNumber: string;
  role: string; // Legacy single-role field — kept for backward compatibility
  roles: mongoose.Types.ObjectId[]; // References to Role collection (new RBAC)
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  phoneVerified: boolean;
  phoneVerifiedAt?: Date;
  profilePicture?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  emergencyContact?: {
    name: string;
    phone: string;
    email?: string;
    relationship: string;
  };
  responsibilityScore: number;
  mfaEnabled: boolean;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  skipInvoiceOtp: boolean;
  skipInvoiceOtpExpiresAt?: Date;
  notificationPreferences?: {
    email: boolean;
    push: boolean;
    inApp: boolean;
    channels: {
      petFound: boolean;
      orderUpdate: boolean;
      subscriptionReminder: boolean;
      referral: boolean;
      marketing: boolean;
    };
  };
  deletedAt?: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true },
    role: { type: String, default: 'customer', lowercase: true }, // Legacy compatibility
    roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'pending_verification'],
      default: 'pending_verification',
    },
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date },
    phoneVerified: { type: Boolean, default: false },
    phoneVerifiedAt: { type: Date },
    profilePicture: { type: String },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      zip: String,
      country: { type: String, default: 'NZ' },
    },
    emergencyContact: {
      name: String,
      phone: String,
      email: String,
      relationship: String,
    },
    responsibilityScore: { type: Number, default: 0, min: 0 },
    mfaEnabled: { type: Boolean, default: true },
    failedLoginAttempts: { type: Number, default: 0, min: 0 },
    lockedUntil: { type: Date, default: null },
    skipInvoiceOtp: { type: Boolean, default: false },
    skipInvoiceOtpExpiresAt: { type: Date, default: null },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      channels: {
        petFound: { type: Boolean, default: true },
        orderUpdate: { type: Boolean, default: true },
        subscriptionReminder: { type: Boolean, default: true },
        referral: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
      },
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

UserSchema.index({ email: 1 });
UserSchema.index({ phoneNumber: 1 });
UserSchema.index({ roles: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ deletedAt: 1 });

export const User = mongoose.model<IUserDocument>('User', UserSchema);

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
  phoneVerified: boolean;
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
    phoneVerified: { type: Boolean, default: false },
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
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

UserSchema.index({ email: 1 });
UserSchema.index({ roles: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ deletedAt: 1 });

export const User = mongoose.model<IUserDocument>('User', UserSchema);

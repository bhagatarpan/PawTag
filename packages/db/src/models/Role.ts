import mongoose, { Schema, Document } from 'mongoose';

export interface IRoleDocument extends Document {
  name: string;
  displayName: string;
  description?: string;
  roleType: 'system' | 'custom';
  isSystemRole: boolean;
  isSuperAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

const RoleSchema = new Schema<IRoleDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 50,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    roleType: {
      type: String,
      enum: ['system', 'custom'],
      default: 'custom',
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

RoleSchema.index({ name: 1 });
RoleSchema.index({ isActive: 1 });
RoleSchema.index({ isSuperAdmin: 1 });

export const Role = mongoose.model<IRoleDocument>('Role', RoleSchema);
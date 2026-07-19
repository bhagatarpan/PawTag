import mongoose, { Schema, Document } from 'mongoose';

export interface IPermissionGroupDocument extends Document {
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

const PermissionGroupSchema = new Schema<IPermissionGroupDocument>(
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
    icon: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    sortOrder: {
      type: Number,
      default: 0,
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

PermissionGroupSchema.index({ name: 1 });
PermissionGroupSchema.index({ sortOrder: 1 });
PermissionGroupSchema.index({ isActive: 1 });

export const PermissionGroup = mongoose.model<IPermissionGroupDocument>('PermissionGroup', PermissionGroupSchema);
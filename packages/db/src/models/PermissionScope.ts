import mongoose, { Schema, Document } from 'mongoose';

export interface IPermissionScopeDocument extends Document {
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PermissionScopeSchema = new Schema<IPermissionScopeDocument>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

PermissionScopeSchema.index({ code: 1 });
PermissionScopeSchema.index({ isActive: 1 });

export const PermissionScope = mongoose.model<IPermissionScopeDocument>('PermissionScope', PermissionScopeSchema);
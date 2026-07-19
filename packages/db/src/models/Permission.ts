import mongoose, { Schema, Document } from 'mongoose';

export interface IPermissionDocument extends Document {
  name: string;
  displayName: string;
  description?: string;
  resource: string;
  action: string;
  permissionGroupId: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

const PermissionSchema = new Schema<IPermissionDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 100,
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
    resource: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 50,
    },
    action: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 50,
    },
    permissionGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'PermissionGroup',
      required: true,
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

PermissionSchema.index({ name: 1 });
PermissionSchema.index({ resource: 1, action: 1 });
PermissionSchema.index({ permissionGroupId: 1 });
PermissionSchema.index({ isActive: 1 });

export const Permission = mongoose.model<IPermissionDocument>('Permission', PermissionSchema);
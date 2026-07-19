import mongoose, { Schema, Document } from 'mongoose';

export interface IRolePermissionDocument extends Document {
  roleId: mongoose.Types.ObjectId;
  permissionId: mongoose.Types.ObjectId;
  scopeId?: mongoose.Types.ObjectId;
  createdAt: Date;
  createdBy?: mongoose.Types.ObjectId;
}

const RolePermissionSchema = new Schema<IRolePermissionDocument>(
  {
    roleId: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
    permissionId: {
      type: Schema.Types.ObjectId,
      ref: 'Permission',
      required: true,
    },
    scopeId: {
      type: Schema.Types.ObjectId,
      ref: 'PermissionScope',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } },
);

RolePermissionSchema.index({ roleId: 1, permissionId: 1 }, { unique: true });
RolePermissionSchema.index({ roleId: 1 });
RolePermissionSchema.index({ permissionId: 1 });
RolePermissionSchema.index({ scopeId: 1 });

export const RolePermission = mongoose.model<IRolePermissionDocument>('RolePermission', RolePermissionSchema);
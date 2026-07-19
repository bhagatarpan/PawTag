import mongoose, { Schema, Document } from 'mongoose';

export interface IUserRoleDocument extends Document {
  userId: mongoose.Types.ObjectId;
  roleId: mongoose.Types.ObjectId;
  assignedAt: Date;
  assignedBy: mongoose.Types.ObjectId;
  expiresAt?: Date;
  isActive: boolean;
}

const UserRoleSchema = new Schema<IUserRoleDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    roleId: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: { createdAt: 'assignedAt', updatedAt: false } },
);

UserRoleSchema.index({ userId: 1, roleId: 1 }, { unique: true });
UserRoleSchema.index({ userId: 1 });
UserRoleSchema.index({ roleId: 1 });
UserRoleSchema.index({ isActive: 1 });
UserRoleSchema.index({ expiresAt: 1 });

export const UserRole = mongoose.model<IUserRoleDocument>('UserRole', UserRoleSchema);
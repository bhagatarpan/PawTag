import mongoose, { Schema, Document } from 'mongoose';

export interface IPushTokenDocument extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  platform: 'web' | 'ios' | 'android';
  isActive: boolean;
  createdAt: Date;
  lastUsedAt: Date;
}

const PushTokenSchema = new Schema<IPushTokenDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true },
  platform: { type: String, enum: ['web', 'ios', 'android'], required: true },
  isActive: { type: Boolean, default: true },
  lastUsedAt: { type: Date, default: Date.now },
}, { timestamps: true });

PushTokenSchema.index({ userId: 1, isActive: 1 });
PushTokenSchema.index({ token: 1 });

export const PushToken = mongoose.model<IPushTokenDocument>('PushToken', PushTokenSchema);

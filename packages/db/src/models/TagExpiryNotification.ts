import mongoose, { Schema, Document } from 'mongoose';

export interface ITagExpiryNotificationDocument extends Document {
  subscriptionId: mongoose.Types.ObjectId;
  tagId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  daysUntilExpiry: number;
  notifiedAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: mongoose.Types.ObjectId;
  acknowledgedAt?: Date;
}

const TagExpiryNotificationSchema = new Schema<ITagExpiryNotificationDocument>({
  subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true },
  tagId: { type: Schema.Types.ObjectId, ref: 'Tag', required: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  daysUntilExpiry: { type: Number, required: true },
  notifiedAt: { type: Date, default: Date.now },
  acknowledged: { type: Boolean, default: false },
  acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  acknowledgedAt: { type: Date },
}, { timestamps: true });

TagExpiryNotificationSchema.index({ subscriptionId: 1, notifiedAt: -1 });
TagExpiryNotificationSchema.index({ acknowledged: 1, createdAt: -1 });
TagExpiryNotificationSchema.index({ acknowledged: 1, daysUntilExpiry: 1 });

export const TagExpiryNotification = mongoose.model<ITagExpiryNotificationDocument>('TagExpiryNotification', TagExpiryNotificationSchema);

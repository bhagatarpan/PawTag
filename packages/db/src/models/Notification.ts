import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationDocument extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'pet_lost' | 'pet_found' | 'finder_scan' | 'order_update' | 'system' | 'finder_reminder' | 'subscription_expiring' | 'referral_reward' | 'tag_expiry_warning';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  priority: 'low' | 'normal' | 'high';
  actionUrl?: string;
  channel: 'info' | 'alert' | 'reminder' | 'marketing';
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['pet_lost', 'pet_found', 'finder_scan', 'order_update', 'system', 'finder_reminder', 'subscription_expiring', 'referral_reward', 'tag_expiry_warning'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: { type: Schema.Types.Mixed },
    read: { type: Boolean, default: false },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    actionUrl: { type: String },
    channel: { type: String, enum: ['info', 'alert', 'reminder', 'marketing'], default: 'info' },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotificationDocument>(
  'Notification',
  NotificationSchema,
);

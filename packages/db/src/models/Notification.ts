import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationDocument extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'pet_lost' | 'pet_found' | 'finder_scan' | 'order_update' | 'system' | 'finder_reminder';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  priority: 'low' | 'normal' | 'high';
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['pet_lost', 'pet_found', 'finder_scan', 'order_update', 'system', 'finder_reminder'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: { type: Schema.Types.Mixed },
    read: { type: Boolean, default: false },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotificationDocument>(
  'Notification',
  NotificationSchema,
);

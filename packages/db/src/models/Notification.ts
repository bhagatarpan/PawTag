import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationDocument extends Document {
  userId: mongoose.Types.ObjectId;
  audience: 'customer' | 'admin';
  type: 'pet_lost' | 'pet_found' | 'finder_scan' | 'order_update' | 'system' | 'finder_reminder' | 'subscription_expiring' | 'subscription_auto_renew_paused' | 'referral_reward' | 'tag_expiry_warning' | 'new_order' | 'onboarding_reminder' | 'refund_failed' | 'emergency_contact_escalation' | 'order' | 'active_period_expiring_30d' | 'active_period_expiring_7d' | 'active_period_expired' | 'membership_required' | 'return_requested' | 'return_tracking_submitted' | 'saved_card_expiring';
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
    // 'customer' (default) = per-user notification; 'admin' = org-wide admin alert (userId is the triggering user)
    audience: { type: String, enum: ['customer', 'admin'], default: 'customer', index: true },
    type: {
      type: String,
      enum: ['pet_lost', 'pet_found', 'finder_scan', 'order_update', 'system', 'finder_reminder', 'subscription_expiring', 'subscription_auto_renew_paused', 'referral_reward', 'tag_expiry_warning', 'new_order', 'onboarding_reminder', 'refund_failed', 'emergency_contact_escalation', 'order', 'active_period_expiring_30d', 'active_period_expiring_7d', 'active_period_expired', 'membership_required', 'return_requested', 'return_tracking_submitted', 'saved_card_expiring',
        // Membership lifecycle — every membership in-app notification was
        // silently dropped by enum validation before these were added
        'membership_activated', 'membership_cancelled', 'membership_resumed', 'membership_upgraded', 'membership_downgraded', 'membership_downgrade_scheduled', 'membership_extended', 'membership_expired', 'membership_renewal_reminder', 'membership_payment_failed', 'subscription_payment_failed'],
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

NotificationSchema.index({ audience: 1, read: 1 });
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotificationDocument>(
  'Notification',
  NotificationSchema,
);

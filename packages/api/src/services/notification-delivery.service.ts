import { Notification, User, PushToken } from '@pawtag/db';
import { sendMail } from './email.service';
import { renderGenericNotificationEmail } from './email/templates';
import { sendPushToUser } from './push-notification.service';

interface NotifyOptions {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high';
  actionUrl?: string;
  channel?: 'info' | 'alert' | 'reminder' | 'marketing';
  sendPush?: boolean;
  sendEmail?: boolean;
  emailSubject?: string;
  emailHtml?: string;
}

export async function createAndDeliverNotification(options: NotifyOptions): Promise<void> {
  const {
    userId,
    type,
    title,
    message,
    data = {},
    priority = 'normal',
    actionUrl,
    channel = 'info',
    sendPush = true,
    sendEmail = false,
    emailSubject,
    emailHtml,
  } = options;

  // Get user notification preferences
  const user = await User.findById(userId).select('notificationPreferences email fullName');
  if (!user) return;

  const prefs = (user as any).notificationPreferences || {
    email: true,
    push: true,
    inApp: true,
    channels: { petFound: true, orderUpdate: true, subscriptionReminder: true, referral: true, marketing: false },
  };

  // Check channel preference
  const channelMap: Record<string, keyof typeof prefs.channels> = {
    pet_found: 'petFound',
    pet_lost: 'petFound',
    finder_scan: 'petFound',
    finder_reminder: 'petFound',
    order_update: 'orderUpdate',
    subscription_expiring: 'subscriptionReminder',
    referral_reward: 'referral',
    tag_expiry_warning: 'subscriptionReminder',
    system: 'orderUpdate',
  };
  const channelKey = channelMap[type] || 'orderUpdate';
  if (!prefs.channels[channelKey]) return;

  // Create in-app notification
  if (prefs.inApp) {
    await Notification.create({
      userId,
      type,
      title,
      message,
      data,
      read: false,
      priority,
      actionUrl,
      channel,
    });
  }

  // Send push notification
  if (sendPush && prefs.push) {
    await sendPushToUser(userId, title, message, {
      type,
      actionUrl: actionUrl || '',
      ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    });
  }

  // Send email notification
  if (sendEmail && prefs.email && (user as any).email) {
    const subject = emailSubject || title;
    const html = emailHtml || renderGenericNotificationEmail({ title, message, actionUrl });
    await sendMail((user as any).email, subject, html).catch(() => {});
  }
}

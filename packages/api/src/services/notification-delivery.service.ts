import { Notification, User, PushToken } from '@pawtag/db';
import { sendMail } from './email.service';
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
    const html = emailHtml || `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0d9488, #14b8a6); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; font-size: 24px; margin: 0;">PawTag</h1>
        </div>
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #111827; margin: 0 0 16px;">${title}</h2>
          <p style="color: #374151; line-height: 1.6;">${message}</p>
          ${actionUrl ? `<a href="${actionUrl}" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">View Details</a>` : ''}
        </div>
      </div>
    `;
    await sendMail((user as any).email, subject, html).catch(() => {});
  }
}

import { Notification, User, PushToken } from '@pawtag/db';
import { sendMail } from './email.service';
import { renderGenericNotificationEmail } from './email/templates';
import { sendPushToUser } from './push-notification.service';
import { membershipEntitlementService } from './membership-entitlement.service';
import logger from '../lib/logger';

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
    subscription_auto_renew_paused: 'subscriptionReminder',
    subscription_poor_experience: 'subscriptionReminder',
    referral_reward: 'referral',
    tag_expiry_warning: 'subscriptionReminder',
    system: 'orderUpdate',
    // Membership lifecycle notifications
    membership_activated: 'subscriptionReminder',
    membership_cancelled: 'subscriptionReminder',
    membership_resumed: 'subscriptionReminder',
    membership_upgraded: 'subscriptionReminder',
    membership_downgraded: 'subscriptionReminder',
    membership_extended: 'subscriptionReminder',
    membership_expired: 'subscriptionReminder',
    membership_renewal_reminder: 'subscriptionReminder',
  };
  const channelKey = channelMap[type] || 'orderUpdate';
  if (!prefs.channels[channelKey]) return;

  // Check membership entitlements for notification channels
  const inAppEntitled = await membershipEntitlementService.hasAccess(userId, 'in_app_notifications');
  const emailEntitled = await membershipEntitlementService.hasAccess(userId, 'email_notifications');

  // Create in-app notification (isolated — failure must not block push or email)
  if (inAppEntitled && prefs.inApp) {
    try {
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
    } catch (err) {
      logger.error({ err, userId, type }, 'Failed to create in-app notification');
    }
  }

  // Send push notification (follows in-app entitlement)
  if (inAppEntitled && sendPush && prefs.push) {
    try {
      await sendPushToUser(userId, title, message, {
        type,
        actionUrl: actionUrl || '',
        ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      });
    } catch (err) {
      logger.error({ err, userId, type }, 'Failed to send push notification');
    }
  }

  // Send email notification (isolated — must not be blocked by in-app or push failure)
  if (emailEntitled && sendEmail && prefs.email && (user as any).email) {
    try {
      const subject = emailSubject || title;
      const html = emailHtml || renderGenericNotificationEmail({ title, message, actionUrl });
      await sendMail((user as any).email, subject, html).catch(() => {});
    } catch (err) {
      logger.error({ err, userId, type }, 'Failed to send notification email');
    }
  }
}

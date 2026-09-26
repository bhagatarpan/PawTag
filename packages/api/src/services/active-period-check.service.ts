/**
 * @module Active Period Check Service
 * @description Background job service for HYBRID 2 Active Period monitoring.
 *
 * This service runs daily to:
 * - Send 30-day, 7-day, and 1-day warnings before Active Period expires
 * - Update tag status to 'limited' when Active Period expires
 * - Send "Active Period Expired" email
 *
 * The service uses reminderStates on the Tag document for deduplication.
 */

import { Tag, User } from '@pawtag/db';
import type { ITagDocument } from '@pawtag/db';
import { sendMail } from './email.service';
import { createAndDeliverNotification } from './notification-delivery.service';
import {
  renderTagActivePeriodExpiring30DayEmail,
  renderTagActivePeriodExpiring7DayEmail,
  renderTagActivePeriodExpiringLastDayEmail,
  renderTagActivePeriodExpiredEmail,
} from './email/templates/tag-active-period-expiring';
import logger from '../lib/logger';

// Cache for settings
let settingsCache: Record<string, string> = {};
let settingsCacheTimestamp = 0;
const SETTINGS_CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Check tags with expiring Active Periods and send warnings.
 * Runs daily via background job.
 */
export async function checkActivePeriodExpirations(): Promise<{ success: boolean; processed: number; errors: number }> {
  const now = new Date();
  let processed = 0;
  let errors = 0;

  try {
    // Find tags that need attention:
    // 1. Active period expiring within 30 days (send warnings)
    // 2. Active period expired but status still 'active' (update to 'limited')
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const tags = await Tag.find({
      status: { $in: ['active', 'limited'] },
      deletedAt: null,
      activePeriodEndsAt: { $exists: true, $ne: null },
      $or: [
        // Active period expiring within 30 days
        { activePeriodEndsAt: { $lte: thirtyDaysFromNow, $gt: now } },
        // Active period just expired (within last 24 hours)
        { activePeriodEndsAt: { $lte: now, $gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      ],
    }).lean();

    logger.info({ count: tags.length }, '[ActivePeriodCheck] Checking tags for Active Period warnings');

    for (const tag of tags) {
      try {
        const result = await processTag(tag);
        if (result) processed++;
      } catch (err) {
        logger.error({ err, tagId: tag.tagId }, '[ActivePeriodCheck] Failed to process tag');
        errors++;
      }
    }

    logger.info({ processed, errors }, '[ActivePeriodCheck] Completed');
    return { success: true, processed, errors };
  } catch (err) {
    logger.error({ err }, '[ActivePeriodCheck] Job failed');
    return { success: false, processed, errors };
  }
}

/**
 * Process a single tag for Active Period warnings.
 */
async function processTag(tag: ITagDocument): Promise<boolean> {
  const now = new Date();
  
  if (!tag.activePeriodEndsAt || !tag.ownerId) {
    return false;
  }

  const daysUntilExpiry = Math.ceil(
    (tag.activePeriodEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Get user info
  const user = await User.findById(tag.ownerId).select('email fullName').lean();
  if (!user?.email) {
    logger.warn({ tagId: tag.tagId }, '[ActivePeriodCheck] No user email found');
    return false;
  }

  // Determine which notification to send
  if (daysUntilExpiry <= 0) {
    // Active period has expired - update status to 'limited'
    return await handleExpiredPeriod(tag, user);
  } else if (daysUntilExpiry <= 1) {
    // Last day warning
    return await handleLastDayWarning(tag, user, daysUntilExpiry);
  } else if (daysUntilExpiry <= 7) {
    // 7-day warning
    return await handle7DayWarning(tag, user, daysUntilExpiry);
  } else if (daysUntilExpiry <= 30) {
    // 30-day warning
    return await handle30DayWarning(tag, user, daysUntilExpiry);
  }

  return false;
}

/**
 * Handle tags that have just expired (within last 24 hours).
 */
async function handleExpiredPeriod(
  tag: ITagDocument,
  user: { email: string; fullName?: string }
): Promise<boolean> {
  const now = new Date();
  
  // Check if we already sent the expired notification (dedup)
  // Use a simple timestamp check - if activePeriodEndsAt is more than 24 hours ago, skip
  const hoursSinceExpired = (now.getTime() - tag.activePeriodEndsAt!.getTime()) / (1000 * 60 * 60);
  if (hoursSinceExpired > 24) {
    return false;
  }

  // Update tag status to 'limited' if still 'active'
  if (tag.status === 'active') {
    await Tag.findByIdAndUpdate(tag._id, { status: 'limited' });
    logger.info({ tagId: tag.tagId }, '[ActivePeriodCheck] Tag status updated to limited');
  }

  // Send expired notification email
  const emailData = {
    customerName: user.fullName || 'there',
    tagId: tag.tagId,
    petName: 'your pet', // We don't have pet name in this context
    activePeriodEndsAt: tag.activePeriodEndsAt!.toLocaleDateString('en-NZ', { dateStyle: 'full' }),
    daysRemaining: 0,
    dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/tags`,
    membershipUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/membership`,
  };

  const html = renderTagActivePeriodExpiredEmail(emailData);
  await sendMail(user.email, 'PawTag Active Period Has Expired', html).catch(() => {});

  // In-app notification
  await createAndDeliverNotification({
    userId: tag.ownerId!.toString(),
    type: 'active_period_expired',
    title: 'PawTag Active Period Expired',
    message: `Your PawTag ${tag.tagId} has expired. Finder notifications are now disabled. Purchase a membership to restore functionality.`,
    priority: 'high',
    channel: 'alert',
    actionUrl: '/membership',
  }).catch(() => {});

  logger.info({ tagId: tag.tagId, userId: tag.ownerId }, '[ActivePeriodCheck] Sent expired notification');
  return true;
}

/**
 * Handle last-day warning (1 day remaining).
 */
async function handleLastDayWarning(
  tag: ITagDocument,
  user: { email: string; fullName?: string },
  daysRemaining: number
): Promise<boolean> {
  // Check if we already sent the last-day warning
  const reminderStates = (tag as any).reminderStates || {};
  if (reminderStates.activePeriodLastDaySent) {
    return false;
  }

  // Send last-day warning email
  const emailData = {
    customerName: user.fullName || 'there',
    tagId: tag.tagId,
    petName: 'your pet',
    activePeriodEndsAt: tag.activePeriodEndsAt!.toLocaleDateString('en-NZ', { dateStyle: 'full' }),
    daysRemaining,
    dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/tags`,
    membershipUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/membership`,
  };

  const html = renderTagActivePeriodExpiringLastDayEmail(emailData);
  await sendMail(user.email, '🚨 PawTag Active Period Expires Today', html).catch(() => {});

  // In-app notification
  await createAndDeliverNotification({
    userId: tag.ownerId!.toString(),
    type: 'active_period_expiring_7d',
    title: 'PawTag Active Period Expires Today',
    message: `Your PawTag ${tag.tagId} expires TODAY. Finder notifications will stop working. Purchase a membership now.`,
    priority: 'high',
    channel: 'alert',
    actionUrl: '/membership',
  }).catch(() => {});

  // Mark as sent
  await Tag.findByIdAndUpdate(tag._id, {
    'reminderStates.activePeriodLastDaySent': true,
  });

  logger.info({ tagId: tag.tagId, daysRemaining }, '[ActivePeriodCheck] Sent last-day warning');
  return true;
}

/**
 * Handle 7-day warning.
 */
async function handle7DayWarning(
  tag: ITagDocument,
  user: { email: string; fullName?: string },
  daysRemaining: number
): Promise<boolean> {
  // Check if we already sent the 7-day warning
  const reminderStates = (tag as any).reminderStates || {};
  if (reminderStates.activePeriod7DaySent) {
    return false;
  }

  // Send 7-day warning email
  const emailData = {
    customerName: user.fullName || 'there',
    tagId: tag.tagId,
    petName: 'your pet',
    activePeriodEndsAt: tag.activePeriodEndsAt!.toLocaleDateString('en-NZ', { dateStyle: 'full' }),
    daysRemaining,
    dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/tags`,
    membershipUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/membership`,
  };

  const html = renderTagActivePeriodExpiring7DayEmail(emailData);
  await sendMail(user.email, '⚠️ PawTag Active Period Expiring in 7 Days', html).catch(() => {});

  // In-app notification
  await createAndDeliverNotification({
    userId: tag.ownerId!.toString(),
    type: 'active_period_expiring_7d',
    title: 'PawTag Active Period Expiring Soon',
    message: `Your PawTag ${tag.tagId} expires in ${daysRemaining} days. Purchase a membership to maintain full finder functionality.`,
    priority: 'normal',
    channel: 'reminder',
    actionUrl: '/membership',
  }).catch(() => {});

  // Mark as sent
  await Tag.findByIdAndUpdate(tag._id, {
    'reminderStates.activePeriod7DaySent': true,
  });

  logger.info({ tagId: tag.tagId, daysRemaining }, '[ActivePeriodCheck] Sent 7-day warning');
  return true;
}

/**
 * Handle 30-day warning.
 */
async function handle30DayWarning(
  tag: ITagDocument,
  user: { email: string; fullName?: string },
  daysRemaining: number
): Promise<boolean> {
  // Check if we already sent the 30-day warning
  const reminderStates = (tag as any).reminderStates || {};
  if (reminderStates.activePeriod30DaySent) {
    return false;
  }

  // Send 30-day warning email
  const emailData = {
    customerName: user.fullName || 'there',
    tagId: tag.tagId,
    petName: 'your pet',
    activePeriodEndsAt: tag.activePeriodEndsAt!.toLocaleDateString('en-NZ', { dateStyle: 'full' }),
    daysRemaining,
    dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/tags`,
    membershipUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/membership`,
  };

  const html = renderTagActivePeriodExpiring30DayEmail(emailData);
  await sendMail(user.email, 'Your PawTag Active Period is Expiring', html).catch(() => {});

  // In-app notification
  await createAndDeliverNotification({
    userId: tag.ownerId!.toString(),
    type: 'active_period_expiring_30d',
    title: 'PawTag Active Period Expiring',
    message: `Your PawTag ${tag.tagId} expires in ${daysRemaining} days. Consider purchasing a membership to maintain full finder functionality.`,
    priority: 'low',
    channel: 'reminder',
    actionUrl: '/membership',
  }).catch(() => {});

  // Mark as sent
  await Tag.findByIdAndUpdate(tag._id, {
    'reminderStates.activePeriod30DaySent': true,
  });

  logger.info({ tagId: tag.tagId, daysRemaining }, '[ActivePeriodCheck] Sent 30-day warning');
  return true;
}

export default {
  checkActivePeriodExpirations,
};

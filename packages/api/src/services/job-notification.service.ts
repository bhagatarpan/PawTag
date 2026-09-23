/**
 * @module JobNotificationService
 * @description Sends email and in-app notifications for job execution results.
 * Respects per-job and global notification settings.
 */

import { BackgroundJob, Notification, Setting } from '@pawtag/db';
import { sendMail } from './email.service';
import { renderJobNotificationEmail } from './email/templates/job-notification';
import logger from '../lib/logger';

/**
 * Send notification for a job execution result.
 * Checks per-job and global settings before sending.
 */
export async function sendJobNotification(
  job: { _id: string; name: string; displayName: string; notifyOnSuccess?: boolean; notifyOnFailure?: boolean },
  result: 'success' | 'error',
  durationMs: number,
  error?: string,
): Promise<void> {
  try {
    // Check master toggle
    const globalEnabled = await getSettingValue('job-notifications.enabled');
    if (globalEnabled === 'false') return;

    // Determine if we should notify
    const isError = result === 'error';
    let shouldNotify: boolean;

    if (isError) {
      // Per-job setting overrides global
      shouldNotify = job.notifyOnFailure ?? (await getSettingValue('job-notifications.global.notifyOnFailure') !== 'false');
    } else {
      shouldNotify = job.notifyOnSuccess ?? (await getSettingValue('job-notifications.global.notifyOnSuccess') === 'true');
    }

    if (!shouldNotify) return;

    // Get recipient
    const recipient = await getSettingValue('job-notifications.email.recipient')
      || process.env.ADMIN_ALERT_EMAIL;
    if (!recipient) return;

    // Get recent history for context
    const jobDoc = await BackgroundJob.findById(job._id).lean();
    const recentHistory = (jobDoc?.runHistory || [])
      .slice(-5)
      .reverse()
      .map((h: any) => ({
        startedAt: h.startedAt,
        result: h.result,
        durationMs: h.durationMs,
        error: h.error,
      }));

    // Send email
    const subject = isError
      ? `[PawTag] Job Failed: ${job.displayName}`
      : `[PawTag] Job Completed: ${job.displayName}`;

    const html = renderJobNotificationEmail({
      jobName: job.displayName,
      result,
      durationMs,
      error,
      timestamp: new Date(),
      recentHistory,
    });

    await sendMail(recipient, subject, html);

    // Create in-app admin notification
    try {
      // Use a system user ID (first admin user)
      const systemUserId = await getSystemUserId();
      if (systemUserId) {
        await Notification.create({
          userId: systemUserId,
          audience: 'admin',
          type: 'system',
          title: subject,
          message: `${job.displayName} ${isError ? 'failed' : 'completed'} in ${(durationMs / 1000).toFixed(1)}s${error ? `: ${error}` : ''}`,
          data: { jobId: job._id, jobName: job.name, result, durationMs },
          priority: isError ? 'high' : 'normal',
          channel: isError ? 'alert' : 'info',
        });
      }
    } catch (notifErr) {
      // In-app notification failure is not critical
      logger.debug({ err: notifErr }, 'Failed to create in-app notification for job');
    }

    logger.info({ job: job.name, result, durationMs, recipient }, 'Job notification sent');
  } catch (err) {
    logger.error({ err, job: job.name }, 'Failed to send job notification');
  }
}

/**
 * Get a setting value from the database.
 */
async function getSettingValue(key: string): Promise<string | null> {
  const setting = await Setting.findOne({ key }).lean();
  return setting?.value ?? null;
}

/**
 * Get a system user ID for in-app notifications.
 */
async function getSystemUserId(): Promise<string | null> {
  const { User } = await import('@pawtag/db');
  const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
  return admin?._id?.toString() ?? null;
}

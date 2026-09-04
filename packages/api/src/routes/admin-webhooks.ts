/**
 * @module Admin Webhook Routes
 * @description Admin routes for webhook event management.
 *
 * Provides visibility and control over Stripe webhook events:
 * - View webhook event stats
 * - Retry failed events
 * - Dead letter queue management
 *
 * All routes require admin authentication + permissions.
 */

import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { WebhookEvent } from '@pawtag/db';
import logger from '../lib/logger';

const router = Router();
/** Explicitly require authentication for all webhook admin routes.
 *  Previously relied on implicit req.user check inside requirePermission. */
router.use(authenticate);

/**
 * GET /api/admin/webhooks/status
 *
 * Get webhook event statistics for the last 24 hours.
 */
router.get('/status', requirePermission('setting.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [total, completed, failed, dead, recentEvents] = await Promise.all([
      WebhookEvent.countDocuments({ createdAt: { $gte: oneDayAgo } }),
      WebhookEvent.countDocuments({ status: 'completed', createdAt: { $gte: oneDayAgo } }),
      WebhookEvent.countDocuments({ status: 'failed', createdAt: { $gte: oneDayAgo } }),
      WebhookEvent.countDocuments({ status: 'dead', createdAt: { $gte: oneDayAgo } }),
      WebhookEvent.find({ createdAt: { $gte: oneHourAgo } })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('event eventId status attempts createdAt processedAt lastError'),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalEventsLast24h: total,
          completed,
          failed,
          deadLettered: dead,
          successRate: total > 0 ? Math.round((completed / total) * 100) : 100,
        },
        recentEvents,
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch webhook status');
    res.status(500).json({ success: false, error: 'Failed to fetch webhook status' });
  }
});

/**
 * POST /api/admin/webhooks/retry/:eventId
 *
 * Manually retry a specific failed webhook event.
 */
router.post('/retry/:eventId', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const event = await WebhookEvent.findOne({ eventId: req.params.eventId });
    if (!event) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }

    event.status = 'pending';
    event.nextRetryAt = new Date();
    await event.save();

    logger.info({ eventId: req.params.eventId }, 'Webhook event queued for retry');
    res.json({ success: true, data: { message: 'Event queued for retry' } });
  } catch (err: any) {
    logger.error({ err }, 'Failed to retry webhook event');
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/admin/webhooks/retry-all
 *
 * Retry all failed webhook events.
 */
router.post('/retry-all', requirePermission('setting.update'), async (_req: AuthRequest, res: Response) => {
  try {
    const result = await WebhookEvent.updateMany(
      { status: 'failed', attempts: { $lt: 5 } },
      { status: 'pending', nextRetryAt: new Date() },
    );

    logger.info({ modified: result.modifiedCount }, 'Webhook events queued for retry');
    res.json({ success: true, data: { queued: result.modifiedCount } });
  } catch (err: any) {
    logger.error({ err }, 'Failed to retry webhook events');
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/admin/webhooks/dead-letter
 *
 * Purge dead-letter events older than specified days.
 */
router.delete('/dead-letter', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await WebhookEvent.deleteMany({
      status: 'dead',
      createdAt: { $lt: cutoff },
    });

    logger.info({ deleted: result.deletedCount, olderThanDays: days }, 'Dead-letter events purged');
    res.json({ success: true, data: { deleted: result.deletedCount } });
  } catch (err: any) {
    logger.error({ err }, 'Failed to purge dead-letter events');
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

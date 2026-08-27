/**
 * Admin routes for Webhook/Sync management.
 *
 * Provides visibility and control over the 3-layer sync architecture:
 * - Layer 1: Real-time webhooks + admin API calls
 * - Layer 2: Reconciliation job (safety net)
 * - Layer 3: Frontend polling configuration
 */

import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { WebhookEvent, Order, Setting } from '@pawtag/db';
import logger from '../lib/logger';

const router = Router();

// ─── GET /admin/webhooks/status — Overall sync status ───────────────────────
router.get('/status', requirePermission('setting.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Webhook event stats
    const [totalEvents, completedEvents, failedEvents, deadEvents, recentEvents] = await Promise.all([
      WebhookEvent.countDocuments({ createdAt: { $gte: oneDayAgo } }),
      WebhookEvent.countDocuments({ status: 'completed', createdAt: { $gte: oneDayAgo } }),
      WebhookEvent.countDocuments({ status: 'failed', createdAt: { $gte: oneDayAgo } }),
      WebhookEvent.countDocuments({ status: 'dead', createdAt: { $gte: oneDayAgo } }),
      WebhookEvent.find({ createdAt: { $gte: oneHourAgo } })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('event eventId status attempts createdAt processedAt lastError'),
    ]);

    // Reconciliation settings
    const [reconEnabled, reconInterval, reconSkipRecent, pollingEnabled, pollingInterval] = await Promise.all([
      Setting.findOne({ key: 'sync.reconciliation.enabled' }).lean(),
      Setting.findOne({ key: 'sync.reconciliation.intervalSeconds' }).lean(),
      Setting.findOne({ key: 'sync.reconciliation.skipRecentMinutes' }).lean(),
      Setting.findOne({ key: 'sync.polling.enabled' }).lean(),
      Setting.findOne({ key: 'sync.polling.intervalSeconds' }).lean(),
    ]);

    // Orders needing sync (not in terminal states, have medusaOrderId)
    const ordersNeedingSync = await Order.countDocuments({
      status: { $nin: ['cancelled', 'refunded'] },
      medusaOrderId: { $exists: true, $ne: null },
    });

    res.json({
      success: true,
      data: {
        layer1_webhooks: {
          label: 'Real-time Webhooks',
          description: 'Medusa events are forwarded to PawTag via webhooks. Admin actions (cancel/ship/refund) call Medusa APIs directly.',
          direction: 'Bidirectional — Medusa → PawTag (webhooks) + PawTag → Medusa (admin API calls)',
          latency: '0.5-2 seconds',
          stats: {
            totalEventsLast24h: totalEvents,
            completed: completedEvents,
            failed: failedEvents,
            deadLettered: deadEvents,
            successRate: totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 100,
          },
          recentEvents,
        },
        layer2_reconciliation: {
          label: 'Reconciliation Safety Net',
          description: 'Polls Medusa every N seconds to detect and correct data drift. Catches missed webhooks and failed admin sync calls.',
          direction: 'PawTag → Medusa (reads Medusa state, corrects PawTag)',
          latency: `${reconInterval?.value || '60'} seconds`,
          enabled: reconEnabled?.value !== 'false',
          intervalSeconds: parseInt(reconInterval?.value || '60', 10),
          skipRecentMinutes: parseInt(reconSkipRecent?.value || '5', 10),
          ordersNeedingSync,
        },
        layer3_polling: {
          label: 'Frontend Polling',
          description: 'Customer Orders and Order Detail pages auto-refresh to show latest status without manual page refresh.',
          direction: 'Customer frontend → PawTag API (read-only polling)',
          latency: `${pollingInterval?.value || '30'} seconds`,
          enabled: pollingEnabled?.value !== 'false',
          intervalSeconds: parseInt(pollingInterval?.value || '30', 10),
        },
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch webhook status');
    res.status(500).json({ success: false, error: 'Failed to fetch sync status' });
  }
});

// ─── POST /admin/webhooks/retry/:eventId — Manually retry a specific event ──
router.post('/retry/:eventId', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { eventId } = req.params;
    const event = await WebhookEvent.findOne({ eventId });
    if (!event) {
      res.status(404).json({ success: false, error: 'Webhook event not found' });
      return;
    }

    if (event.status === 'completed') {
      res.status(400).json({ success: false, error: 'Event already completed' });
      return;
    }

    // Re-dispatch via internal HTTP
    const port = process.env.PORT || 5000;
    const response = await fetch(`http://localhost:${port}/api/webhooks/medusa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-retry-source': 'admin-manual',
      },
      body: JSON.stringify(event.payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Webhook dispatch returned ${response.status}`);
    }

    event.status = 'completed';
    event.processedAt = new Date();
    event.lastError = undefined;
    await event.save();

    logger.info({ eventId, event: event.event }, 'Manual webhook retry successful');
    res.json({ success: true, data: { message: 'Event retried successfully' } });
  } catch (err: any) {
    logger.error({ err, eventId: req.params.eventId }, 'Manual webhook retry failed');
    res.status(500).json({ success: false, error: err.message || 'Retry failed' });
  }
});

// ─── POST /admin/webhooks/retry-all — Manually retry all failed events ──────
router.post('/retry-all', requirePermission('setting.update'), async (_req: AuthRequest, res: Response) => {
  try {
    const failedEvents = await WebhookEvent.find({
      status: 'failed',
      attempts: { $lt: 5 },
    }).limit(50);

    if (failedEvents.length === 0) {
      res.json({ success: true, data: { message: 'No failed events to retry', retried: 0 } });
      return;
    }

    let retried = 0;
    let failed = 0;

    for (const event of failedEvents) {
      try {
        const port = process.env.PORT || 5000;
        const response = await fetch(`http://localhost:${port}/api/webhooks/medusa`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-retry-source': 'admin-manual-batch',
          },
          body: JSON.stringify(event.payload),
          signal: AbortSignal.timeout(30_000),
        });

        if (response.ok) {
          event.status = 'completed';
          event.processedAt = new Date();
          event.lastError = undefined;
          await event.save();
          retried++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    logger.info({ retried, failed }, 'Batch webhook retry completed');
    res.json({ success: true, data: { message: `Retried ${retried} events, ${failed} failed`, retried, failed } });
  } catch (err: any) {
    logger.error({ err }, 'Batch webhook retry failed');
    res.status(500).json({ success: false, error: err.message || 'Batch retry failed' });
  }
});

// ─── POST /admin/webhooks/reconcile — Manually trigger reconciliation ───────
router.post('/reconcile', requirePermission('setting.update'), async (_req: AuthRequest, res: Response) => {
  try {
    const { reconcileOrders } = await import('../jobs/orderSyncReconciliation');
    // Run reconciliation in background — don't block the response
    reconcileOrders().catch((err) => logger.error({ err }, 'Manual reconciliation failed'));

    res.json({ success: true, data: { message: 'Reconciliation triggered' } });
  } catch (err: any) {
    logger.error({ err }, 'Failed to trigger reconciliation');
    res.status(500).json({ success: false, error: err.message || 'Trigger failed' });
  }
});

// ─── PUT /admin/webhooks/settings — Update sync settings ────────────────────
router.put('/settings', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { reconciliationEnabled, reconciliationIntervalSeconds, reconciliationSkipRecentMinutes, pollingEnabled, pollingIntervalSeconds } = req.body;

    const updates: Array<{ key: string; value: string }> = [];
    if (reconciliationEnabled !== undefined) updates.push({ key: 'sync.reconciliation.enabled', value: String(reconciliationEnabled) });
    if (reconciliationIntervalSeconds !== undefined) updates.push({ key: 'sync.reconciliation.intervalSeconds', value: String(reconciliationIntervalSeconds) });
    if (reconciliationSkipRecentMinutes !== undefined) updates.push({ key: 'sync.reconciliation.skipRecentMinutes', value: String(reconciliationSkipRecentMinutes) });
    if (pollingEnabled !== undefined) updates.push({ key: 'sync.polling.enabled', value: String(pollingEnabled) });
    if (pollingIntervalSeconds !== undefined) updates.push({ key: 'sync.polling.intervalSeconds', value: String(pollingIntervalSeconds) });

    for (const update of updates) {
      await Setting.findOneAndUpdate(
        { key: update.key },
        { value: update.value, updatedBy: req.user!.id },
        { upsert: true },
      );
    }

    logger.info({ updates: updates.map((u) => u.key) }, 'Sync settings updated');
    res.json({ success: true, data: { message: 'Settings updated', updated: updates.length } });
  } catch (err: any) {
    logger.error({ err }, 'Failed to update sync settings');
    res.status(500).json({ success: false, error: err.message || 'Settings update failed' });
  }
});

// ─── GET /admin/webhooks/dead-letter — List dead-lettered events ────────────
router.get('/dead-letter', requirePermission('setting.read'), async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '20', 10);
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      WebhookEvent.find({ status: 'dead' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('event eventId source attempts lastError createdAt processedAt'),
      WebhookEvent.countDocuments({ status: 'dead' }),
    ]);

    res.json({
      success: true,
      data: {
        events,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch dead-letter events');
    res.status(500).json({ success: false, error: 'Failed to fetch dead-letter events' });
  }
});

// ─── DELETE /admin/webhooks/dead-letter — Purge old dead-letter events ──────
router.delete('/dead-letter', requirePermission('setting.update'), async (req: AuthRequest, res: Response) => {
  try {
    const olderThanDays = parseInt((req.query.olderThanDays as string) || '7', 10);
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await WebhookEvent.deleteMany({
      status: 'dead',
      createdAt: { $lt: cutoff },
    });

    logger.info({ deletedCount: result.deletedCount, olderThanDays }, 'Dead-letter events purged');
    res.json({ success: true, data: { deletedCount: result.deletedCount } });
  } catch (err: any) {
    logger.error({ err }, 'Failed to purge dead-letter events');
    res.status(500).json({ success: false, error: 'Failed to purge dead-letter events' });
  }
});

export default router;

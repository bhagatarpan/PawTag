/**
 * @module Admin Background Jobs Routes
 * @description CRUD + control endpoints for background job management.
 */

import { Router, Response } from 'express';
import { BackgroundJob } from '@pawtag/db';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { AuthRequest } from '../middleware/auth';
import { auditService, type AuditContext } from '../services/audit';
import {
  executeJob,
  toggleJob,
  updateJobInterval,
} from '../services/job-scheduler.service';
import logger from '../lib/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /admin/background-jobs
 * List all background jobs with status
 */
router.get('/', requirePermission('job.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { category, status } = req.query;
    const filter: any = {};
    if (category) filter.category = category;
    if (status) filter.status = status;

    const jobs = await BackgroundJob.find(filter).sort({ category: 1, name: 1 }).lean();

    res.json({ success: true, data: jobs });
  } catch (err: any) {
    logger.error({ err }, 'Failed to list background jobs');
    res.status(500).json({ success: false, error: 'Failed to list background jobs' });
  }
});

/**
 * GET /admin/background-jobs/stats
 * Get dashboard statistics
 */
router.get('/stats', requirePermission('job.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const jobs = await BackgroundJob.find({}).lean();

    const stats = {
      total: jobs.length,
      active: jobs.filter((j) => j.enabled && j.status === 'idle').length,
      running: jobs.filter((j) => j.status === 'running').length,
      error: jobs.filter((j) => j.status === 'error').length,
      disabled: jobs.filter((j) => !j.enabled || j.status === 'disabled').length,
    };

    res.json({ success: true, data: stats });
  } catch (err: any) {
    logger.error({ err }, 'Failed to get job stats');
    res.status(500).json({ success: false, error: 'Failed to get job stats' });
  }
});

/**
 * GET /admin/background-jobs/:id
 * Get job detail
 */
router.get('/:id', requirePermission('job.read'), async (req: AuthRequest, res: Response) => {
  try {
    const job = await BackgroundJob.findById(req.params.id).lean();
    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }
    res.json({ success: true, data: job });
  } catch (err: any) {
    logger.error({ err }, 'Failed to get background job');
    res.status(500).json({ success: false, error: 'Failed to get background job' });
  }
});

/**
 * PUT /admin/background-jobs/:id
 * Update job configuration
 */
router.put('/:id', requirePermission('job.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const { enabled, intervalMs, lockLeaseMs, processTarget, maxHistorySize, notifyOnSuccess, notifyOnFailure } = req.body;

    const job = await BackgroundJob.findById(req.params.id);
    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }

    const updates: any = {};
    if (enabled !== undefined) updates.enabled = enabled;
    if (intervalMs !== undefined) updates.intervalMs = intervalMs;
    if (lockLeaseMs !== undefined) updates.lockLeaseMs = lockLeaseMs;
    if (processTarget !== undefined) updates.processTarget = processTarget;
    if (maxHistorySize !== undefined) updates.maxHistorySize = maxHistorySize;
    if (notifyOnSuccess !== undefined) updates.notifyOnSuccess = notifyOnSuccess;
    if (notifyOnFailure !== undefined) updates.notifyOnFailure = notifyOnFailure;

    const updated = await BackgroundJob.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true },
    ).lean();

    // Update scheduler if interval or enabled changed
    if (intervalMs !== undefined || enabled !== undefined) {
      if (enabled !== undefined) {
        await toggleJob(job.name, enabled);
      }
      if (intervalMs !== undefined && job.enabled) {
        await updateJobInterval(job.name, intervalMs);
      }
    }

    // Audit log
    const auditCtx = req.auditContext as AuditContext;
    await auditService.log(auditCtx, {
      action: 'job_config_update',
      eventType: 'background_job.updated',
      eventCategory: 'CONFIG',
      operationType: 'UPDATE',
      resourceType: 'BackgroundJob',
      resourceId: job.name,
      beforeState: { intervalMs: job.intervalMs, enabled: job.enabled },
      afterState: updates,
      outcome: 'SUCCESS',
      severity: 'HIGH',
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    logger.error({ err }, 'Failed to update background job');
    res.status(500).json({ success: false, error: 'Failed to update background job' });
  }
});

/**
 * POST /admin/background-jobs/:id/run
 * Trigger immediate job execution
 */
router.post('/:id/run', requirePermission('job.execute'), async (req: AuthRequest, res: Response) => {
  try {
    const job = await BackgroundJob.findById(req.params.id).lean();
    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }

    const result = await executeJob(job.name);

    // Audit log
    const auditCtx = req.auditContext as AuditContext;
    await auditService.log(auditCtx, {
      action: 'job_manual_run',
      eventType: 'background_job.executed',
      eventCategory: 'SYSTEM',
      operationType: 'CREATE',
      resourceType: 'BackgroundJob',
      resourceId: job.name,
      outcome: result ? 'SUCCESS' : 'PARTIAL',
      severity: 'HIGH',
      metadata: { result },
    });

    res.json({
      success: true,
      data: {
        job: job.name,
        result: result || { success: false, error: 'Skipped (lock held or disabled)' },
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to run background job');
    res.status(500).json({ success: false, error: 'Failed to run background job' });
  }
});

/**
 * POST /admin/background-jobs/:id/toggle
 * Toggle job enabled/disabled
 */
router.post('/:id/toggle', requirePermission('job.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const job = await BackgroundJob.findById(req.params.id);
    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }

    const newEnabled = !job.enabled;
    await toggleJob(job.name, newEnabled);

    // Audit log
    const auditCtx = req.auditContext as AuditContext;
    await auditService.log(auditCtx, {
      action: 'job_toggle',
      eventType: 'background_job.updated',
      eventCategory: 'CONFIG',
      operationType: 'UPDATE',
      resourceType: 'BackgroundJob',
      resourceId: job.name,
      beforeState: { enabled: job.enabled },
      afterState: { enabled: newEnabled },
      outcome: 'SUCCESS',
      severity: 'HIGH',
    });

    res.json({
      success: true,
      data: {
        name: job.name,
        enabled: newEnabled,
        status: newEnabled ? 'idle' : 'disabled',
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to toggle background job');
    res.status(500).json({ success: false, error: 'Failed to toggle background job' });
  }
});

/**
 * GET /admin/background-jobs/:id/history
 * Get execution history
 */
router.get('/:id/history', requirePermission('job.read'), async (req: AuthRequest, res: Response) => {
  try {
    const job = await BackgroundJob.findById(req.params.id).lean();
    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    // Get history from the runHistory array (sliced)
    const history = (job.runHistory || [])
      .sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(offset, offset + limit);

    res.json({
      success: true,
      data: {
        job: job.name,
        history,
        total: (job.runHistory || []).length,
        page,
        limit,
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to get job history');
    res.status(500).json({ success: false, error: 'Failed to get job history' });
  }
});

/**
 * DELETE /admin/background-jobs/:id/history
 * Purge old history entries
 */
router.delete('/:id/history', requirePermission('job.manage'), async (req: AuthRequest, res: Response) => {
  try {
    const job = await BackgroundJob.findById(req.params.id);
    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }

    const { olderThan } = req.query;
    let purgedCount = 0;

    if (olderThan) {
      // Parse duration string (e.g., "30d", "7d", "24h")
      const match = (olderThan as string).match(/^(\d+)(d|h)$/);
      if (!match) {
        res.status(400).json({ success: false, error: 'Invalid olderThan format. Use: 30d, 7d, 24h' });
        return;
      }

      const amount = parseInt(match[1]);
      const unit = match[2];
      const cutoffMs = unit === 'd' ? amount * 86400000 : amount * 3600000;
      const cutoff = new Date(Date.now() - cutoffMs);

      const originalLength = job.runHistory.length;
      job.runHistory = job.runHistory.filter(
        (entry: any) => new Date(entry.startedAt) > cutoff,
      );
      purgedCount = originalLength - job.runHistory.length;
    } else {
      // Purge all history
      purgedCount = job.runHistory.length;
      job.runHistory = [];
    }

    await job.save();

    // Audit log
    const auditCtx = req.auditContext as AuditContext;
    await auditService.log(auditCtx, {
      action: 'job_history_purge',
      eventType: 'background_job.history_purged',
      eventCategory: 'CONFIG',
      operationType: 'DELETE',
      resourceType: 'BackgroundJob',
      resourceId: job.name,
      outcome: 'SUCCESS',
      severity: 'HIGH',
      metadata: { purgedCount, olderThan: olderThan || 'all' },
    });

    res.json({
      success: true,
      data: {
        job: job.name,
        purgedCount,
        remaining: job.runHistory.length,
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to purge job history');
    res.status(500).json({ success: false, error: 'Failed to purge job history' });
  }
});

export default router;

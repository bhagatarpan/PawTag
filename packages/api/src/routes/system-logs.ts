import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import { SystemLog, Setting } from '@pawtag/db';
import logger from '../lib/logger';
import {
  getAllSystemLogSettings,
  invalidateSystemLogSettingsCache,
  LOG_LEVELS,
  LOG_CATEGORIES,
} from '../lib/system-log-settings';

const router = Router();
router.use(authenticate);

// ── Settings ────────────────────────────────────────────────────────

router.get('/settings', requirePermission('systemlogs.admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await getAllSystemLogSettings();
    res.json({
      success: true,
      data: {
        enabled: settings.enabled,
        levels: LOG_LEVELS.map((key) => ({ key, enabled: settings.levels[key] })),
        categories: LOG_CATEGORIES.map((key) => ({ key, enabled: settings.categories[key] })),
        sampling: LOG_LEVELS.map((key) => ({ key, value: settings.sampling[key] })),
        retentionDays: settings.retentionDays,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'System log settings query failed');
    res.status(500).json({ success: false, error: 'Failed to get system log settings' });
  }
});

const settingUpdateSchema = z.object({
  value: z.string().min(1),
});

router.put('/settings/:key', requirePermission('systemlogs.admin'), validate(settingUpdateSchema), async (req: AuthRequest, res: Response) => {
  const keyParam = req.params.key;
  const validKeys = [
    'systemLog.enabled',
    ...LOG_LEVELS.map((l) => `systemLog.level.${l}`),
    ...LOG_CATEGORIES.map((c) => `systemLog.category.${c}`),
    ...LOG_LEVELS.map((l) => `systemLog.sampling.${l}`),
    'systemLog.retentionDays',
  ];

  if (!validKeys.includes(keyParam)) {
    res.status(400).json({ success: false, error: 'Invalid system log setting key' });
    return;
  }

  try {
    const setting = await Setting.findOneAndUpdate(
      { key: keyParam },
      {
        key: keyParam,
        value: req.body.value,
        category: 'systemLog',
        description: `System log setting: ${keyParam}`,
        updatedBy: req.user!.id,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    invalidateSystemLogSettingsCache();

    res.json({ success: true, data: { key: keyParam, value: setting!.value } });
  } catch (error) {
    logger.error({ err: error }, 'System log setting update failed');
    res.status(500).json({ success: false, error: 'Failed to update system log setting' });
  }
});

// ── Query ───────────────────────────────────────────────────────────

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  search: z.string().optional(),
  level: z.string().optional(),
  category: z.string().optional(),
  service: z.string().optional(),
  requestId: z.string().optional(),
  correlationId: z.string().optional(),
  traceId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.string().default('timestamp'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

function buildSystemLogQuery(params: Record<string, unknown>): Record<string, unknown> {
  const { search, level, category, service, requestId, correlationId, traceId, startDate, endDate } = params;
  const query: Record<string, unknown> = {};

  if (search && typeof search === 'string') {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    query.$or = [
      { message: rx },
      { requestId: rx },
      { correlationId: rx },
      { traceId: rx },
      { operation: rx },
      { feature: rx },
      { 'error.message': rx },
      { 'error.code': rx },
      { 'error.name': rx },
      { source: rx },
    ];
  }

  if (level) {
    const values = String(level).split(',').map((s) => s.trim()).filter(Boolean);
    query.level = values.length > 1 ? { $in: values } : values[0];
  }

  if (category) {
    const values = String(category).split(',').map((s) => s.trim()).filter(Boolean);
    query.category = values.length > 1 ? { $in: values } : values[0];
  }

  if (service) query.service = service;
  if (requestId) query.requestId = requestId;
  if (correlationId) query.correlationId = correlationId;
  if (traceId) query.traceId = traceId;

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) (query.timestamp as Record<string, Date>).$gte = new Date(startDate as string);
    if (endDate) (query.timestamp as Record<string, Date>).$lte = new Date(endDate as string);
  }

  return query;
}

router.get('/', requirePermission('systemlogs.read'), validate(querySchema), async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, sortBy, sortDir } = req.query;
    const query = buildSystemLogQuery(req.query as Record<string, unknown>);

    const sort: Record<string, 1 | -1> = {};
    sort[sortBy as string] = sortDir === 'asc' ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      SystemLog.find(query).sort(sort).skip(skip).limit(Number(limit)).lean(),
      SystemLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        items,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'System log query failed');
    res.status(500).json({ success: false, error: 'Failed to query system logs' });
  }
});

// ── Summary ─────────────────────────────────────────────────────────

router.get('/summary', requirePermission('systemlogs.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [total, today, errors, warnings, byCategory, byLevel] = await Promise.all([
      SystemLog.countDocuments(),
      SystemLog.countDocuments({ timestamp: { $gte: startOfToday } }),
      SystemLog.countDocuments({ level: { $in: ['error', 'fatal'] } }),
      SystemLog.countDocuments({ level: 'warn' }),
      SystemLog.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      SystemLog.aggregate([
        { $group: { _id: '$level', count: { $sum: 1 } } },
      ]),
    ]);

    const categoryMap: Record<string, number> = {};
    for (const row of byCategory) categoryMap[row._id] = row.count;

    const levelMap: Record<string, number> = {};
    for (const row of byLevel) levelMap[row._id] = row.count;

    res.json({
      success: true,
      data: {
        total,
        today,
        errors,
        warnings,
        byCategory: categoryMap,
        byLevel: levelMap,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'System log summary failed');
    res.status(500).json({ success: false, error: 'Failed to get system log summary' });
  }
});

// ── Export ───────────────────────────────────────────────────────────

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

router.get('/export', requirePermission('systemlogs.read'), async (req: AuthRequest, res: Response) => {
  try {
    const format = req.query.format === 'json' ? 'json' : 'csv';
    const query = buildSystemLogQuery(req.query as Record<string, unknown>);
    const logs = await SystemLog.find(query).sort({ timestamp: -1 }).limit(5000).lean();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="system-logs-${stamp}.json"`);
      res.send(JSON.stringify(logs, null, 2));
      return;
    }

    const header = ['timestamp', 'level', 'category', 'message', 'service', 'requestId', 'correlationId', 'traceId', 'feature', 'operation', 'durationMs', 'error.name', 'error.message', 'error.code', 'logId'];
    const rows = logs.map((e) => {
      const errName = (e as Record<string, unknown>).error as Record<string, unknown> | undefined;
      return header.map((key) => {
        if (key.startsWith('error.')) {
          const field = key.split('.')[1];
          return csvCell(errName?.[field]);
        }
        return csvCell((e as Record<string, unknown>)[key]);
      }).join(',');
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="system-logs-${stamp}.csv"`);
    res.send([header.join(','), ...rows].join('\n'));
  } catch (error) {
    logger.error({ err: error }, 'System log export failed');
    res.status(500).json({ success: false, error: 'Failed to export system logs' });
  }
});

// ── Correlation ─────────────────────────────────────────────────────

router.get('/request/:requestId', requirePermission('systemlogs.read'), async (req: AuthRequest, res: Response) => {
  try {
    const logs = await SystemLog.find({ requestId: req.params.requestId })
      .sort({ timestamp: 1 })
      .lean();
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error({ err: error }, 'System log request query failed');
    res.status(500).json({ success: false, error: 'Failed to query request logs' });
  }
});

router.get('/correlation/:correlationId', requirePermission('systemlogs.read'), async (req: AuthRequest, res: Response) => {
  try {
    const logs = await SystemLog.find({ correlationId: req.params.correlationId })
      .sort({ timestamp: 1 })
      .lean();
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error({ err: error }, 'System log correlation query failed');
    res.status(500).json({ success: false, error: 'Failed to query correlation logs' });
  }
});

router.get('/trace/:traceId', requirePermission('systemlogs.read'), async (req: AuthRequest, res: Response) => {
  try {
    const logs = await SystemLog.find({ traceId: req.params.traceId })
      .sort({ timestamp: 1 })
      .lean();
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error({ err: error }, 'System log trace query failed');
    res.status(500).json({ success: false, error: 'Failed to query trace logs' });
  }
});

export default router;

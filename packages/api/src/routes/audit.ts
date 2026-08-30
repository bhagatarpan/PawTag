import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import { AuditEvent, Setting, type IAuditEventDocument } from '@pawtag/db';
import { auditService } from '../services/audit/audit.service';
import { AUDIT_ACTORS, AUDIT_CATEGORIES, auditPolicyKey, getAuditPolicy, invalidateAuditPolicyCache } from '../services/audit/audit.policy';
import { enforceRetention, getRetentionStats, placeLegalHold, removeLegalHold } from '../services/audit/audit.retention';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

const policyUpdateSchema = z.object({ enabled: z.boolean() });

router.get('/settings', requirePermission('audit.admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const policy = await getAuditPolicy(true);
    res.json({
      success: true,
      data: {
        categories: AUDIT_CATEGORIES.map((key) => ({ key, enabled: policy.categories[key] })),
        actors: AUDIT_ACTORS.map((key) => ({ key, enabled: policy.actors[key] })),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Audit policy query failed');
    res.status(500).json({ success: false, error: 'Failed to get audit settings' });
  }
});

router.put('/settings/:kind/:value', requirePermission('audit.admin'), validate(policyUpdateSchema), async (req: AuthRequest, res: Response) => {
  const kind = req.params.kind;
  const value = req.params.value.toUpperCase();
  const validValues = kind === 'category' ? AUDIT_CATEGORIES : kind === 'actor' ? AUDIT_ACTORS : [];
  if (!validValues.includes(value as never)) {
    res.status(400).json({ success: false, error: 'Invalid audit setting' });
    return;
  }

  try {
    const key = auditPolicyKey(kind as 'category' | 'actor', value);
    const previous = await Setting.findOne({ key }).lean();
    const setting = await Setting.findOneAndUpdate(
      { key },
      {
        key,
        value: String(req.body.enabled),
        category: 'audit',
        description: `Enable audit logging for ${kind} ${value}`,
        updatedBy: req.user!.id,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    invalidateAuditPolicyCache();

    await auditService.log({
      ...(req.auditContext as any),
      actorId: req.user!.id,
      actorEmail: req.user!.email,
    }, {
      action: 'audit_policy_updated',
      eventType: 'audit.policy_updated',
      eventCategory: 'CONFIG',
      operationType: 'UPDATE',
      resourceType: 'AuditPolicy',
      resourceId: `${kind}:${value}`,
      changedFields: [{ field: 'enabled', before: previous?.value === 'true', after: req.body.enabled, sensitive: false }],
      metadata: { kind, value, enabled: req.body.enabled },
      outcome: 'SUCCESS',
      severity: 'HIGH',
      forceAudit: true,
    });

    res.json({ success: true, data: { kind, key: value, enabled: setting!.value === 'true' } });
  } catch (error) {
    logger.error({ err: error }, 'Audit policy update failed');
    res.status(500).json({ success: false, error: 'Failed to update audit setting' });
  }
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().optional(),
  auditEventId: z.string().optional(),
  transactionId: z.string().optional(),
  correlationId: z.string().optional(),
  requestId: z.string().optional(),
  traceId: z.string().optional(),
  parentEventId: z.string().optional(),
  actorType: z.string().optional(),
  actorId: z.string().optional(),
  actorEmail: z.string().optional(),
  impersonatorId: z.string().optional(),
  tenantId: z.string().optional(),
  eventCategory: z.string().optional(),
  eventType: z.string().optional(),
  action: z.string().optional(),
  operationType: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  outcome: z.string().optional(),
  severity: z.string().optional(),
  sourceIp: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  legalHold: z.coerce.boolean().optional(),
  sortBy: z.string().default('occurredAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build the Mongo query shared by the list and export endpoints. */
function buildAuditQuery(params: Record<string, unknown>): Record<string, unknown> {
  const {
    search, auditEventId, transactionId, correlationId, requestId, traceId, parentEventId,
    actorType, actorId, actorEmail, impersonatorId, tenantId, eventCategory, eventType, action,
    operationType, resourceType, resourceId, outcome, severity, sourceIp, startDate, endDate, legalHold,
  } = params;

  const query: Record<string, unknown> = {};

  if (search && typeof search === 'string') {
    const rx = { $regex: escapeRegex(search), $options: 'i' };
    query.$or = [
      { auditEventId: rx }, { transactionId: rx }, { correlationId: rx }, { requestId: rx }, { traceId: rx },
      { actorId: rx }, { actorEmail: rx }, { actorUsername: rx },
      { action: rx }, { eventType: rx }, { resourceType: rx }, { resourceId: rx }, { sourceIp: rx },
    ];
  }
  if (auditEventId) query.auditEventId = auditEventId;
  if (transactionId) query.transactionId = transactionId;
  if (correlationId) query.correlationId = correlationId;
  if (requestId) query.requestId = requestId;
  if (traceId) query.traceId = traceId;
  if (parentEventId) query.parentEventId = parentEventId;
  if (actorType) query.actorType = actorType;
  if (actorId) query.actorId = actorId;
  if (actorEmail) query.actorEmail = { $regex: escapeRegex(String(actorEmail)), $options: 'i' };
  if (impersonatorId) query.impersonatorId = impersonatorId;
  if (tenantId) query.tenantId = tenantId;
  if (eventCategory) query.eventCategory = eventCategory;
  if (eventType) query.eventType = eventType;
  if (action) query.action = { $regex: action, $options: 'i' };
  if (operationType) query.operationType = operationType;
  if (resourceType) query.resourceType = resourceType;
  if (resourceId) query.resourceId = resourceId;
  if (outcome) query.outcome = outcome;
  if (severity) {
    const values = String(severity).split(',').map((s) => s.trim()).filter(Boolean);
    query.severity = values.length > 1 ? { $in: values } : values[0];
  }
  if (sourceIp) query.sourceIp = sourceIp;
  if (legalHold !== undefined) query.legalHold = legalHold;

  if (startDate || endDate) {
    query.occurredAt = {};
    if (startDate) (query.occurredAt as Record<string, Date>).$gte = new Date(startDate as string);
    if (endDate) (query.occurredAt as Record<string, Date>).$lte = new Date(endDate as string);
  }

  return query;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

router.get('/', requirePermission('audit.read'), validate(querySchema), async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, sortBy, sortDir } = req.query;
    const query = buildAuditQuery(req.query as Record<string, unknown>);

    const sort: Record<string, 1 | -1> = {};
    sort[sortBy as string] = sortDir === 'asc' ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      AuditEvent.find(query).sort(sort).skip(skip).limit(Number(limit)).lean(),
      AuditEvent.countDocuments(query),
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
    logger.error({ err: error }, 'Audit query failed');
    res.status(500).json({ success: false, error: 'Failed to query audit events' });
  }
});

router.get('/summary', requirePermission('audit.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [total, today, failed, highRisk, actorIds] = await Promise.all([
      AuditEvent.countDocuments(),
      AuditEvent.countDocuments({ occurredAt: { $gte: startOfToday } }),
      AuditEvent.countDocuments({ outcome: 'FAILURE' }),
      AuditEvent.countDocuments({ severity: { $in: ['HIGH', 'CRITICAL'] } }),
      AuditEvent.distinct('actorId'),
    ]);

    res.json({
      success: true,
      data: {
        total,
        today,
        failed,
        highRisk,
        uniqueActors: actorIds.filter(Boolean).length,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Audit summary failed');
    res.status(500).json({ success: false, error: 'Failed to get audit summary' });
  }
});

router.get('/export', requirePermission('audit.read'), async (req: AuthRequest, res: Response) => {
  try {
    const format = req.query.format === 'json' ? 'json' : 'csv';
    const query = buildAuditQuery(req.query as Record<string, unknown>);
    const events = await AuditEvent.find(query).sort({ occurredAt: -1 }).limit(5000).lean();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit-events-${stamp}.json"`);
      res.send(JSON.stringify(events, null, 2));
      return;
    }

    const header = ['occurredAt', 'actorType', 'actorEmail', 'actorId', 'action', 'eventType', 'eventCategory', 'resourceType', 'resourceId', 'outcome', 'severity', 'sourceIp', 'auditEventId', 'transactionId', 'correlationId', 'requestId'];
    const rows = events.map((e) => header.map((key) => csvCell((e as Record<string, unknown>)[key])).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-events-${stamp}.csv"`);
    res.send([header.join(','), ...rows].join('\n'));
  } catch (error) {
    logger.error({ err: error }, 'Audit export failed');
    res.status(500).json({ success: false, error: 'Failed to export audit events' });
  }
});

router.get('/stats', requirePermission('audit.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const stats = await getRetentionStats();
    const queueStats = auditService.getQueueStats();

    res.json({
      success: true,
      data: {
        ...stats,
        queue: queueStats,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Audit stats failed');
    res.status(500).json({ success: false, error: 'Failed to get audit stats' });
  }
});

router.get('/transaction/:transactionId', requirePermission('audit.read'), async (req: AuthRequest, res: Response) => {
  try {
    const events = await AuditEvent.find({ transactionId: req.params.transactionId })
      .sort({ eventSequenceNumber: 1 })
      .lean();

    if (events.length === 0) {
      res.status(404).json({ success: false, error: 'Transaction not found' });
      return;
    }

    res.json({ success: true, data: events });
  } catch (error) {
    logger.error({ err: error }, 'Transaction audit query failed');
    res.status(500).json({ success: false, error: 'Failed to query transaction audit' });
  }
});

router.get('/correlation/:correlationId', requirePermission('audit.read'), async (req: AuthRequest, res: Response) => {
  try {
    const events = await AuditEvent.find({ correlationId: req.params.correlationId })
      .sort({ occurredAt: 1 })
      .lean();

    res.json({ success: true, data: events });
  } catch (error) {
    logger.error({ err: error }, 'Correlation audit query failed');
    res.status(500).json({ success: false, error: 'Failed to query correlation audit' });
  }
});

router.get('/entity/:resourceType/:resourceId', requirePermission('audit.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { resourceType, resourceId } = req.params;
    const { startDate, endDate, limit = '100' } = req.query;

    const query: Record<string, unknown> = { resourceType, resourceId };
    if (startDate || endDate) {
      query.occurredAt = {};
      if (startDate) (query.occurredAt as Record<string, Date>).$gte = new Date(startDate as string);
      if (endDate) (query.occurredAt as Record<string, Date>).$lte = new Date(endDate as string);
    }

    const events = await AuditEvent.find(query)
      .sort({ occurredAt: -1 })
      .limit(Number(limit))
      .lean();

    res.json({ success: true, data: events });
  } catch (error) {
    logger.error({ err: error }, 'Entity audit query failed');
    res.status(500).json({ success: false, error: 'Failed to query entity audit' });
  }
});

router.get('/actor/:actorId', requirePermission('audit.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { actorId } = req.params;
    const { startDate, endDate, limit = '100', actorType } = req.query;

    const query: Record<string, unknown> = { actorId };
    if (actorType) query.actorType = actorType;
    if (startDate || endDate) {
      query.occurredAt = {};
      if (startDate) (query.occurredAt as Record<string, Date>).$gte = new Date(startDate as string);
      if (endDate) (query.occurredAt as Record<string, Date>).$lte = new Date(endDate as string);
    }

    const events = await AuditEvent.find(query)
      .sort({ occurredAt: -1 })
      .limit(Number(limit))
      .lean();

    res.json({ success: true, data: events });
  } catch (error) {
    logger.error({ err: error }, 'Actor audit query failed');
    res.status(500).json({ success: false, error: 'Failed to query actor audit' });
  }
});

router.get('/verify-chain', requirePermission('audit.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { streamKey, limit = '1000' } = req.query;
    const result = await auditService.verifyHashChain(streamKey as string, Number(limit));
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Hash chain verification failed');
    res.status(500).json({ success: false, error: 'Failed to verify hash chain' });
  }
});

const legalHoldSchema = z.object({
  eventIds: z.array(z.string()).min(1),
  reason: z.string().min(1).max(500),
});

router.post('/legal-hold', requirePermission('audit.admin'), validate(legalHoldSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { eventIds, reason } = req.body;
    const count = await placeLegalHold(eventIds, reason);
    res.json({ success: true, data: { count, reason } });
  } catch (error) {
    logger.error({ err: error }, 'Legal hold placement failed');
    res.status(500).json({ success: false, error: 'Failed to place legal hold' });
  }
});

router.delete('/legal-hold', requirePermission('audit.admin'), validate(legalHoldSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { eventIds } = req.body;
    const count = await removeLegalHold(eventIds);
    res.json({ success: true, data: { count } });
  } catch (error) {
    logger.error({ err: error }, 'Legal hold removal failed');
    res.status(500).json({ success: false, error: 'Failed to remove legal hold' });
  }
});

router.post('/retention/enforce', requirePermission('audit.admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const result = await enforceRetention();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Retention enforcement failed');
    res.status(500).json({ success: false, error: 'Failed to enforce retention' });
  }
});

// ── Purge ───────────────────────────────────────────────────────────

const purgeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

router.post('/purge', requirePermission('audit.admin'), validate(purgeSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.body;
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      res.status(400).json({ success: false, error: 'startDate must be before endDate' });
      return;
    }

    // Purge audit events in date range, but skip those under legal hold
    const query = { occurredAt: { $gte: start, $lte: end }, legalHold: false };
    const count = await AuditEvent.countDocuments(query);

    if (count === 0) {
      res.json({ success: true, data: { deleted: 0 } });
      return;
    }

    const result = await AuditEvent.deleteMany(query);

    logger.info(
      { deleted: result.deletedCount, startDate, endDate, userId: req.user!.id },
      'Audit events purged',
    );

    res.json({ success: true, data: { deleted: result.deletedCount } });
  } catch (error) {
    logger.error({ err: error }, 'Audit event purge failed');
    res.status(500).json({ success: false, error: 'Failed to purge audit events' });
  }
});

export default router;

import { AuditEvent, type IAuditEventDocument } from '@pawtag/db';
import logger from '../../lib/logger';

export interface RetentionPolicy {
  name: string;
  description: string;
  eventCategories: string[];
  severity?: string[];
  tenantId?: string;
  retentionDays: number;
  archiveAfterDays?: number;
  archiveStorage?: 'r2' | 's3' | 'gcs' | 'azure';
  legalHoldExempt?: boolean;
  deleteAfterArchive?: boolean;
}

export const DEFAULT_RETENTION_POLICIES: RetentionPolicy[] = [
  {
    name: 'auth_critical',
    description: 'Authentication and security critical events',
    eventCategories: ['AUTH', 'SECURITY'],
    severity: ['HIGH', 'CRITICAL'],
    retentionDays: 2555,
    archiveAfterDays: 365,
    legalHoldExempt: false,
  },
  {
    name: 'auth_standard',
    description: 'Standard authentication events',
    eventCategories: ['AUTH'],
    severity: ['INFO', 'LOW', 'MEDIUM'],
    retentionDays: 365,
    archiveAfterDays: 90,
  },
  {
    name: 'financial',
    description: 'Financial transactions and billing',
    eventCategories: ['FINANCIAL'],
    retentionDays: 2555,
    archiveAfterDays: 365,
    legalHoldExempt: false,
  },
  {
    name: 'authorization',
    description: 'Permission and role changes',
    eventCategories: ['AUTHZ'],
    retentionDays: 2555,
    archiveAfterDays: 365,
    legalHoldExempt: false,
  },
  {
    name: 'admin_actions',
    description: 'Administrative operations',
    eventCategories: ['ADMIN', 'CONFIG'],
    retentionDays: 2555,
    archiveAfterDays: 365,
  },
  {
    name: 'system_operations',
    description: 'Automated system operations',
    eventCategories: ['SYSTEM', 'INTEGRATION'],
    retentionDays: 365,
    archiveAfterDays: 90,
  },
  {
    name: 'data_access',
    description: 'Sensitive data read/export events',
    eventCategories: ['READ', 'EXPORT'],
    severity: ['MEDIUM', 'HIGH', 'CRITICAL'],
    retentionDays: 365,
    archiveAfterDays: 90,
  },
  {
    name: 'file_operations',
    description: 'File upload/download/delete',
    eventCategories: ['FILE'],
    retentionDays: 365,
    archiveAfterDays: 90,
  },
  {
    name: 'standard_operations',
    description: 'Standard CRUD operations',
    eventCategories: ['CREATE', 'UPDATE', 'DELETE', 'TRANSITION'],
    retentionDays: 365,
    archiveAfterDays: 90,
  },
  {
    name: 'default',
    description: 'Default catch-all policy',
    eventCategories: [],
    retentionDays: 90,
    archiveAfterDays: 30,
  },
];

export function getRetentionPolicy(event: Partial<IAuditEventDocument>): RetentionPolicy {
  for (const policy of DEFAULT_RETENTION_POLICIES) {
    if (policy.eventCategories.length === 0 || policy.eventCategories.includes(event.eventCategory || '')) {
      if (!policy.severity || (event.severity && policy.severity.includes(event.severity))) {
        if (!policy.tenantId || (event.tenantId && policy.tenantId === event.tenantId)) {
          return policy;
        }
      }
    }
  }
  return DEFAULT_RETENTION_POLICIES[DEFAULT_RETENTION_POLICIES.length - 1];
}

export function calculateRetentionDates(event: Partial<IAuditEventDocument>): { retentionExpiresAt: Date; archiveAfterDays?: number } {
  const policy = getRetentionPolicy(event);
  const occurredAt = event.occurredAt || new Date();
  const retentionExpiresAt = new Date(occurredAt.getTime() + policy.retentionDays * 24 * 60 * 60 * 1000);
  return {
    retentionExpiresAt,
    archiveAfterDays: policy.archiveAfterDays,
  };
}

export async function applyRetentionPolicy(event: Partial<IAuditEventDocument>): Promise<void> {
  const { retentionExpiresAt } = calculateRetentionDates(event);
  await AuditEvent.updateOne(
    { auditEventId: event.auditEventId },
    {
      $set: {
        retentionPolicy: getRetentionPolicy(event).name,
        retentionExpiresAt,
      },
    },
  );
}

export async function enforceRetention(): Promise<{ deleted: number; archived: number; errors: string[] }> {
  const errors: string[] = [];
  let deleted = 0;
  let archived = 0;

  try {
    const now = new Date();

    const expiredEvents = await AuditEvent.find({
      retentionExpiresAt: { $lte: now },
      legalHold: false,
      isImmutable: true,
    }).lean();

    for (const event of expiredEvents) {
      try {
        const policy = DEFAULT_RETENTION_POLICIES.find((p) => p.name === event.retentionPolicy) || DEFAULT_RETENTION_POLICIES[DEFAULT_RETENTION_POLICIES.length - 1];

        if (policy.archiveAfterDays && !event.archivedAt) {
          await archiveEvent(event);
          archived++;
        } else if (policy.deleteAfterArchive && event.archivedAt) {
          await AuditEvent.deleteOne({ auditEventId: event.auditEventId });
          deleted++;
        } else if (!policy.archiveAfterDays) {
          await AuditEvent.deleteOne({ auditEventId: event.auditEventId });
          deleted++;
        }
      } catch (error) {
        errors.push(`Failed to process event ${event.auditEventId}: ${(error as Error).message}`);
      }
    }

    logger.info({ deleted, archived, errors: errors.length }, 'Retention enforcement completed');
  } catch (error) {
    errors.push(`Retention enforcement failed: ${(error as Error).message}`);
    logger.error({ err: error }, 'Retention enforcement error');
  }

  return { deleted, archived, errors };
}

async function archiveEvent(event: IAuditEventDocument): Promise<void> {
  const archiveData = {
    ...event.toObject(),
    archivedAt: new Date(),
    originalCollection: 'audit_events',
  };

  await AuditEvent.updateOne(
    { auditEventId: event.auditEventId },
    {
      $set: {
        archivedAt: new Date(),
        isImmutable: true,
      },
    },
  );

  logger.debug({ auditEventId: event.auditEventId }, 'Event archived');
}

export async function placeLegalHold(eventIds: string[], reason: string): Promise<number> {
  const result = await AuditEvent.updateMany(
    { auditEventId: { $in: eventIds } },
    {
      $set: {
        legalHold: true,
        legalHoldReason: reason,
        legalHoldPlacedAt: new Date(),
      },
    },
  );
  logger.info({ count: result.modifiedCount, reason }, 'Legal hold placed');
  return result.modifiedCount;
}

export async function removeLegalHold(eventIds: string[]): Promise<number> {
  const result = await AuditEvent.updateMany(
    { auditEventId: { $in: eventIds } },
    {
      $unset: {
        legalHoldReason: '',
        legalHoldPlacedAt: '',
      },
      $set: { legalHold: false },
    },
  );
  logger.info({ count: result.modifiedCount }, 'Legal hold removed');
  return result.modifiedCount;
}

export async function getRetentionStats(): Promise<{
  total: number;
  byPolicy: Record<string, { count: number; expired: number; onLegalHold: number }>;
  legalHold: number;
  archived: number;
}> {
  const [total, policies, legalHold, archived] = await Promise.all([
    AuditEvent.countDocuments(),
    AuditEvent.aggregate([
      { $group: { _id: '$retentionPolicy', count: { $sum: 1 }, expired: { $sum: { $cond: [{ $lte: ['$retentionExpiresAt', new Date()] }, 1, 0] } }, onLegalHold: { $sum: { $cond: ['$legalHold', 1, 0] } } } },
    ]),
    AuditEvent.countDocuments({ legalHold: true }),
    AuditEvent.countDocuments({ archivedAt: { $exists: true } }),
  ]);

  const byPolicy: Record<string, { count: number; expired: number; onLegalHold: number }> = {};
  for (const p of policies) {
    byPolicy[p._id || 'none'] = { count: p.count, expired: p.expired, onLegalHold: p.onLegalHold };
  }

  return { total, byPolicy, legalHold, archived };
}
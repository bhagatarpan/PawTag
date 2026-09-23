/**
 * Audit Retention Job
 *
 * Enforces audit event retention policies:
 * - Archives old events per policy rules
 * - Deletes expired records per legal requirements
 * - Respects legal holds
 *
 * Should run daily via the job scheduler.
 */

import logger from '../lib/logger';
import type { JobResult } from '../services/job-scheduler.service';

/**
 * Run the audit retention job. Called by the job scheduler.
 */
export async function runAuditRetentionJob(): Promise<JobResult> {
  try {
    const { enforceRetention } = await import('../services/audit/audit.retention');
    await enforceRetention();
    logger.info('[AuditRetentionJob] Audit retention enforcement completed');
    return { success: true };
  } catch (error: any) {
    logger.error({ err: error }, '[AuditRetentionJob] Job error');
    return { success: false, error: error.message || 'Unknown error' };
  }
}

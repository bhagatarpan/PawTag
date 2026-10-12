import { runSavedCardExpiryCheck } from '../services/saved-card-expiry.service';
import type { JobResult } from '../services/job-scheduler.service';
import logger from '../lib/logger';

/**
 * Daily saved-card expiry check: warns customers once per card per
 * expiration period when a saved card expires within 28 days.
 * Locking is provided by the DB scheduler — no internal timer here.
 * `now` is injectable for deterministic tests; the scheduler passes nothing.
 */
export async function runSavedCardExpiryCheckJob(now?: Date): Promise<JobResult> {
  try {
    const result = await runSavedCardExpiryCheck(now);
    return {
      success: result.errors === 0,
      ...(result.errors > 0 ? { error: `${result.errors} user scan error(s) — see logs` } : {}),
      itemsProcessed: result.notified,
    };
  } catch (err: any) {
    logger.error({ err }, '[SavedCardExpiryCheck] Job error');
    return { success: false, error: err.message || 'Unknown error' };
  }
}

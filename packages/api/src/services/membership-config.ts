/**
 * @module MembershipConfig
 * @description CMS-driven configuration for membership operational settings.
 *
 * All business values are stored in the `settings` collection with `membership.*` prefix.
 * This service provides typed accessors with 60-second in-memory caching.
 *
 * Setting key convention: `membership.retention.*`
 *
 * @example
 * ```typescript
 * import { getMembershipRetentionNumber } from './membership-config';
 * const pct = await getMembershipRetentionNumber('discountPercent'); // 15
 * ```
 */

import { Setting } from '@pawtag/db';
import logger from '../lib/logger';

/** Cache entry with TTL */
interface CacheEntry {
  value: number;
  expiresAt: number;
}

/** Cache TTL in milliseconds (60 seconds) */
const CACHE_TTL_MS = 60_000;

/** In-memory settings cache */
const cache = new Map<string, CacheEntry>();

/**
 * All membership retention setting keys with their default values.
 */
export const MEMBERSHIP_RETENTION_DEFAULTS: Record<string, number> = {
  discountPercent: 15,
  maxDiscountAmount: 50,
  usageLimit: 1,
  perUserLimit: 1,
  expiryDays: 90,
};

export type MembershipRetentionSettingKey = keyof typeof MEMBERSHIP_RETENTION_DEFAULTS;

/**
 * Get a membership retention setting value by key.
 * Falls back to the default if the setting is not found in the database.
 */
export async function getMembershipRetentionNumber(key: MembershipRetentionSettingKey): Promise<number> {
  const cacheKey = `retention.${key}`;

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const setting = await Setting.findOne({ key: `membership.retention.${key}` }).lean();
    const raw = setting?.value;
    const parsed = raw !== undefined ? parseFloat(raw) : undefined;
    const value = parsed !== undefined && !isNaN(parsed) ? parsed : MEMBERSHIP_RETENTION_DEFAULTS[key];

    // Cache the value
    cache.set(cacheKey, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return value;
  } catch (err) {
    logger.warn({ err, key }, 'Failed to read membership retention setting, using default');
    return MEMBERSHIP_RETENTION_DEFAULTS[key];
  }
}

/**
 * Get all membership retention settings (for admin UI).
 */
export async function getAllMembershipRetentionSettings(): Promise<Record<MembershipRetentionSettingKey, number>> {
  const keys = Object.keys(MEMBERSHIP_RETENTION_DEFAULTS) as MembershipRetentionSettingKey[];
  const result = {} as Record<MembershipRetentionSettingKey, number>;
  for (const key of keys) {
    result[key] = await getMembershipRetentionNumber(key);
  }
  return result;
}

/**
 * Clear the membership retention settings cache.
 * Call after admin saves to ensure new values take effect immediately.
 */
export function clearMembershipConfigCache(): void {
  cache.clear();
  logger.info('[MembershipConfig] Cache cleared');
}

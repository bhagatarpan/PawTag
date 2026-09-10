/**
 * @module GuardianConfig
 * @description CMS-driven configuration for the Guardian loyalty program.
 *
 * All business values are stored in the `settings` collection with `guardian.*` prefix.
 * This service provides typed accessors with 60-second in-memory caching.
 *
 * Setting key convention: `guardian.property`
 *
 * @example
 * ```typescript
 * import { getGuardianNumber } from './guardian-config';
 * const rate = await getGuardianNumber('purchaseRateGuardian'); // 1
 * ```
 */

import { Setting } from '@pawtag/db';
import logger from '../../lib/logger';

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
 * All Guardian setting keys with their default values.
 * These match the seed data in `seed-cms.ts`.
 */
export const GUARDIAN_DEFAULTS: Record<string, number> = {
  // Points earning rates (purchaseRate points earned per purchaseSpentAmount dollars spent)
  purchaseRateGuardian: 1,
  purchaseRateGold: 2,
  purchaseSpentAmount: 1,
  purchaseSpentAmountGold: 1,
  repeatPurchaseBonusGuardian: 10,
  repeatPurchaseBonusGold: 20,

  // Review points
  reviewTextPoints: 5,
  reviewPhotoPoints: 15,
  reviewVideoPoints: 25,

  // Referral points
  referralSignupPoints: 20,
  referralPurchasePoints: 50,

  // Pet milestone points
  petProfilePoints: 15,
  petBirthdayPoints: 10,
  petAnniversaryPoints: 10,

  // Membership milestone points
  monthlyAnniversaryPoints: 5,
  annualAnniversaryPoints: 25,

  // Tag activation points
  tagActivationPoints: 10,

  // Social share points
  socialSharePoints: 3,

  // Gold multiplier
  goldMultiplier: 2,
  goldPrice: 1.99,

  // Annual caps
  annualCapReviewText: 30,
  annualCapReviewPhoto: 50,
  annualCapReviewVideo: 75,
  annualCapReferralSignup: 200,

  // Tier thresholds
  tierThresholdNurture: 100,
  tierThresholdProtector: 200,
  tierThresholdSafeguard: 300,

  // PawRewards allocation by tier
  pawRewardsCare: 2.00,
  pawRewardsNurture: 3.00,
  pawRewardsProtector: 5.00,
  pawRewardsSafeguard: 8.00,

  // PawRewards earning rate (NZD spent per $1 PawReward)
  pawRewardsEarningRateGuardian: 50,
  pawRewardsEarningRateGold: 25,

  // PawRewards rules
  pawRewardsMinRedemption: 2.00,
  pawRewardsExpirationMonths: 6,
  pawRewardsMaxBalanceGuardian: 20.00,
  pawRewardsMaxBalanceGold: 40.00,

  // Gold benefits & tier rules
  goldFreeShippingThreshold: 50,
  tierDowngradeGraceDays: 90,
  lifetimeSafeguardYears: 3,

  // Gold marketing content (CMS-driven strings, stored as empty defaults)
  'gold.heroHeadline': '' as unknown as number,
  'gold.heroSubtext': '' as unknown as number,
  'gold.benefits': '' as unknown as number,
  'gold.comparison': '' as unknown as number,
  'gold.emailUpsellText': '' as unknown as number,
  'gold.checkoutUpsellText': '' as unknown as number,
};

export type GuardianSettingKey = keyof typeof GUARDIAN_DEFAULTS;

/**
 * Get a Guardian setting value as a number from the database with caching.
 *
 * @param key - Setting key (e.g., 'purchaseRateGuardian')
 * @returns Setting value as number
 */
export async function getGuardianNumber(key: GuardianSettingKey): Promise<number> {
  // Check cache first
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const setting = await Setting.findOne({ key: `guardian.${key}` }).lean();
    const raw = setting?.value;
    const parsed = raw !== undefined ? parseFloat(raw) : undefined;
    const value = parsed !== undefined && !isNaN(parsed) ? parsed : GUARDIAN_DEFAULTS[key];

    // Cache the value
    cache.set(key, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return value;
  } catch (err) {
    logger.warn({ err, key }, 'Failed to read guardian setting, using default');
    return GUARDIAN_DEFAULTS[key];
  }
}

/**
 * Get all Guardian settings (for admin UI).
 *
 * @returns All Guardian settings with their current values
 */
export async function getAllGuardianSettings(): Promise<Record<GuardianSettingKey, number>> {
  const keys = Object.keys(GUARDIAN_DEFAULTS) as GuardianSettingKey[];
  const result = {} as Record<GuardianSettingKey, number>;
  for (const key of keys) {
    result[key] = await getGuardianNumber(key);
  }
  return result;
}

/** String cache entry with TTL */
interface StringCacheEntry {
  value: string;
  expiresAt: number;
}

/** In-memory string settings cache */
const stringCache = new Map<string, StringCacheEntry>();

/**
 * Get a Guardian setting value as a string from the database with caching.
 *
 * @param key - Setting key (e.g., 'gold.heroHeadline')
 * @returns Setting value as string
 */
export async function getGuardianString(key: string): Promise<string> {
  const cached = stringCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const setting = await Setting.findOne({ key: `guardian.${key}` }).lean();
    const value = setting?.value ?? '';

    stringCache.set(key, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return value;
  } catch (err) {
    logger.warn({ err, key }, 'Failed to read guardian string setting, using default');
    return '';
  }
}

/**
 * Get all Guardian string settings (for admin UI).
 */
export async function getAllGuardianStrings(): Promise<Record<string, string>> {
  const keys = [
    'gold.heroHeadline', 'gold.heroSubtext', 'gold.benefits',
    'gold.comparison', 'gold.emailUpsellText', 'gold.checkoutUpsellText',
  ];
  const result: Record<string, string> = {};
  for (const key of keys) {
    result[key] = await getGuardianString(key);
  }
  return result;
}

/**
 * Clear the Guardian settings cache (e.g., after admin saves).
 */
export function clearGuardianCache(): void {
  cache.clear();
  stringCache.clear();
}

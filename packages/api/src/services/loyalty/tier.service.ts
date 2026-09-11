/**
 * @module Tier Service
 * @description Guardian tier management service for the loyalty program.
 *
 * Handles tier progression based on Guardian Points:
 * - Care: 0-99 points
 * - Nurture: 100-199 points
 * - Protector: 200-299 points
 * - Safeguard: 300+ points
 *
 * Features:
 * - Annual re-qualification with 90-day grace period
 * - Lifetime status after 3 consecutive years at Safeguard
 * - Gradual downgrade protection with warning emails
 *
 * @example
 * ```typescript
 * import { calculateTier, updateTier } from '../loyalty/tier.service';
 * const tier = await calculateTier(userId);
 * ```
 */

import mongoose from 'mongoose';
import { User, Subscription, Setting, GuardianTierHistory } from '@pawtag/db';
import { sendTierUpgradeEmail } from '../email.service';
import { incrementCounter, METRICS } from '../../lib/metrics';
import logger from '../../lib/logger';
import { getGuardianNumber } from './guardian-config';

// Tier thresholds
export const TIER_THRESHOLDS = {
  CARE: { min: 0, max: 99 },
  NURTURE: { min: 100, max: 199 },
  PROTECTOR: { min: 200, max: 299 },
  SAFEGUARD: { min: 300, max: Infinity },
} as const;

// Tier benefits — populated at runtime from CMS settings
export const TIER_BENEFITS: Record<TierName, {
  name: string;
  displayName: string;
  pointsMultiplier: number;
  pawRewardsMonthly: number;
  freeShippingThreshold: number;
  earlyAccess: boolean;
  prioritySupport: boolean;
  exclusivePromotions: boolean;
  monthlyProgressEmail: boolean;
  guardianBadge: boolean;
  communityAccess: boolean;
  photoReviewBonus?: boolean;
  quarterlySurprise?: boolean;
  annualGift?: boolean;
  referralBonusBoost?: boolean;
}> = {
  CARE: {
    name: 'Care',
    displayName: 'Care Guardian',
    pointsMultiplier: 1,
    pawRewardsMonthly: 2.00,
    freeShippingThreshold: 100,
    earlyAccess: false,
    prioritySupport: false,
    exclusivePromotions: true,
    monthlyProgressEmail: true,
    guardianBadge: true,
    communityAccess: true,
  },
  NURTURE: {
    name: 'Nurture',
    displayName: 'Nurture Guardian',
    pointsMultiplier: 1,
    pawRewardsMonthly: 3.00,
    freeShippingThreshold: 75,
    earlyAccess: false,
    prioritySupport: false,
    exclusivePromotions: true,
    monthlyProgressEmail: true,
    guardianBadge: true,
    communityAccess: true,
    photoReviewBonus: true,
    quarterlySurprise: false,
  },
  PROTECTOR: {
    name: 'Protector',
    displayName: 'Protector Guardian',
    pointsMultiplier: 1,
    pawRewardsMonthly: 5.00,
    freeShippingThreshold: 50,
    earlyAccess: true,
    prioritySupport: true,
    exclusivePromotions: true,
    monthlyProgressEmail: true,
    guardianBadge: true,
    communityAccess: true,
    photoReviewBonus: true,
    quarterlySurprise: true,
    annualGift: false,
    referralBonusBoost: false,
  },
  SAFEGUARD: {
    name: 'Safeguard',
    displayName: 'Safeguard Guardian',
    pointsMultiplier: 1,
    pawRewardsMonthly: 8.00,
    freeShippingThreshold: 0,
    earlyAccess: true,
    prioritySupport: true,
    exclusivePromotions: true,
    monthlyProgressEmail: true,
    guardianBadge: true,
    communityAccess: true,
    photoReviewBonus: true,
    quarterlySurprise: true,
    annualGift: true,
    referralBonusBoost: true,
  },
} as const;

/**
 * Get tier benefits with CMS-overridden values (pawRewardsMonthly, freeShippingThreshold).
 * Returns a fresh object — does NOT mutate the static TIER_BENEFITS.
 */
async function getCmsTierBenefits(): Promise<Record<TierName, typeof TIER_BENEFITS[TierName]>> {
  const pawRewardsCare = await getGuardianNumber('pawRewardsCare');
  const pawRewardsNurture = await getGuardianNumber('pawRewardsNurture');
  const pawRewardsProtector = await getGuardianNumber('pawRewardsProtector');
  const pawRewardsSafeguard = await getGuardianNumber('pawRewardsSafeguard');

  return {
    ...TIER_BENEFITS,
    CARE: { ...TIER_BENEFITS.CARE, pawRewardsMonthly: pawRewardsCare },
    NURTURE: { ...TIER_BENEFITS.NURTURE, pawRewardsMonthly: pawRewardsNurture },
    PROTECTOR: { ...TIER_BENEFITS.PROTECTOR, pawRewardsMonthly: pawRewardsProtector },
    SAFEGUARD: { ...TIER_BENEFITS.SAFEGUARD, pawRewardsMonthly: pawRewardsSafeguard },
  };
}

export type TierName = keyof typeof TIER_THRESHOLDS;

export interface TierCalculationResult {
  tier: TierName;
  points: number;
  pointsToNextTier: number | null;
  nextTier: TierName | null;
  benefits: typeof TIER_BENEFITS[TierName];
  isLifetime: boolean;
  consecutiveYearsAtSafeguard: number;
}

/**
 * Get tier benefits with CMS-overridden values (async, DB-backed).
 */
export async function getTierBenefits(tier: TierName): Promise<typeof TIER_BENEFITS[TierName]> {
  const cms = await getCmsTierBenefits();
  return cms[tier];
}

/**
 * Calculate user's tier based on points
 */
export async function calculateTier(userId: string): Promise<TierCalculationResult> {
  const user = await User.findById(userId).select('guardianPoints').lean();
  if (!user) throw new Error('User not found');

  const points = user.guardianPoints || 0;

  // Read tier thresholds from CMS settings
  const nurtureMin = await getGuardianNumber('tierThresholdNurture');
  const protectorMin = await getGuardianNumber('tierThresholdProtector');
  const safeguardMin = await getGuardianNumber('tierThresholdSafeguard');

  // Determine tier based on points
  let tier: TierName = 'CARE';
  if (points >= safeguardMin) {
    tier = 'SAFEGUARD';
  } else if (points >= protectorMin) {
    tier = 'PROTECTOR';
  } else if (points >= nurtureMin) {
    tier = 'NURTURE';
  }

  // Calculate points to next tier
  let pointsToNextTier: number | null = null;
  let nextTier: TierName | null = null;

  if (tier === 'CARE') {
    pointsToNextTier = nurtureMin - points;
    nextTier = 'NURTURE';
  } else if (tier === 'NURTURE') {
    pointsToNextTier = protectorMin - points;
    nextTier = 'PROTECTOR';
  } else if (tier === 'PROTECTOR') {
    pointsToNextTier = safeguardMin - points;
    nextTier = 'SAFEGUARD';
  }

  // Check for lifetime status
  const lifetimeStatus = await checkLifetimeStatus(userId);
  const isLifetime = lifetimeStatus.isLifetime;
  const consecutiveYearsAtSafeguard = lifetimeStatus.consecutiveYears;

  // If lifetime Safeguard, override tier
  if (isLifetime) {
    tier = 'SAFEGUARD';
    pointsToNextTier = null;
    nextTier = null;
  }

  // Get CMS-overridden benefits
  const cmsBenefits = await getCmsTierBenefits();

  return {
    tier,
    points,
    pointsToNextTier,
    nextTier,
    benefits: cmsBenefits[tier],
    isLifetime,
    consecutiveYearsAtSafeguard,
  };
}

/**
 * Update user's tier based on current points
 */
export async function updateTier(userId: string): Promise<TierCalculationResult> {
  const currentTier = await calculateTier(userId);
  
  // Get current tier from user record
  const user = await User.findById(userId).select('guardianTier tierGracePeriodEndsAt').lean();
  const previousTier = (user?.guardianTier as TierName) || 'CARE';
  const now = new Date();

  // Tier upgrade — apply immediately
  if (getTierPriority(currentTier.tier) > getTierPriority(previousTier)) {
    await User.findByIdAndUpdate(userId, {
      guardianTier: currentTier.tier,
      tierGracePeriodEndsAt: null, // Clear any grace period
    });

    await recordTierChange(userId, previousTier, currentTier.tier, currentTier.points);
    await sendTierChangeEmail(userId, previousTier, currentTier.tier, currentTier.points);

    incrementCounter(METRICS.LOYALTY_TIER_UPGRADED_TOTAL, { from: previousTier, to: currentTier.tier });

    logger.info({
      userId,
      previousTier,
      newTier: currentTier.tier,
      points: currentTier.points,
    }, 'User tier upgraded');
  }

  // Tier downgrade — apply grace period
  if (getTierPriority(currentTier.tier) < getTierPriority(previousTier)) {
    const gracePeriodEndsAt = user?.tierGracePeriodEndsAt;

    if (!gracePeriodEndsAt) {
      // First downgrade detection — start CMS-configured grace period
      const graceDays = await getGuardianNumber('tierDowngradeGraceDays');
      const graceEnd = new Date(now);
      graceEnd.setDate(graceEnd.getDate() + graceDays);

      await User.findByIdAndUpdate(userId, {
        tierGracePeriodEndsAt: graceEnd,
      });

      await sendTierDowngradeWarningEmail(userId, previousTier, currentTier.tier, currentTier.points, graceDays);

      logger.info({
        userId,
        previousTier,
        newTier: currentTier.tier,
        gracePeriodEndsAt: graceEnd,
      }, 'User tier downgrade grace period started');
    } else if (now >= new Date(gracePeriodEndsAt)) {
      // Grace period expired — apply downgrade
      await User.findByIdAndUpdate(userId, {
        guardianTier: currentTier.tier,
        tierGracePeriodEndsAt: null,
      });

      await recordTierChange(userId, previousTier, currentTier.tier, currentTier.points);
      await sendTierChangeEmail(userId, previousTier, currentTier.tier, currentTier.points);

      logger.info({
        userId,
        previousTier,
        newTier: currentTier.tier,
      }, 'User tier downgraded after grace period');
    } else {
      // Still in grace period — send reminder if needed
      const daysRemaining = Math.ceil((new Date(gracePeriodEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 7) {
        await sendTierDowngradeWarningEmail(userId, previousTier, currentTier.tier, currentTier.points, daysRemaining);
      }
    }
  }

  return currentTier;
}

/**
 * Get tier priority for comparison (higher = better)
 */
function getTierPriority(tier: TierName): number {
  const priorities: Record<TierName, number> = {
    CARE: 0,
    NURTURE: 1,
    PROTECTOR: 2,
    SAFEGUARD: 3,
  };
  return priorities[tier] || 0;
}

/**
 * Send tier downgrade warning email
 */
async function sendTierDowngradeWarningEmail(
  userId: string,
  currentTier: TierName,
  newTier: TierName,
  points: number,
  daysRemaining: number,
): Promise<void> {
  const user = await User.findById(userId).select('email fullName').lean();
  if (!user?.email) return;

  const { sendMail } = await import('../email.service');
  const { renderTierDowngradeWarningEmail } = await import('../email/templates');

  // Read tier thresholds from CMS settings
  const pointsNeeded = await getGuardianNumber(
    currentTier === 'NURTURE' ? 'tierThresholdNurture'
    : currentTier === 'PROTECTOR' ? 'tierThresholdProtector'
    : 'tierThresholdSafeguard'
  );

  const html = renderTierDowngradeWarningEmail({
    customerName: user.fullName || 'Guardian',
    currentTier,
    newTier,
    points,
    pointsNeeded,
    daysRemaining,
    dashboardUrl: `${process.env.FRONTEND_URL || 'https://pawtag.co.nz'}/account/guardian`,
  });

  await sendMail(user.email, `Keep your ${currentTier} Guardian status — ${daysRemaining} days left`, html);
}

/**
 * Check if user has lifetime Safeguard status
 */
async function checkLifetimeStatus(userId: string): Promise<{
  isLifetime: boolean;
  consecutiveYears: number;
}> {
  const lifetimeYears = await getGuardianNumber('lifetimeSafeguardYears');
  const lookbackYears = lifetimeYears + 1; // need slightly more history than required years

  // Get tier history for the last N years
  const lookbackDate = new Date();
  lookbackDate.setFullYear(lookbackDate.getFullYear() - lookbackYears);

  const tierHistory = await GuardianTierHistory.find({
    userId,
    tier: 'SAFEGUARD',
    effectiveFrom: { $gte: lookbackDate },
  }).sort({ effectiveFrom: 1 }).lean();

  // Check for consecutive years
  let consecutiveYears = 0;
  for (let i = 0; i < lifetimeYears; i++) {
    const yearStart = new Date();
    yearStart.setFullYear(yearStart.getFullYear() - (lifetimeYears - 1 - i));
    yearStart.setMonth(0, 1);
    
    const yearEnd = new Date();
    yearEnd.setFullYear(yearEnd.getFullYear() - (lifetimeYears - 1 - i));
    yearEnd.setMonth(11, 31);

    const hasSafeguardThisYear = tierHistory.some(
      (record) =>
        record.effectiveFrom <= yearEnd &&
        (!record.effectiveTo || record.effectiveTo >= yearStart)
    );

    if (hasSafeguardThisYear) {
      consecutiveYears++;
    } else {
      break;
    }
  }

  return {
    isLifetime: consecutiveYears >= lifetimeYears,
    consecutiveYears,
  };
}

/**
 * Record tier change in history
 */
async function recordTierChange(
  userId: string,
  _previousTier: TierName,
  newTier: TierName,
  points: number
): Promise<void> {
  try {
    // Close previous tier record
    await GuardianTierHistory.updateMany(
      { userId, effectiveTo: null },
      { effectiveTo: new Date() }
    );

    // Create new tier record
    await GuardianTierHistory.create({
      userId: new mongoose.Types.ObjectId(userId),
      tier: newTier,
      points,
      effectiveFrom: new Date(),
      effectiveTo: null,
    });
  } catch (error) {
    logger.error({ err: error, userId }, 'Failed to record tier change');
  }
}

/**
 * Send tier change email
 */
async function sendTierChangeEmail(
  userId: string,
  previousTier: TierName,
  newTier: TierName,
  points: number
): Promise<void> {
  const user = await User.findById(userId).select('email fullName').lean();
  if (!user?.email) return;

  const tierBenefits = await getCmsTierBenefits();
  const benefits = [
    `Monthly PawRewards: $${tierBenefits[newTier].pawRewardsMonthly.toFixed(2)}`,
    `Free shipping on orders over $${tierBenefits[newTier].freeShippingThreshold}`,
    ...(tierBenefits[newTier].earlyAccess ? ['Early access to new products'] : []),
    ...(tierBenefits[newTier].prioritySupport ? ['Priority customer support'] : []),
    ...('annualGift' in tierBenefits[newTier] && tierBenefits[newTier].annualGift ? ['Annual surprise gift'] : []),
    ...('referralBonusBoost' in tierBenefits[newTier] && tierBenefits[newTier].referralBonusBoost ? ['Enhanced referral rewards'] : []),
  ];

  await sendTierUpgradeEmail(
    user.email,
    user.fullName || 'Guardian',
    previousTier,
    newTier,
    points,
    benefits,
  );
}

/**
 * Get all tiers with their thresholds and benefits
 */
export async function getAllTiers(): Promise<Array<{
  name: TierName;
  displayName: string;
  minPoints: number;
  maxPoints: number;
  benefits: typeof TIER_BENEFITS[TierName];
}>> {
  const nurtureMin = await getGuardianNumber('tierThresholdNurture');
  const protectorMin = await getGuardianNumber('tierThresholdProtector');
  const safeguardMin = await getGuardianNumber('tierThresholdSafeguard');
  const cmsBenefits = await getCmsTierBenefits();

  return [
    {
      name: 'CARE',
      displayName: 'Care Guardian',
      minPoints: 0,
      maxPoints: nurtureMin - 1,
      benefits: cmsBenefits.CARE,
    },
    {
      name: 'NURTURE',
      displayName: 'Nurture Guardian',
      minPoints: nurtureMin,
      maxPoints: protectorMin - 1,
      benefits: cmsBenefits.NURTURE,
    },
    {
      name: 'PROTECTOR',
      displayName: 'Protector Guardian',
      minPoints: protectorMin,
      maxPoints: safeguardMin - 1,
      benefits: cmsBenefits.PROTECTOR,
    },
    {
      name: 'SAFEGUARD',
      displayName: 'Safeguard Guardian',
      minPoints: safeguardMin,
      maxPoints: Infinity,
      benefits: cmsBenefits.SAFEGUARD,
    },
  ];
}

/**
 * Get tier by name
 */
export function getTierByName(tierName: TierName): typeof TIER_BENEFITS[TierName] {
  return TIER_BENEFITS[tierName];
}

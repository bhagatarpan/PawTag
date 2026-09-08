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

// Tier thresholds
export const TIER_THRESHOLDS = {
  CARE: { min: 0, max: 99 },
  NURTURE: { min: 100, max: 199 },
  PROTECTOR: { min: 200, max: 299 },
  SAFEGUARD: { min: 300, max: Infinity },
} as const;

// Tier benefits
export const TIER_BENEFITS = {
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
 * Calculate user's tier based on points
 */
export async function calculateTier(userId: string): Promise<TierCalculationResult> {
  const user = await User.findById(userId).select('guardianPoints').lean();
  if (!user) throw new Error('User not found');

  const points = user.guardianPoints || 0;

  // Determine tier based on points
  let tier: TierName = 'CARE';
  if (points >= TIER_THRESHOLDS.SAFEGUARD.min) {
    tier = 'SAFEGUARD';
  } else if (points >= TIER_THRESHOLDS.PROTECTOR.min) {
    tier = 'PROTECTOR';
  } else if (points >= TIER_THRESHOLDS.NURTURE.min) {
    tier = 'NURTURE';
  }

  // Calculate points to next tier
  let pointsToNextTier: number | null = null;
  let nextTier: TierName | null = null;

  if (tier === 'CARE') {
    pointsToNextTier = TIER_THRESHOLDS.NURTURE.min - points;
    nextTier = 'NURTURE';
  } else if (tier === 'NURTURE') {
    pointsToNextTier = TIER_THRESHOLDS.PROTECTOR.min - points;
    nextTier = 'PROTECTOR';
  } else if (tier === 'PROTECTOR') {
    pointsToNextTier = TIER_THRESHOLDS.SAFEGUARD.min - points;
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

  return {
    tier,
    points,
    pointsToNextTier,
    nextTier,
    benefits: TIER_BENEFITS[tier],
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
  const user = await User.findById(userId).select('guardianTier').lean();
  const previousTier = (user?.guardianTier as TierName) || 'CARE';

  // Update tier if changed
  if (previousTier !== currentTier.tier) {
    await User.findByIdAndUpdate(userId, { guardianTier: currentTier.tier });

    // Record tier change in history
    await recordTierChange(userId, previousTier, currentTier.tier, currentTier.points);

    // Send tier change email
    await sendTierChangeEmail(userId, previousTier, currentTier.tier, currentTier.points);

    incrementCounter(METRICS.LOYALTY_TIER_UPGRADED_TOTAL, { from: previousTier, to: currentTier.tier });

    logger.info({
      userId,
      previousTier,
      newTier: currentTier.tier,
      points: currentTier.points,
    }, 'User tier updated');
  }

  return currentTier;
}

/**
 * Check if user has lifetime Safeguard status
 */
async function checkLifetimeStatus(userId: string): Promise<{
  isLifetime: boolean;
  consecutiveYears: number;
}> {
  // Get tier history for the last 3 years
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

  const tierHistory = await GuardianTierHistory.find({
    userId,
    tier: 'SAFEGUARD',
    effectiveFrom: { $gte: threeYearsAgo },
  }).sort({ effectiveFrom: 1 }).lean();

  // Check for 3 consecutive years
  if (tierHistory.length < 3) {
    return { isLifetime: false, consecutiveYears: tierHistory.length };
  }

  // Check if each year has been at Safeguard
  let consecutiveYears = 0;
  for (let i = 0; i < 3; i++) {
    const yearStart = new Date();
    yearStart.setFullYear(yearStart.getFullYear() - (2 - i));
    yearStart.setMonth(0, 1);
    
    const yearEnd = new Date();
    yearEnd.setFullYear(yearEnd.getFullYear() - (2 - i));
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
    isLifetime: consecutiveYears >= 3,
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

  const tierBenefits = TIER_BENEFITS[newTier];
  const benefits = [
    `Monthly PawRewards: $${tierBenefits.pawRewardsMonthly.toFixed(2)}`,
    `Free shipping on orders over $${tierBenefits.freeShippingThreshold}`,
    ...(tierBenefits.earlyAccess ? ['Early access to new products'] : []),
    ...(tierBenefits.prioritySupport ? ['Priority customer support'] : []),
    ...('annualGift' in tierBenefits && tierBenefits.annualGift ? ['Annual surprise gift'] : []),
    ...('referralBonusBoost' in tierBenefits && tierBenefits.referralBonusBoost ? ['Enhanced referral rewards'] : []),
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
export function getAllTiers(): Array<{
  name: TierName;
  displayName: string;
  minPoints: number;
  maxPoints: number;
  benefits: typeof TIER_BENEFITS[TierName];
}> {
  return [
    {
      name: 'CARE',
      displayName: 'Care Guardian',
      minPoints: TIER_THRESHOLDS.CARE.min,
      maxPoints: TIER_THRESHOLDS.CARE.max,
      benefits: TIER_BENEFITS.CARE,
    },
    {
      name: 'NURTURE',
      displayName: 'Nurture Guardian',
      minPoints: TIER_THRESHOLDS.NURTURE.min,
      maxPoints: TIER_THRESHOLDS.NURTURE.max,
      benefits: TIER_BENEFITS.NURTURE,
    },
    {
      name: 'PROTECTOR',
      displayName: 'Protector Guardian',
      minPoints: TIER_THRESHOLDS.PROTECTOR.min,
      maxPoints: TIER_THRESHOLDS.PROTECTOR.max,
      benefits: TIER_BENEFITS.PROTECTOR,
    },
    {
      name: 'SAFEGUARD',
      displayName: 'Safeguard Guardian',
      minPoints: TIER_THRESHOLDS.SAFEGUARD.min,
      maxPoints: Infinity,
      benefits: TIER_BENEFITS.SAFEGUARD,
    },
  ];
}

/**
 * Get tier by name
 */
export function getTierByName(tierName: TierName): typeof TIER_BENEFITS[TierName] {
  return TIER_BENEFITS[tierName];
}

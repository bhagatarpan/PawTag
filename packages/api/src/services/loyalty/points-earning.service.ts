/**
 * @module Points Earning Service
 * @description Guardian Points earning engine for the loyalty program.
 *
 * Handles points earning for all activities:
 * - Purchases (configurable rate per $1 spent, Guardian vs Gold)
 * - Repeat purchase bonuses (configurable, on 3rd+ order)
 * - Product reviews (text, photo, video — configurable)
 * - Referrals (signup, purchase — configurable)
 * - Pet milestones (profile: 15 pts, birthday: 10 pts, anniversary: 10 pts)
 * - Membership milestones (monthly: 5 pts, annual: 25 pts)
 * - Tag activation (configurable, per new tag — not replacement tags)
 * - Social shares (3 pts)
 *
 * Gold members earn 2× points on all activities.
 *
 * @example
 * ```typescript
 * import { awardPurchasePoints } from '../loyalty/points-earning.service';
 * await awardPurchasePoints(userId, 100, orderId);
 * ```
 */

import mongoose from 'mongoose';
import { User, Subscription, Order, Setting, GuardianPointsLedger } from '@pawtag/db';
import { incrementCounter, METRICS } from '../../lib/metrics';
import logger from '../../lib/logger';
import { getGuardianNumber, type GuardianSettingKey } from './guardian-config';
import { membershipEntitlementService } from '../membership-entitlement.service';

/**
 * Get the Gold membership price from CMS settings.
 * Cached in-memory for 60 seconds to avoid repeated DB hits.
 */
let _goldPriceCache: { price: number; expiresAt: number } | null = null;
export async function getGoldPrice(): Promise<number> {
  const now = Date.now();
  if (_goldPriceCache && _goldPriceCache.expiresAt > now) {
    return _goldPriceCache.price;
  }
  const setting = await Setting.findOne({ key: 'guardian.goldPrice' }).lean();
  const price = parseFloat(setting?.value || '3.99');
  _goldPriceCache = { price, expiresAt: now + 60_000 };
  return price;
}

/**
 * @deprecated Use membershipEntitlementService.getValue(userId, 'points_multiplier') instead.
 * Kept for backward compatibility during migration.
 */
export async function isGoldSubscription(userId: string): Promise<boolean> {
  const multiplier = await membershipEntitlementService.getValue<number>(userId, 'points_multiplier');
  return (multiplier ?? 1) > 1;
}

/**
 * Get the points multiplier for a user from the entitlement registry.
 * Gold=1, Platinum=2, Black=3 (configurable via admin).
 */
async function getPointsMultiplier(userId: string): Promise<number> {
  const multiplier = await membershipEntitlementService.getValue<number>(userId, 'points_multiplier');
  return multiplier ?? 1;
}

/**
 * Get the purchase rate and spent amount for a user.
 * Uses entitlement-based multiplier applied to base Guardian rates.
 */
async function getPurchaseConfig(userId: string): Promise<{ rate: number; spentAmount: number; repeatBonus: number }> {
  const multiplier = await getPointsMultiplier(userId);
  const baseRate = await getGuardianNumber('purchaseRateGuardian');
  const baseSpentAmount = await getGuardianNumber('purchaseSpentAmount');
  const baseRepeatBonus = await getGuardianNumber('repeatPurchaseBonusGuardian');
  return {
    rate: Math.floor(baseRate * multiplier),
    spentAmount: baseSpentAmount,
    repeatBonus: Math.floor(baseRepeatBonus * multiplier),
  };
}

// Points earning activities — base rates from CMS settings
// All multiplier logic is now in the entitlement registry.
export const POINTS_CONFIG = {
  // Review points (base, before multiplier)
  REVIEW_TEXT: 5,
  REVIEW_PHOTO: 15,
  REVIEW_VIDEO: 25,
  // Referral points
  REFERRAL_SIGNUP: 20,
  REFERRAL_PURCHASE: 50,
  // Pet milestone points
  PET_PROFILE_COMPLETE: 15,
  PET_BIRTHDAY: 10,
  PET_ADOPTION_ANNIVERSARY: 10,
  // Membership milestone points
  MONTHLY_ANNIVERSARY: 5,
  ANNUAL_ANNIVERSARY: 25,
  // Social share points
  SOCIAL_SHARE: 3,
  // Annual caps (per activity type)
  ANNUAL_CAPS: {
    REVIEW_TEXT: 30,
    REVIEW_PHOTO: 50,
    REVIEW_VIDEO: 75,
    REFERRAL_SIGNUP: 200,
  },
};

export interface PointsEarningResult {
  pointsAwarded: number;
  totalPoints: number;
  activity: string;
  isGoldMember: boolean;
}

/**
 * Award points for a purchase
 */
export async function awardPurchasePoints(
  userId: string,
  orderTotal: number,
  orderId: string
): Promise<PointsEarningResult> {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const multiplier = await getPointsMultiplier(userId);

  // Calculate base points from CMS settings, apply membership multiplier
  const baseRate = await getGuardianNumber('purchaseRateGuardian');
  const spentAmount = await getGuardianNumber('purchaseSpentAmount');
  let points = Math.floor((orderTotal / spentAmount) * baseRate * multiplier);

  // Check for repeat purchase bonus (3rd+ order)
  const orderCount = await Order.countDocuments({ userId, status: { $in: ['paid', 'delivered'] } });
  if (orderCount >= 3) {
    const baseRepeatBonus = await getGuardianNumber('repeatPurchaseBonusGuardian');
    points += Math.floor(baseRepeatBonus * multiplier);
  }

  // Record in ledger (pass multiplier for base/bonus split in metadata)
  await recordPointsEarned(userId, points, 'purchase', orderId, { orderTotal, orderCount }, multiplier);

  // Update user's total points
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { guardianPoints: points } },
    { new: true }
  ).lean();

  return {
    pointsAwarded: points,
    totalPoints: updatedUser?.guardianPoints || 0,
    activity: 'purchase',
    isGoldMember: multiplier > 1,
  };
}

/**
 * Award points for a product review
 */
export async function awardReviewPoints(
  userId: string,
  reviewType: 'text' | 'photo' | 'video',
  productId: string
): Promise<PointsEarningResult> {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const multiplier = await getPointsMultiplier(userId);

  // Get base points for review type from CMS settings, apply membership multiplier
  const reviewKey = `review${reviewType.charAt(0).toUpperCase() + reviewType.slice(1)}Points` as GuardianSettingKey;
  const basePoints = await getGuardianNumber(reviewKey);
  const points = basePoints * multiplier;

  // Check annual cap
  const capKey = `annualCapReview${reviewType.charAt(0).toUpperCase() + reviewType.slice(1)}` as GuardianSettingKey;
  const annualCap = await getGuardianNumber(capKey);
  if (annualCap) {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const pointsThisYear = await getPointsEarnedForActivity(userId, `review_${reviewType}`, startOfYear);
    
    if (pointsThisYear >= annualCap) {
      logger.info({ userId, reviewType, pointsThisYear, annualCap }, 'Annual cap reached for review activity');
      return {
        pointsAwarded: 0,
        totalPoints: user.guardianPoints || 0,
        activity: 'review',
        isGoldMember: multiplier > 1,
      };
    }
  }

  // Record in ledger (pass multiplier for base/bonus split)
  await recordPointsEarned(userId, points, `review_${reviewType}`, productId, { reviewType }, multiplier);

  // Update user's total points
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { guardianPoints: points } },
    { new: true }
  ).lean();

  return {
    pointsAwarded: points,
    totalPoints: updatedUser?.guardianPoints || 0,
    activity: `review_${reviewType}`,
    isGoldMember: multiplier > 1,
  };
}

/**
 * Award points for a referral
 */
export async function awardReferralPoints(
  userId: string,
  referralType: 'signup' | 'purchase',
  referredUserId: string
): Promise<PointsEarningResult> {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const multiplier = await getPointsMultiplier(userId);

  // Get base points for referral type from CMS settings, apply membership multiplier
  const referralKey = `referral${referralType.charAt(0).toUpperCase() + referralType.slice(1)}Points` as GuardianSettingKey;
  const basePoints = await getGuardianNumber(referralKey);
  const points = basePoints * multiplier;

  // Check annual cap for signup referrals
  if (referralType === 'signup') {
    const annualCap = await getGuardianNumber('annualCapReferralSignup');
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const pointsThisYear = await getPointsEarnedForActivity(userId, 'REFERRAL_SIGNUP', startOfYear);
    
    if (pointsThisYear >= annualCap) {
      logger.info({ userId, pointsThisYear, annualCap }, 'Annual cap reached for referral signup');
      return {
        pointsAwarded: 0,
        totalPoints: user.guardianPoints || 0,
        activity: 'referral',
        isGoldMember: multiplier > 1,
      };
    }
  }

  // Record in ledger
  await recordPointsEarned(userId, points, `referral_${referralType}`, referredUserId, { referralType }, multiplier);

  // Update user's total points
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { guardianPoints: points } },
    { new: true }
  ).lean();

  return {
    pointsAwarded: points,
    totalPoints: updatedUser?.guardianPoints || 0,
    activity: `referral_${referralType}`,
    isGoldMember: multiplier > 1,
  };
}

/**
 * Award points for pet milestones
 */
export async function awardPetMilestonePoints(
  userId: string,
  milestoneType: 'profile_complete' | 'birthday' | 'adoption_anniversary',
  petId: string
): Promise<PointsEarningResult> {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const multiplier = await getPointsMultiplier(userId);

  // Get base points for milestone type from CMS settings, apply membership multiplier
  const MILESTONE_KEYS: Record<string, GuardianSettingKey> = {
    profile_complete: 'petProfilePoints',
    birthday: 'petBirthdayPoints',
    adoption_anniversary: 'petAnniversaryPoints',
  };
  const milestoneKey = MILESTONE_KEYS[milestoneType];
  const basePoints = await getGuardianNumber(milestoneKey);
  const points = basePoints * multiplier;

  // Record in ledger (pass multiplier for base/bonus split)
  await recordPointsEarned(userId, points, `pet_${milestoneType}`, petId, { milestoneType }, multiplier);

  // Update user's total points
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { guardianPoints: points } },
    { new: true }
  ).lean();

  return {
    pointsAwarded: points,
    totalPoints: updatedUser?.guardianPoints || 0,
    activity: `pet_${milestoneType}`,
    isGoldMember: multiplier > 1,
  };
}

/**
 * Award points for tag activation (new tags only, NOT replacement tags)
 */
export async function awardTagActivationPoints(
  userId: string,
  tagId: string
): Promise<PointsEarningResult> {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const multiplier = await getPointsMultiplier(userId);
  const basePoints = await getGuardianNumber('tagActivationPoints');
  const points = basePoints * multiplier;

  await recordPointsEarned(userId, points, 'tag_activation', tagId, {}, multiplier);

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { guardianPoints: points } },
    { new: true }
  ).lean();

  return {
    pointsAwarded: points,
    totalPoints: updatedUser?.guardianPoints || 0,
    activity: 'tag_activation',
    isGoldMember: multiplier > 1,
  };
}

/**
 * Award points for social share
 */
export async function awardSocialSharePoints(
  userId: string,
  platform: string
): Promise<PointsEarningResult> {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const multiplier = await getPointsMultiplier(userId);
  const basePoints = await getGuardianNumber('socialSharePoints');
  const points = basePoints * multiplier;

  // Record in ledger (pass multiplier for base/bonus split)
  await recordPointsEarned(userId, points, 'social_share', platform, { platform }, multiplier);

  // Update user's total points
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { guardianPoints: points } },
    { new: true }
  ).lean();

  return {
    pointsAwarded: points,
    totalPoints: updatedUser?.guardianPoints || 0,
    activity: 'social_share',
    isGoldMember: multiplier > 1,
  };
}

/**
 * Award membership milestone points
 */
export async function awardMembershipMilestonePoints(
  userId: string,
  milestoneType: 'monthly' | 'annual'
): Promise<PointsEarningResult> {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const multiplier = await getPointsMultiplier(userId);
  const basePoints = await getGuardianNumber(`${milestoneType}AnniversaryPoints` as GuardianSettingKey);
  const points = basePoints * multiplier;

  // Record in ledger (pass multiplier for base/bonus split)
  await recordPointsEarned(userId, points, `membership_${milestoneType}`, userId, { milestoneType }, multiplier);

  // Update user's total points
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { guardianPoints: points } },
    { new: true }
  ).lean();

  return {
    pointsAwarded: points,
    totalPoints: updatedUser?.guardianPoints || 0,
    activity: `membership_${milestoneType}`,
    isGoldMember: multiplier > 1,
  };
}

/**
 * Record points earned in ledger.
 *
 * When `multiplier` is provided, the metadata includes basePoints/multiplier/bonusPoints
 * so the downgrade clawback can precisely compute how many points were earned
 * at the higher multiplier rate.
 */
async function recordPointsEarned(
  userId: string,
  points: number,
  activity: string,
  referenceId: string,
  metadata: Record<string, any>,
  multiplier?: number
): Promise<void> {
  try {
    const enrichedMetadata: Record<string, any> = { ...metadata };
    if (multiplier !== undefined && multiplier > 0) {
      // Derive base points from composite total and multiplier
      // basePoints = floor(points / multiplier) — best effort due to Math.floor rounding
      const basePoints = Math.floor(points / multiplier);
      const bonusPoints = points - basePoints;
      enrichedMetadata.basePoints = basePoints;
      enrichedMetadata.multiplier = multiplier;
      enrichedMetadata.bonusPoints = bonusPoints;
    }

    await GuardianPointsLedger.create({
      userId: new mongoose.Types.ObjectId(userId),
      points,
      activity,
      referenceId,
      metadata: enrichedMetadata,
      createdAt: new Date(),
    });

    incrementCounter(METRICS.LOYALTY_POINTS_EARNED_TOTAL, { activity }, points);
  } catch (error) {
    logger.error({ err: error, userId, activity }, 'Failed to record points in ledger');
  }
}

/**
 * Get points earned for a specific activity since a given date
 */
async function getPointsEarnedForActivity(
  userId: string,
  activity: string,
  since: Date
): Promise<number> {
  try {
    const result = await GuardianPointsLedger.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          activity,
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: null,
          totalPoints: { $sum: '$points' },
        },
      },
    ]);

    return result[0]?.totalPoints || 0;
  } catch (error) {
    logger.error({ err: error, userId, activity }, 'Failed to get points earned for activity');
    return 0;
  }
}

/**
 * Deduct points from a user (e.g., on refund).
 * Creates a negative ledger entry and decrements user balance.
 */
export async function deductPoints(
  userId: string,
  points: number,
  activity: string,
  referenceId: string,
  reason: string,
): Promise<{ pointsDeducted: number; newBalance: number }> {
  if (points <= 0) throw new Error('Points to deduct must be positive');

  // Check current balance — don't go negative
  const user = await User.findById(userId).select('guardianPoints').lean();
  const currentBalance = user?.guardianPoints || 0;
  const pointsToDeduct = Math.min(points, currentBalance);

  if (pointsToDeduct <= 0) {
    return { pointsDeducted: 0, newBalance: 0 };
  }

  // Create negative ledger entry (audit trail)
  await GuardianPointsLedger.create({
    userId: new (await import('mongoose')).default.Types.ObjectId(userId),
    points: -pointsToDeduct,
    activity,
    referenceId,
    metadata: { reason, originalPoints: points },
  });

  // Decrement user balance (atomic, minimum 0)
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { guardianPoints: -pointsToDeduct } },
    { new: true },
  ).lean();

  const newBalance = Math.max(0, updatedUser?.guardianPoints || 0);

  logger.info({ userId, pointsDeducted: pointsToDeduct, originalPoints: points, newBalance, reason }, 'Guardian Points deducted');

  return { pointsDeducted: pointsToDeduct, newBalance };
}

/**
 * Get user's points balance
 */
export async function getPointsBalance(userId: string): Promise<number> {
  const user = await User.findById(userId).select('guardianPoints').lean();
  return user?.guardianPoints || 0;
}

/**
 * Get user's points history
 */
export async function getPointsHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<any[]> {
  return GuardianPointsLedger.find({ userId })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();
}

/**
 * Apply Guardian Points clawback when a membership is downgraded.
 *
 * Business rule: When a customer downgrades (e.g. Black 3× → Gold 1×),
 * they lose the multiplier bonus on points earned at the higher tier rate.
 * They keep the base points they earned.
 *
 * Formula:
 *   points_at_higher_tier = SUM(ledger.points WHERE multiplier > newMultiplier)
 *   clawback = floor(points_at_higher_tier × (1 - newMultiplier / oldMultiplier))
 *   final_balance = current_balance - clawback
 *
 * For historical ledger entries without basePoints/multiplier metadata,
 * we use the tier multiplier at the time of earning (best-effort derivation).
 *
 * This function is idempotent — it checks for existing clawback entries
 * with the same referenceId before deducting.
 */
export async function applyDowngradePointsClawback(
  userId: string,
  oldMultiplier: number,
  newMultiplier: number,
  membershipId: string
): Promise<{ clawbackAmount: number; oldBalance: number; newBalance: number }> {
  if (oldMultiplier <= newMultiplier) {
    // No clawback needed (not actually losing multiplier benefits)
    const user = await User.findById(userId).select('guardianPoints').lean();
    return { clawbackAmount: 0, oldBalance: user?.guardianPoints || 0, newBalance: user?.guardianPoints || 0 };
  }

  // Idempotency: check if clawback already applied for this membership
  const existingClawback = await GuardianPointsLedger.findOne({
    userId,
    activity: 'membership_downgrade_clawback',
    referenceId: membershipId,
  });

  if (existingClawback) {
    logger.info({ userId, membershipId }, 'Points clawback already applied — skipping');
    const user = await User.findById(userId).select('guardianPoints').lean();
    return {
      clawbackAmount: Math.abs(existingClawback.points),
      oldBalance: (user?.guardianPoints || 0) + Math.abs(existingClawback.points),
      newBalance: user?.guardianPoints || 0,
    };
  }

  const user = await User.findById(userId).select('guardianPoints').lean();
  const currentBalance = user?.guardianPoints || 0;

  if (currentBalance <= 0) {
    return { clawbackAmount: 0, oldBalance: 0, newBalance: 0 };
  }

  // Compute points earned at higher multiplier rate
  // Use metadata.multiplier when available; otherwise estimate using tier ratio
  const multiplierThreshold = newMultiplier;
  const ledgerEntries = await GuardianPointsLedger.find({
    userId,
    points: { $gt: 0 }, // only positive entries (earnings)
  }).lean();

  let pointsAtHigherTier = 0;
  for (const entry of ledgerEntries) {
    const entryMultiplier = (entry.metadata as any)?.multiplier;
    if (entryMultiplier !== undefined && entryMultiplier > multiplierThreshold) {
      // Exact: use stored multiplier
      pointsAtHigherTier += entry.points;
    } else if (entryMultiplier === undefined) {
      // Historical entry without multiplier — estimate using ratio
      // Assume this point was earned at the higher tier's multiplier
      // This is a best-effort approximation
      pointsAtHigherTier += entry.points;
    }
    // If entryMultiplier <= threshold, points were earned at or below new tier — keep them
  }

  // Apply clawback formula
  const ratio = 1 - (newMultiplier / oldMultiplier);
  const clawbackAmount = Math.min(
    Math.floor(pointsAtHigherTier * ratio),
    currentBalance // never go below 0
  );

  if (clawbackAmount <= 0) {
    return { clawbackAmount: 0, oldBalance: currentBalance, newBalance: currentBalance };
  }

  // Create negative ledger entry (audit trail)
  await GuardianPointsLedger.create({
    userId: new (await import('mongoose')).default.Types.ObjectId(userId),
    points: -clawbackAmount,
    activity: 'membership_downgrade_clawback',
    referenceId: membershipId,
    metadata: {
      reason: 'membership_downgrade_clawback',
      originalPoints: currentBalance,
      oldMultiplier,
      newMultiplier,
      pointsAtHigherTier,
    },
    createdAt: new Date(),
  });

  // Decrement user balance (atomic)
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { guardianPoints: -clawbackAmount } },
    { new: true },
  ).lean();

  const newBalance = Math.max(0, updatedUser?.guardianPoints || 0);

  logger.info({
    userId,
    membershipId,
    clawbackAmount,
    oldBalance: currentBalance,
    newBalance,
    oldMultiplier,
    newMultiplier,
    pointsAtHigherTier,
  }, 'Guardian Points downgrade clawback applied');

  return { clawbackAmount, oldBalance: currentBalance, newBalance };
}

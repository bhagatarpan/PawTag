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

  // Record in ledger
  await recordPointsEarned(userId, points, 'purchase', orderId, { orderTotal, orderCount });

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

  // Record in ledger
  await recordPointsEarned(userId, points, `review_${reviewType}`, productId, { reviewType });

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
  await recordPointsEarned(userId, points, `referral_${referralType}`, referredUserId, { referralType });

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

  // Record in ledger
  await recordPointsEarned(userId, points, `pet_${milestoneType}`, petId, { milestoneType });

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

  await recordPointsEarned(userId, points, 'tag_activation', tagId, {});

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

  // Record in ledger
  await recordPointsEarned(userId, points, 'social_share', platform, { platform });

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

  // Record in ledger
  await recordPointsEarned(userId, points, `membership_${milestoneType}`, userId, { milestoneType });

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
 * Record points earned in ledger
 */
async function recordPointsEarned(
  userId: string,
  points: number,
  activity: string,
  referenceId: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    await GuardianPointsLedger.create({
      userId: new mongoose.Types.ObjectId(userId),
      points,
      activity,
      referenceId,
      metadata,
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

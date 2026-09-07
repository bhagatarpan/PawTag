/**
 * @module Points Earning Service
 * @description Guardian Points earning engine for the loyalty program.
 *
 * Handles points earning for all activities:
 * - Purchases (1 pt per $1 Guardian, 2 pts per $1 Gold)
 * - Repeat purchase bonuses (+10 pts on 3rd+ order, +20 for Gold)
 * - Product reviews (text: 5 pts, photo: 15 pts, video: 25 pts)
 * - Referrals (signup: 20 pts, purchase: 50 pts)
 * - Pet milestones (profile: 15 pts, birthday: 10 pts, anniversary: 10 pts)
 * - Membership milestones (monthly: 5 pts, annual: 25 pts)
 * - Tag scans (2 pts, max 3/day)
 * - Lost pet reports (5 pts)
 * - Pet reunited (20 pts)
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
import logger from '../../lib/logger';

// Points earning activities with base rates
export const POINTS_CONFIG = {
  // Purchase points
  PURCHASE_RATE: 1, // 1 pt per $1 spent (Guardian)
  PURCHASE_RATE_GOLD: 2, // 2 pts per $1 (Gold)
  
  // Repeat purchase bonus
  REPEAT_PURCHASE_BONUS: 10, // +10 pts on 3rd+ order
  REPEAT_PURCHASE_BONUS_GOLD: 20, // +20 for Gold
  
  // Review points
  REVIEW_TEXT: 5, // 5 pts for text review
  REVIEW_PHOTO: 15, // 15 pts for photo review
  REVIEW_VIDEO: 25, // 25 pts for video review
  
  // Referral points
  REFERRAL_SIGNUP: 20, // 20 pts for referral signup
  REFERRAL_PURCHASE: 50, // 50 pts for referral purchase
  
  // Pet milestone points
  PET_PROFILE_COMPLETE: 15, // 15 pts for completing pet profile
  PET_BIRTHDAY: 10, // 10 pts on pet birthday
  PET_ADOPTION_ANNIVERSARY: 10, // 10 pts on adoption anniversary
  
  // Membership milestone points
  MONTHLY_ANNIVERSARY: 5, // 5 pts per month of membership
  ANNUAL_ANNIVERSARY: 25, // 25 pts per year of membership
  
  // Tag scan points
  TAG_SCAN: 2, // 2 pts per scan (max 3/day)
  TAG_SCAN_DAILY_LIMIT: 3, // Max 3 scans per day
  
  // Lost pet report points
  LOST_PET_REPORT: 5, // 5 pts for filing lost pet report
  PET_REUNITED: 20, // 20 pts when pet is reunited
  
  // Social share points
  SOCIAL_SHARE: 3, // 3 pts for sharing on social media
  
  // Gold multiplier
  GOLD_MULTIPLIER: 2, // Gold members earn 2× points
  
  // Annual caps (per activity type)
  ANNUAL_CAPS: {
    REVIEW_TEXT: 30,
    REVIEW_PHOTO: 50,
    REVIEW_VIDEO: 75,
    REFERRAL_SIGNUP: 200,
    TAG_SCAN: 100,
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

  const subscription = await Subscription.findOne({ userId, status: 'active' }).lean();
  const isGoldMember = subscription?.planType === 'monthly' && subscription?.price === 1.99;

  // Calculate base points
  const rate = isGoldMember ? POINTS_CONFIG.PURCHASE_RATE_GOLD : POINTS_CONFIG.PURCHASE_RATE;
  let points = Math.floor(orderTotal * rate);

  // Check for repeat purchase bonus (3rd+ order)
  const orderCount = await Order.countDocuments({ userId, status: { $in: ['paid', 'delivered'] } });
  if (orderCount >= 3) {
    const bonus = isGoldMember ? POINTS_CONFIG.REPEAT_PURCHASE_BONUS_GOLD : POINTS_CONFIG.REPEAT_PURCHASE_BONUS;
    points += bonus;
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
    isGoldMember,
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

  const subscription = await Subscription.findOne({ userId, status: 'active' }).lean();
  const isGoldMember = subscription?.planType === 'monthly' && subscription?.price === 1.99;

  // Get base points for review type
  const basePoints = POINTS_CONFIG[`REVIEW_${reviewType.toUpperCase()}` as keyof typeof POINTS_CONFIG] as number;
  const points = isGoldMember ? basePoints * POINTS_CONFIG.GOLD_MULTIPLIER : basePoints;

  // Check annual cap
  const activityKey = `REVIEW_${reviewType.toUpperCase()}`;
  const annualCap = POINTS_CONFIG.ANNUAL_CAPS[activityKey as keyof typeof POINTS_CONFIG.ANNUAL_CAPS];
  if (annualCap) {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const pointsThisYear = await getPointsEarnedForActivity(userId, activityKey, startOfYear);
    
    if (pointsThisYear >= annualCap) {
      logger.info({ userId, activityKey, pointsThisYear, annualCap }, 'Annual cap reached for review activity');
      return {
        pointsAwarded: 0,
        totalPoints: user.guardianPoints || 0,
        activity: 'review',
        isGoldMember,
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
    isGoldMember,
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

  const subscription = await Subscription.findOne({ userId, status: 'active' }).lean();
  const isGoldMember = subscription?.planType === 'monthly' && subscription?.price === 1.99;

  // Get base points for referral type
  const basePoints = POINTS_CONFIG[`REFERRAL_${referralType.toUpperCase()}` as keyof typeof POINTS_CONFIG] as number;
  const points = isGoldMember ? basePoints * POINTS_CONFIG.GOLD_MULTIPLIER : basePoints;

  // Check annual cap for signup referrals
  if (referralType === 'signup') {
    const annualCap = POINTS_CONFIG.ANNUAL_CAPS.REFERRAL_SIGNUP;
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const pointsThisYear = await getPointsEarnedForActivity(userId, 'REFERRAL_SIGNUP', startOfYear);
    
    if (pointsThisYear >= annualCap) {
      logger.info({ userId, pointsThisYear, annualCap }, 'Annual cap reached for referral signup');
      return {
        pointsAwarded: 0,
        totalPoints: user.guardianPoints || 0,
        activity: 'referral',
        isGoldMember,
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
    isGoldMember,
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

  const subscription = await Subscription.findOne({ userId, status: 'active' }).lean();
  const isGoldMember = subscription?.planType === 'monthly' && subscription?.price === 1.99;

  // Get base points for milestone type
  const basePoints = POINTS_CONFIG[`PET_${milestoneType.toUpperCase()}` as keyof typeof POINTS_CONFIG] as number;
  const points = isGoldMember ? basePoints * POINTS_CONFIG.GOLD_MULTIPLIER : basePoints;

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
    isGoldMember,
  };
}

/**
 * Award points for tag scans
 */
export async function awardTagScanPoints(
  userId: string,
  tagId: string
): Promise<PointsEarningResult> {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const subscription = await Subscription.findOne({ userId, status: 'active' }).lean();
  const isGoldMember = subscription?.planType === 'monthly' && subscription?.price === 1.99;

  // Check daily limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const scansToday = await getPointsEarnedForActivity(userId, 'TAG_SCAN', today);
  
  if (scansToday >= POINTS_CONFIG.TAG_SCAN_DAILY_LIMIT) {
    logger.info({ userId, tagId, scansToday }, 'Daily tag scan limit reached');
    return {
      pointsAwarded: 0,
      totalPoints: user.guardianPoints || 0,
      activity: 'tag_scan',
      isGoldMember,
    };
  }

  // Calculate points
  const basePoints = POINTS_CONFIG.TAG_SCAN;
  const points = isGoldMember ? basePoints * POINTS_CONFIG.GOLD_MULTIPLIER : basePoints;

  // Check annual cap
  const annualCap = POINTS_CONFIG.ANNUAL_CAPS.TAG_SCAN;
  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const pointsThisYear = await getPointsEarnedForActivity(userId, 'TAG_SCAN', startOfYear);
  
  if (pointsThisYear >= annualCap) {
    logger.info({ userId, pointsThisYear, annualCap }, 'Annual cap reached for tag scans');
    return {
      pointsAwarded: 0,
      totalPoints: user.guardianPoints || 0,
      activity: 'tag_scan',
      isGoldMember,
    };
  }

  // Record in ledger
  await recordPointsEarned(userId, points, 'tag_scan', tagId, { scansToday: scansToday + 1 });

  // Update user's total points
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { guardianPoints: points } },
    { new: true }
  ).lean();

  return {
    pointsAwarded: points,
    totalPoints: updatedUser?.guardianPoints || 0,
    activity: 'tag_scan',
    isGoldMember,
  };
}

/**
 * Award points for lost pet report
 */
export async function awardLostPetReportPoints(
  userId: string,
  petId: string
): Promise<PointsEarningResult> {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const subscription = await Subscription.findOne({ userId, status: 'active' }).lean();
  const isGoldMember = subscription?.planType === 'monthly' && subscription?.price === 1.99;

  const basePoints = POINTS_CONFIG.LOST_PET_REPORT;
  const points = isGoldMember ? basePoints * POINTS_CONFIG.GOLD_MULTIPLIER : basePoints;

  // Record in ledger
  await recordPointsEarned(userId, points, 'lost_pet_report', petId, {});

  // Update user's total points
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { guardianPoints: points } },
    { new: true }
  ).lean();

  return {
    pointsAwarded: points,
    totalPoints: updatedUser?.guardianPoints || 0,
    activity: 'lost_pet_report',
    isGoldMember,
  };
}

/**
 * Award points when pet is reunited
 */
export async function awardPetReunitedPoints(
  userId: string,
  petId: string
): Promise<PointsEarningResult> {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const subscription = await Subscription.findOne({ userId, status: 'active' }).lean();
  const isGoldMember = subscription?.planType === 'monthly' && subscription?.price === 1.99;

  const basePoints = POINTS_CONFIG.PET_REUNITED;
  const points = isGoldMember ? basePoints * POINTS_CONFIG.GOLD_MULTIPLIER : basePoints;

  // Record in ledger
  await recordPointsEarned(userId, points, 'pet_reunited', petId, {});

  // Update user's total points
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { guardianPoints: points } },
    { new: true }
  ).lean();

  return {
    pointsAwarded: points,
    totalPoints: updatedUser?.guardianPoints || 0,
    activity: 'pet_reunited',
    isGoldMember,
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

  const subscription = await Subscription.findOne({ userId, status: 'active' }).lean();
  const isGoldMember = subscription?.planType === 'monthly' && subscription?.price === 1.99;

  const basePoints = POINTS_CONFIG.SOCIAL_SHARE;
  const points = isGoldMember ? basePoints * POINTS_CONFIG.GOLD_MULTIPLIER : basePoints;

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
    isGoldMember,
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

  const subscription = await Subscription.findOne({ userId, status: 'active' }).lean();
  const isGoldMember = subscription?.planType === 'monthly' && subscription?.price === 1.99;

  const basePoints = POINTS_CONFIG[`${milestoneType.toUpperCase()}_ANNIVERSARY` as keyof typeof POINTS_CONFIG] as number;
  const points = isGoldMember ? basePoints * POINTS_CONFIG.GOLD_MULTIPLIER : basePoints;

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
    isGoldMember,
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

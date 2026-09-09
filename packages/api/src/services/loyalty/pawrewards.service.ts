/**
 * @module PawRewards Service
 * @description PawRewards system for the Guardian loyalty program.
 *
 * PawRewards are a separate redeemable currency (not Guardian Points):
 * - Care: $2.00/month
 * - Nurture: $3.00/month
 * - Protector: $5.00/month
 * - Safeguard: $8.00/month
 *
 * Earning rate:
 * - $1 PawReward per $50 spent (Guardian)
 * - $1 PawReward per $25 spent (Gold)
 *
 * Redemption rules:
 * - Minimum $2 redemption
 * - 6-month expiration
 * - Maximum balance: $20 (Guardian), $40 (Gold)
 *
 * @example
 * ```typescript
 * import { allocateMonthlyRewards, redeemRewards } from '../loyalty/pawrewards.service';
 * await allocateMonthlyRewards(userId);
 * ```
 */

import mongoose from 'mongoose';
import { User, Subscription, Order, Setting, PawRewardsLedger } from '@pawtag/db';
import { calculateTier, TIER_BENEFITS, TierName } from './tier.service';
import { isGoldSubscription } from './points-earning.service';
import { sendMonthlySummaryEmail, sendPawRewardsReminderEmail } from '../email.service';
import { incrementCounter, METRICS } from '../../lib/metrics';
import logger from '../../lib/logger';

// PawRewards configuration
export const PAWREWARDS_CONFIG = {
  // Monthly allocation by tier (in NZD)
  MONTHLY_ALLOCATION: {
    CARE: 2.00,
    NURTURE: 3.00,
    PROTECTOR: 5.00,
    SAFEGUARD: 8.00,
  },

  // Earning rate (NZD spent per $1 PawReward)
  EARNING_RATE: {
    GUARDIAN: 50, // $50 spent = $1 PawReward
    GOLD: 25, // $25 spent = $1 PawReward
  },

  // Redemption rules
  MINIMUM_REDEMPTION: 2.00, // Minimum $2 redemption
  EXPIRATION_MONTHS: 6, // 6-month expiration

  // Maximum balance
  MAX_BALANCE: {
    GUARDIAN: 20.00,
    GOLD: 40.00,
  },
};

export interface PawRewardsBalance {
  balance: number;
  totalEarned: number;
  totalRedeemed: number;
  totalExpired: number;
  nextExpiration: Date | null;
  expirationAmount: number;
}

export interface PawRewardsTransaction {
  type: 'allocation' | 'earning' | 'redemption' | 'expiration';
  amount: number;
  description: string;
  createdAt: Date;
}

/**
 * Allocate monthly PawRewards based on tier
 */
export async function allocateMonthlyRewards(userId: string): Promise<{
  allocated: number;
  newBalance: number;
  tier: TierName;
}> {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  // Get current tier
  const tierInfo = await calculateTier(userId);
  const tier = tierInfo.tier;

  // Get monthly allocation for tier
  const allocation = PAWREWARDS_CONFIG.MONTHLY_ALLOCATION[tier];

  // Check if user has active subscription
  const subscription = await Subscription.findOne({ userId, status: 'active' }).lean();
  if (!subscription) {
    logger.info({ userId }, 'No active subscription, skipping PawRewards allocation');
    return { allocated: 0, newBalance: user.pawRewardsBalance || 0, tier };
  }

  // Check maximum balance
  const isGoldMember = await isGoldSubscription(subscription);
  const maxBalance = isGoldMember ? PAWREWARDS_CONFIG.MAX_BALANCE.GOLD : PAWREWARDS_CONFIG.MAX_BALANCE.GUARDIAN;
  const currentBalance = user.pawRewardsBalance || 0;

  if (currentBalance >= maxBalance) {
    logger.info({ userId, currentBalance, maxBalance }, 'Maximum PawRewards balance reached');
    return { allocated: 0, newBalance: currentBalance, tier };
  }

  // Calculate allocation (don't exceed max balance)
  const actualAllocation = Math.min(allocation, maxBalance - currentBalance);

  // Record in ledger
  await recordPawRewardsTransaction(userId, actualAllocation, 'allocation', `Monthly ${tier} allocation`);

  // Update user's balance
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { 
      $inc: { 
        pawRewardsBalance: actualAllocation,
        pawRewardsTotalEarned: actualAllocation,
      } 
    },
    { new: true }
  ).lean();

  // Send allocation email
  await sendAllocationEmail(userId, actualAllocation, tier, updatedUser?.pawRewardsBalance || 0);

  logger.info({
    userId,
    tier,
    allocated: actualAllocation,
    newBalance: updatedUser?.pawRewardsBalance,
  }, 'Monthly PawRewards allocated');

  return {
    allocated: actualAllocation,
    newBalance: updatedUser?.pawRewardsBalance || 0,
    tier,
  };
}

/**
 * Earn PawRewards from purchase
 */
export async function earnRewardsFromPurchase(
  userId: string,
  orderTotal: number,
  orderId: string
): Promise<{
  earned: number;
  newBalance: number;
}> {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  // Check if user has active subscription
  const subscription = await Subscription.findOne({ userId, status: 'active' }).lean();
  if (!subscription) {
    logger.info({ userId }, 'No active subscription, skipping PawRewards earning');
    return { earned: 0, newBalance: user.pawRewardsBalance || 0 };
  }

  // Determine earning rate
  const isGoldMember = await isGoldSubscription(subscription);
  const earningRate = isGoldMember ? PAWREWARDS_CONFIG.EARNING_RATE.GOLD : PAWREWARDS_CONFIG.EARNING_RATE.GUARDIAN;

  // Calculate earnings
  const earned = Math.floor(orderTotal / earningRate);
  if (earned <= 0) {
    return { earned: 0, newBalance: user.pawRewardsBalance || 0 };
  }

  // Check maximum balance
  const maxBalance = isGoldMember ? PAWREWARDS_CONFIG.MAX_BALANCE.GOLD : PAWREWARDS_CONFIG.MAX_BALANCE.GUARDIAN;
  const currentBalance = user.pawRewardsBalance || 0;

  if (currentBalance >= maxBalance) {
    logger.info({ userId, currentBalance, maxBalance }, 'Maximum PawRewards balance reached');
    return { earned: 0, newBalance: currentBalance };
  }

  // Don't exceed max balance
  const actualEarned = Math.min(earned, maxBalance - currentBalance);

  // Record in ledger
  await recordPawRewardsTransaction(userId, actualEarned, 'earning', `Purchase order ${orderId}`);

  // Update user's balance
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { 
      $inc: { 
        pawRewardsBalance: actualEarned,
        pawRewardsTotalEarned: actualEarned,
      } 
    },
    { new: true }
  ).lean();

  logger.info({
    userId,
    orderId,
    orderTotal,
    earned: actualEarned,
    newBalance: updatedUser?.pawRewardsBalance,
  }, 'PawRewards earned from purchase');

  return {
    earned: actualEarned,
    newBalance: updatedUser?.pawRewardsBalance || 0,
  };
}

/**
 * Redeem PawRewards
 */
export async function redeemRewards(
  userId: string,
  amount: number,
  orderId: string
): Promise<{
  redeemed: number;
  newBalance: number;
}> {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  // Check minimum redemption
  if (amount < PAWREWARDS_CONFIG.MINIMUM_REDEMPTION) {
    throw new Error(`Minimum redemption is $${PAWREWARDS_CONFIG.MINIMUM_REDEMPTION}`);
  }

  // Check sufficient balance
  const currentBalance = user.pawRewardsBalance || 0;
  if (currentBalance < amount) {
    throw new Error('Insufficient PawRewards balance');
  }

  // Record in ledger
  await recordPawRewardsTransaction(userId, -amount, 'redemption', `Redeemed for order ${orderId}`);

  // Update user's balance
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { 
      $inc: { 
        pawRewardsBalance: -amount,
        pawRewardsTotalRedeemed: amount,
      } 
    },
    { new: true }
  ).lean();

  logger.info({
    userId,
    orderId,
    redeemed: amount,
    newBalance: updatedUser?.pawRewardsBalance,
  }, 'PawRewards redeemed');

  incrementCounter(METRICS.LOYALTY_PAWREWARDS_REDEEMED_TOTAL, { }, amount);

  return {
    redeemed: amount,
    newBalance: updatedUser?.pawRewardsBalance || 0,
  };
}

/**
 * Get user's PawRewards balance and history
 */
export async function getPawRewardsBalance(userId: string): Promise<PawRewardsBalance> {
  const user = await User.findById(userId).select(
    'pawRewardsBalance pawRewardsTotalEarned pawRewardsTotalRedeemed pawRewardsTotalExpired'
  ).lean();

  if (!user) throw new Error('User not found');

  // Get next expiration
  const nextExpiration = await getNextExpiration(userId);

  return {
    balance: user.pawRewardsBalance || 0,
    totalEarned: user.pawRewardsTotalEarned || 0,
    totalRedeemed: user.pawRewardsTotalRedeemed || 0,
    totalExpired: user.pawRewardsTotalExpired || 0,
    nextExpiration: nextExpiration?.date || null,
    expirationAmount: nextExpiration?.amount || 0,
  };
}

/**
 * Get user's PawRewards transaction history
 */
export async function getPawRewardsHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<PawRewardsTransaction[]> {
  const transactions = await PawRewardsLedger.find({ userId })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  return transactions.map((t) => ({
    type: t.type as PawRewardsTransaction['type'],
    amount: t.amount,
    description: t.description,
    createdAt: t.createdAt,
  }));
}

/**
 * Process expiration of PawRewards
 */
export async function processRewardsExpiration(): Promise<{
  expiredCount: number;
  totalExpired: number;
}> {
  const now = new Date();
  let totalExpired = 0;

  // Find all users with PawRewards balance
  const users = await User.find({ pawRewardsBalance: { $gt: 0 } }).lean();

  for (const user of users) {
    // Find transactions older than 6 months
    const expirationDate = new Date(now);
    expirationDate.setMonth(expirationDate.getMonth() - PAWREWARDS_CONFIG.EXPIRATION_MONTHS);

    const oldTransactions = await PawRewardsLedger.find({
      userId: user._id,
      type: { $in: ['allocation', 'earning'] },
      createdAt: { $lte: expirationDate },
    }).lean();

    if (oldTransactions.length === 0) continue;

    // Calculate total to expire
    const totalToExpire = oldTransactions.reduce((sum, t) => sum + t.amount, 0);
    if (totalToExpire <= 0) continue;

    // Don't expire more than current balance
    const actualExpiration = Math.min(totalToExpire, user.pawRewardsBalance || 0);
    if (actualExpiration <= 0) continue;

    // Record expiration
    await recordPawRewardsTransaction(user._id.toString(), -actualExpiration, 'expiration', 'Rewards expired after 6 months');

    // Update user's balance
    await User.findByIdAndUpdate(user._id, {
      $inc: {
        pawRewardsBalance: -actualExpiration,
        pawRewardsTotalExpired: actualExpiration,
      },
    });

    totalExpired += actualExpiration;

    // Send expiration email
    await sendExpirationEmail(user._id.toString(), actualExpiration);

    logger.info({
      userId: user._id,
      expired: actualExpiration,
      newBalance: (user.pawRewardsBalance || 0) - actualExpiration,
    }, 'PawRewards expired');
  }

  return {
    expiredCount: users.length,
    totalExpired,
  };
}

/**
 * Get next expiration date and amount
 */
async function getNextExpiration(userId: string): Promise<{ date: Date; amount: number } | null> {
  const now = new Date();
  const expirationDate = new Date(now);
  expirationDate.setMonth(expirationDate.getMonth() - PAWREWARDS_CONFIG.EXPIRATION_MONTHS);

  const oldestTransaction = await PawRewardsLedger.findOne({
    userId,
    type: { $in: ['allocation', 'earning'] },
    createdAt: { $lte: expirationDate },
  }).sort({ createdAt: 1 }).lean();

  if (!oldestTransaction) return null;

  // Calculate total amount that will expire
  const transactionsToExpire = await PawRewardsLedger.find({
    userId,
    type: { $in: ['allocation', 'earning'] },
    createdAt: { $lte: expirationDate },
  }).lean();

  const totalAmount = transactionsToExpire.reduce((sum, t) => sum + t.amount, 0);

  return {
    date: new Date(oldestTransaction.createdAt.getTime() + PAWREWARDS_CONFIG.EXPIRATION_MONTHS * 30 * 24 * 60 * 60 * 1000),
    amount: totalAmount,
  };
}

/**
 * Record PawRewards transaction in ledger
 */
async function recordPawRewardsTransaction(
  userId: string,
  amount: number,
  type: 'allocation' | 'earning' | 'redemption' | 'expiration',
  description: string
): Promise<void> {
  try {
    await PawRewardsLedger.create({
      userId: new mongoose.Types.ObjectId(userId),
      amount,
      type,
      description,
      createdAt: new Date(),
    });
  } catch (error) {
    logger.error({ err: error, userId, type }, 'Failed to record PawRewards transaction');
  }
}

/**
 * Send allocation email
 */
async function sendAllocationEmail(
  userId: string,
  amount: number,
  tier: TierName,
  newBalance: number
): Promise<void> {
  const user = await User.findById(userId).select('email fullName').lean();
  if (!user?.email) return;

  await sendMonthlySummaryEmail(
    user.email,
    user.fullName || 'Guardian',
    tier,
    0,
    0,
    newBalance,
    amount,
  );
}

/**
 * Send expiration email
 */
async function sendExpirationEmail(userId: string, amount: number): Promise<void> {
  const user = await User.findById(userId).select('email fullName pawRewardsBalance').lean();
  if (!user?.email) return;

  const expirationDate = new Date();
  expirationDate.setMonth(expirationDate.getMonth() + 1);

  await sendPawRewardsReminderEmail(
    user.email,
    user.fullName || 'Guardian',
    user.pawRewardsBalance || 0,
    expirationDate.toISOString(),
    amount,
  );
}

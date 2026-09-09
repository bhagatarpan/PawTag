import { User, Subscription } from '@pawtag/db';
import logger from '../lib/logger';
import { allocateMonthlyRewards, processRewardsExpiration } from '../services/loyalty/pawrewards.service';
import { updateTier } from '../services/loyalty/tier.service';
import { awardMembershipMilestonePoints } from '../services/loyalty/points-earning.service';

const DAILY_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function runPawRewardsJobs(): Promise<void> {
  // 1. Allocate monthly PawRewards to eligible subscribers
  await allocateMonthlyRewardsForSubscribers();

  // 2. Expire old PawRewards
  await processRewardsExpiration();

  // 3. Re-evaluate all user tiers (annual re-qualification)
  await reQualifyTiers();

  // 4. Award monthly membership milestone points
  await awardMonthlyMembershipPoints();
}

async function allocateMonthlyRewardsForSubscribers(): Promise<void> {
  try {
    const activeSubscriptions = await Subscription.find({ status: 'active' }).select('userId').lean();
    const uniqueUserIds = [...new Set(activeSubscriptions.map((s) => s.userId.toString()))];

    let allocated = 0;
    for (const userId of uniqueUserIds) {
      try {
        const result = await allocateMonthlyRewards(userId);
        if (result.allocated > 0) {
          allocated++;
          logger.info({ userId, allocated: result.allocated, tier: result.tier }, 'Monthly PawRewards allocated');
        }
      } catch (err) {
        logger.error({ err, userId }, 'Failed to allocate monthly PawRewards');
      }
    }

    if (allocated > 0) {
      logger.info(`[PawRewardsJob] Allocated monthly rewards for ${allocated} users`);
    }
  } catch (err) {
    logger.error({ err }, '[PawRewardsJob] Error running monthly allocation');
  }
}

/**
 * Re-evaluate all active user tiers.
 * This handles annual re-qualification and any point-based tier changes.
 */
async function reQualifyTiers(): Promise<void> {
  try {
    const usersWithGuardian = await User.find({
      guardianPoints: { $gt: 0 },
      deletedAt: null,
    }).select('_id').lean();

    let tierChanges = 0;
    for (const user of usersWithGuardian) {
      try {
        const result = await updateTier(user._id.toString());
        // updateTier logs tier changes internally
        tierChanges++;
      } catch (err) {
        logger.error({ err, userId: user._id }, 'Failed to re-qualify tier');
      }
    }

    if (tierChanges > 0) {
      logger.info(`[PawRewardsJob] Re-qualified ${tierChanges} user tiers`);
    }
  } catch (err) {
    logger.error({ err }, '[PawRewardsJob] Error running tier re-qualification');
  }
}

/**
 * Award monthly membership milestone points to all active subscribers.
 */
async function awardMonthlyMembershipPoints(): Promise<void> {
  try {
    const activeSubscriptions = await Subscription.find({ status: 'active' }).select('userId').lean();
    const uniqueUserIds = [...new Set(activeSubscriptions.map((s) => s.userId.toString()))];

    let awarded = 0;
    for (const userId of uniqueUserIds) {
      try {
        await awardMembershipMilestonePoints(userId, 'monthly');
        awarded++;
      } catch (err) {
        logger.error({ err, userId }, 'Failed to award monthly membership points');
      }
    }

    if (awarded > 0) {
      logger.info(`[PawRewardsJob] Awarded monthly membership points to ${awarded} users`);
    }
  } catch (err) {
    logger.error({ err }, '[PawRewardsJob] Error awarding monthly membership points');
  }
}

export function startPawRewardsJob(): void {
  setInterval(async () => {
    try {
      await runPawRewardsJobs();
    } catch (error) {
      logger.error({ err: error }, '[PawRewardsJob] Error');
    }
  }, DAILY_CHECK_INTERVAL_MS);

  logger.info('[PawRewardsJob] Started — runs daily for allocation, expiration, tier re-qualification, and membership points');
}

import { UserMembership, MembershipTier } from '@pawtag/db';
import { activateMembership } from '../services/membership.service';
import { membershipEntitlementService } from '../services/membership-entitlement.service';
import logger from '../lib/logger';

/**
 * Membership Activation Reconciliation Job
 *
 * Finds memberships stuck in 'pending_payment' for more than 10 minutes
 * and attempts to activate them by checking Stripe subscription status.
 *
 * Runs every 5 minutes via the job scheduler.
 */
export async function runMembershipActivationReconciliation(): Promise<import('../services/job-scheduler.service').JobResult> {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // Find memberships stuck in pending_payment for more than 10 minutes
    const stuckMemberships = await UserMembership.find({
      status: 'pending_payment',
      createdAt: { $lte: tenMinutesAgo },
    }).populate('tierId');

    if (stuckMemberships.length === 0) {
      return { success: true };
    }

    logger.info({ count: stuckMemberships.length }, '[Membership Reconciliation] Found stuck pending_payment memberships');

    let activated = 0;
    let cancelled = 0;
    let failed = 0;

    for (const membership of stuckMemberships) {
      try {
        // Try to activate the membership
        // activateMembership() checks if already active and handles idempotency
        await activateMembership(membership._id.toString());
        activated++;
        logger.info({ membershipId: membership._id, userId: membership.userId }, '[Membership Reconciliation] Activated stuck membership');
      } catch (err) {
        // If activation fails, the membership stays pending_payment
        // This could happen if the Stripe subscription is incomplete_expired
        failed++;
        logger.error({ err, membershipId: membership._id }, '[Membership Reconciliation] Failed to activate membership');
      }
    }

    // Invalidate entitlement cache in case any memberships were activated
    if (activated > 0) {
      membershipEntitlementService.invalidateCache();
    }

    logger.info({
      total: stuckMemberships.length,
      activated,
      failed,
    }, '[Membership Reconciliation] Completed');

    return { success: true };
  } catch (error: any) {
    logger.error({ err: error }, '[Membership Reconciliation] Job error');
    return { success: false, error: error.message || 'Unknown error' };
  }
}

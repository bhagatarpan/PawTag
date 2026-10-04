/**
 * Apply Stripe cancel_at_period_end sync to local billing documents.
 * Domain rule lives in @pawtag/shared resolveStripeCancelSyncAction.
 */
import { Subscription, UserMembership } from '@pawtag/db';
import {
  resolveStripeCancelSyncAction,
  type StripeCancelSyncAction,
} from '@pawtag/shared';
import logger from '../lib/logger';
import { stripeWebhookAuditContext } from '../lib/app-meta';
import { auditService } from './audit';

export interface StripeSubscriptionSnapshot {
  id: string;
  status: string;
  cancel_at_period_end?: boolean;
}

function cancelReasonFromStripe(source: 'billing_portal' | 'stripe'): string {
  return source === 'billing_portal'
    ? 'Cancelled via Stripe Billing Portal'
    : 'Cancelled via Stripe';
}

async function auditMembershipCancelSync(
  membership: { _id: unknown; userId?: unknown; cancelledAt?: Date | null; autoRenew?: boolean },
  action: 'membership_cancelled_via_stripe' | 'membership_resumed_via_stripe',
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await auditService.log(stripeWebhookAuditContext(), {
      action,
      eventType: 'membership.cancelled',
      eventCategory: 'FINANCIAL',
      operationType: 'UPDATE',
      resourceType: 'UserMembership',
      resourceId: String(membership._id),
      subjectUserId: membership.userId?.toString(),
      outcome: 'SUCCESS',
      severity: 'HIGH',
      metadata: {
        userId: membership.userId?.toString(),
        cancelledAt: membership.cancelledAt,
        autoRenew: membership.autoRenew,
        ...metadata,
      },
    });
  } catch (err) {
    logger.error({ err, membershipId: membership._id, action }, 'Failed to audit membership cancel sync');
  }
}

/**
 * Sync UserMembership cancel window from Stripe Billing Portal state.
 */
export async function syncUserMembershipCancelState(
  membership: any,
  stripeSubscription: StripeSubscriptionSnapshot,
): Promise<StripeCancelSyncAction> {
  const action = resolveStripeCancelSyncAction({
    stripeStatus: stripeSubscription.status,
    cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end),
    localCancelledAt: membership.cancelledAt,
    localStatus: membership.status,
  });

  if (action === 'none') return action;

  if (action === 'expire') {
    membership.status = 'cancelled';
    membership.cancelledAt = membership.cancelledAt || new Date();
    membership.cancellationReason = membership.cancellationReason || cancelReasonFromStripe('stripe');
    membership.autoRenew = false;
    await membership.save();
    logger.info(
      { membershipId: membership._id, stripeSubscriptionId: stripeSubscription.id },
      'Membership cancelled via Stripe (subscription sync)',
    );
    await auditMembershipCancelSync(membership, 'membership_cancelled_via_stripe', {
      stripeStatus: stripeSubscription.status,
      action,
    });
    return action;
  }

  if (action === 'cancel') {
    membership.cancelledAt = new Date();
    membership.cancellationReason =
      membership.cancellationReason || cancelReasonFromStripe('billing_portal');
    membership.autoRenew = false;
    await membership.save();
    logger.info(
      { membershipId: membership._id, stripeSubscriptionId: stripeSubscription.id },
      'Membership cancel_at_period_end synced from Stripe Billing Portal',
    );
    await auditMembershipCancelSync(membership, 'membership_cancelled_via_stripe', {
      cancelAtPeriodEnd: true,
      source: 'customer.subscription.updated',
      action,
    });
    return action;
  }

  // resume
  membership.cancelledAt = undefined;
  membership.cancellationReason = undefined;
  membership.autoRenew = true;
  await membership.save();
  logger.info(
    { membershipId: membership._id, stripeSubscriptionId: stripeSubscription.id },
    'Membership resume synced from Stripe (cancel_at_period_end cleared)',
  );
  await auditMembershipCancelSync(membership, 'membership_resumed_via_stripe', {
    cancelAtPeriodEnd: false,
    source: 'customer.subscription.updated',
    action,
  });
  return action;
}

/**
 * Sync tag Subscription cancel window from Stripe Billing Portal state.
 */
export async function syncTagSubscriptionCancelState(
  sub: any,
  stripeSubscription: StripeSubscriptionSnapshot,
): Promise<StripeCancelSyncAction> {
  const action = resolveStripeCancelSyncAction({
    stripeStatus: stripeSubscription.status,
    cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end),
    localCancelledAt: sub.cancelledAt,
    localStatus: sub.status,
  });

  if (action === 'none') return action;

  if (action === 'expire' || action === 'cancel') {
    if (action === 'expire') {
      sub.status = 'cancelled';
      sub.cancelledAt = sub.cancelledAt || new Date();
      sub.cancellationReason = sub.cancellationReason || cancelReasonFromStripe('stripe');
      sub.autoRenew = false;
      sub.cancelledBy = sub.cancelledBy || 'System (Stripe)';
      sub.cancelledByType = sub.cancelledByType || 'System';
      sub.cancelledByPortal = sub.cancelledByPortal || 'system';
      await sub.save();
      logger.info(
        { subscriptionId: sub._id, stripeSubscriptionId: stripeSubscription.id },
        'Subscription cancelled via Stripe (subscription sync)',
      );
      return action;
    }

    sub.cancelledAt = new Date();
    sub.cancellationReason = sub.cancellationReason || cancelReasonFromStripe('billing_portal');
    sub.autoRenew = false;
    await sub.save();
    logger.info(
      { subscriptionId: sub._id, stripeSubscriptionId: stripeSubscription.id },
      'Subscription cancel_at_period_end synced from Stripe Billing Portal',
    );
    return action;
  }

  sub.cancelledAt = undefined;
  sub.cancellationReason = undefined;
  sub.autoRenew = true;
  await sub.save();
  logger.info(
    { subscriptionId: sub._id, stripeSubscriptionId: stripeSubscription.id },
    'Subscription resume synced from Stripe (cancel_at_period_end cleared)',
  );
  return action;
}

/**
 * Webhook orchestration for membership cancel-state sync.
 * Keeps route thin — domain rules stay here + shared resolver.
 */
export async function syncMembershipFromStripeSubscriptionUpdated(
  stripeSubscription: StripeSubscriptionSnapshot,
): Promise<void> {
  const membership = await UserMembership.findOne({
    stripeSubscriptionId: stripeSubscription.id,
  });
  if (!membership) return;

  const { activateMembership } = await import('./membership.service');
  if (membership.status === 'pending_payment' && stripeSubscription.status === 'active') {
    await activateMembership(membership._id.toString());
    logger.info(
      { membershipId: membership._id, stripeStatus: stripeSubscription.status },
      'Membership activated via customer.subscription.updated webhook',
    );
    membership.status = 'active';
  }

  await syncUserMembershipCancelState(membership, stripeSubscription);
}

export async function syncTagSubscriptionFromStripeSubscriptionUpdated(
  stripeSubscription: StripeSubscriptionSnapshot,
): Promise<{ handled: boolean }> {
  const sub = await Subscription.findOne({
    stripeSubscriptionId: stripeSubscription.id,
  });
  if (!sub) return { handled: false };

  const oldStatus = sub.status;
  const statusMap: Record<string, string> = {
    active: 'active',
    past_due: 'active',
    trialing: 'active',
    canceled: 'cancelled',
    unpaid: 'grace_period',
    incomplete_expired: 'expired',
  };

  const newStatus = statusMap[stripeSubscription.status] || sub.status;
  if (newStatus !== oldStatus) {
    sub.status = newStatus as any;
    if (newStatus === 'cancelled') {
      sub.autoRenew = false;
      sub.cancelledAt = sub.cancelledAt || new Date();
      sub.cancellationReason = sub.cancellationReason || cancelReasonFromStripe('stripe');
      sub.cancelledBy = sub.cancelledBy || 'System (Stripe)';
      sub.cancelledByType = sub.cancelledByType || 'System';
      sub.cancelledByPortal = sub.cancelledByPortal || 'system';
    }
    await sub.save();
    logger.info(
      {
        subscriptionId: sub._id,
        oldStatus,
        newStatus,
        stripeStatus: stripeSubscription.status,
      },
      'Subscription status synced from Stripe',
    );
  }

  await syncTagSubscriptionCancelState(sub, stripeSubscription);
  return { handled: true };
}

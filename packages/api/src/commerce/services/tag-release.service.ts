/**
 * @module Tag Release Service
 * @description Releases generated tags when the money or goods behind them
 * go away — the single entry point for cancellation/refund tag outcomes.
 * Plan + founder decisions: docs/TAG-RELEASE-ON-CANCEL-REFUND.md
 *
 * "Release" = tag status → 'cancelled': finder off, hidden from customer
 * lists, unredeemable, ownership KEPT for audit (unlike 'returned', which
 * clears ownership because the goods physically came back).
 *
 * Per-tag invariant (founder decision): a tag is released only when ITS
 * money went back (or its goods never left PawTag on cancellation). A tag
 * the customer paid for and kept is NEVER touched — order-level freezes
 * happen only when every tag's money was returned (full refund) or the
 * whole order is cancelled before shipping.
 *
 * Every public entry point is idempotent: returned/cancelled tags are
 * skipped, cancelled fulfilments/subscriptions are no-ops — safe to re-run
 * from retries, webhooks, or repair paths.
 */
import { Fulfilment, Subscription, Tag } from '@pawtag/db';
import mongoose from 'mongoose';
import type { CancelSubscriptionContext } from '../../services/subscription.service';
import logger from '../../lib/logger';

export type TagReleaseReason = 'order_cancelled' | 'refund_without_return' | 'full_refund';

/** Audit context passed through to subscription cancellation (same shape). */
type TagReleaseContext = CancelSubscriptionContext;

const RELEASED_STATUSES = ['returned', 'cancelled'];

export interface TagReleaseResult {
  released: string[];
  skipped: string[];
}

function toObjectId(id: mongoose.Types.ObjectId | string): mongoose.Types.ObjectId {
  return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id));
}

/** Cancel any live tag subscription (local + Stripe) for a released tag. */
async function cancelSubscriptionsForTag(
  tagOid: mongoose.Types.ObjectId,
  reason: string,
  context?: TagReleaseContext,
): Promise<void> {
  const subs = await Subscription.find({
    tagId: tagOid,
    cancelledAt: null,
  }).select('_id status cancelledAt');

  for (const sub of subs) {
    try {
      const { cancelSubscription } = await import('../../services/subscription.service');
      await cancelSubscription(String(sub._id), reason, { portal: 'system', ...context });
      logger.info({ tagOid: String(tagOid), subscriptionId: String(sub._id) }, 'Tag subscription cancelled with tag release');
    } catch (err: any) {
      // 'already cancelled' is a clean idempotent outcome; anything else
      // needs reconciliation — never fail the release for it.
      if (String(err?.message || '').includes('already cancelled')) continue;
      logger.error(
        { err, tagOid: String(tagOid), subscriptionId: String(sub._id) },
        'Failed to cancel tag subscription during tag release — reconciliation required',
      );
    }
  }
}

/**
 * Release specific tags (exact attribution — Return.items tagIds, or the
 * full set the caller resolved). Skips tags already returned/cancelled.
 */
export async function releaseTagsByIds(
  tagIds: Array<mongoose.Types.ObjectId | string>,
  reason: TagReleaseReason,
  context?: TagReleaseContext,
): Promise<TagReleaseResult> {
  const result: TagReleaseResult = { released: [], skipped: [] };
  const reasonText = reason === 'order_cancelled'
    ? 'Order cancelled'
    : reason === 'refund_without_return'
      ? 'Refunded without return — goods retained by customer'
      : 'Order fully refunded';

  for (const raw of tagIds.filter(Boolean)) {
    const oid = toObjectId(raw);
    const tag = await Tag.findById(oid);
    if (!tag) {
      result.skipped.push(String(oid));
      continue;
    }
    if (RELEASED_STATUSES.includes(String(tag.status)) || tag.returnedAt) {
      result.skipped.push(String(tag._id));
      continue;
    }

    tag.status = 'cancelled';
    await tag.save();
    result.released.push(String(tag._id));

    logger.info(
      { tagId: tag.tagId, orderId: tag.orderId, reason },
      'Tag released (status=cancelled, ownership kept for audit)',
    );
    await cancelSubscriptionsForTag(tag._id, reasonText, context);
  }

  return result;
}

/**
 * Release every non-returned tag on an order. Used by CANCELLATION (only
 * possible pre-ship, so no paid-and-kept tag can exist) and by FULL refunds
 * (every tag's money is back — leftovers the return did not cover freeze too).
 */
export async function releaseTagsForOrder(
  orderId: mongoose.Types.ObjectId | string,
  reason: TagReleaseReason,
  context?: TagReleaseContext,
): Promise<TagReleaseResult> {
  const oid = toObjectId(orderId);
  const tags = await Tag.find({
    orderId: oid,
    deletedAt: null,
    status: { $nin: RELEASED_STATUSES },
  }).select('_id');
  return releaseTagsByIds(tags.map((t) => t._id), reason, context);
}

/**
 * Cancel an open fulfilment so the warehouse queue stops showing work for a
 * dead order. Fulfilled fulfilments are left alone (goods already shipped —
 * the refund/return paths own that state).
 */
export async function cancelFulfilmentForOrder(orderId: mongoose.Types.ObjectId | string): Promise<boolean> {
  const oid = toObjectId(orderId);
  const fulfilments = await Fulfilment.find({
    orderId: oid,
    status: { $in: ['pending', 'picking', 'packing'] },
  }).select('_id status');

  for (const f of fulfilments) {
    await Fulfilment.updateOne({ _id: f._id }, { $set: { status: 'cancelled' } });
    logger.info({ fulfilmentId: String(f._id), orderId: String(oid) }, 'Fulfilment cancelled with order cancellation');
  }
  return fulfilments.length > 0;
}

/**
 * Cancel live tag subscriptions for tags that are being DETACHED (returned)
 * rather than frozen — the Subscription doc and Stripe sub must not outlive
 * the tag they bill for. Tag-document `subscriptionStatus` flips alone are
 * not enough (audit gap: docs/TAG-RELEASE-ON-CANCEL-REFUND.md §G3).
 */
export async function cancelSubscriptionsForTagIds(
  tagIds: Array<mongoose.Types.ObjectId | string>,
  reason: string,
  context?: TagReleaseContext,
): Promise<void> {
  for (const raw of tagIds.filter(Boolean)) {
    await cancelSubscriptionsForTag(toObjectId(raw), reason, context);
  }
}

export default {
  releaseTagsByIds,
  releaseTagsForOrder,
  cancelFulfilmentForOrder,
  cancelSubscriptionsForTagIds,
};

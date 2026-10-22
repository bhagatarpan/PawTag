/**
 * @module Tag Activation Service
 * @description Single source of truth for the tag ACTIVATION cap
 * (docs/TAG-ACTIVATION-LIMIT.md — founder rules):
 *
 * - Buying tags is never capped; ACTIVATIONS are.
 * - Effective limit: paid tier's registry `tag_limit` → else the
 *   `commerce.tagActivation.nonMemberLimit` setting (default 2 — covers the
 *   free 3-month window and every non-member).
 * - `active == limit` → ONE further activation after paying the one-time
 *   `commerce.tagActivation.feeAmount` fee (bound to that tag id);
 *   `active >= limit + 1` → hard block, membership upgrade only.
 * - Replacement tags (replacesTagId set) bypass the cap — same physical slot.
 *
 * Every consumer (redeem enforcement, checkout, both widgets) goes through
 * this service — limits and counts are never re-derived elsewhere.
 */
import { Order, Tag } from '@pawtag/db';
import { getNumberSetting } from '../config';
import {
  membershipEntitlementService,
  ACTIVATION_CONTEXT,
} from '../../services/membership-entitlement.service';

export interface TagUsage {
  /** Tags currently in `active` status (the cap metric). */
  activeCount: number;
  /** Tags owned and still theirs (excludes returned/released). */
  purchasedCount: number;
  /** Effective activation limit (never null — non-member setting is the fallback). */
  limit: number;
}

export interface ActivationCap {
  allowed: boolean;
  /** Only true when the very NEXT activation may be paid for (active === limit). */
  feeEligible: boolean;
  limit: number;
  activeCount: number;
  /** GST-inclusive one-time fee (config) — present when feeEligible. */
  feeAmount?: number;
  /** Paid fee order exists for another tag that is not yet activated (direct the customer there). */
  existingPaidTagId?: string;
  /** Always the upgrade path (R3 hard block shows only this). */
  upgradeUrl: string;
}

async function countActiveTags(userId: string): Promise<number> {
  return Tag.countDocuments({ ownerId: userId, status: 'active', deletedAt: null });
}

/**
 * Effective activation limit for a user. Paid tiers resolve from the
 * entitlement registry; everyone else from the commerce setting (config
 * default is the ultimate fallback — never hardcoded here).
 */
async function resolveTagLimit(userId: string): Promise<number> {
  const context = await membershipEntitlementService.getUserBenefitContext(userId);
  if (context && context !== ACTIVATION_CONTEXT) {
    const tierLimit = await membershipEntitlementService.getValue<number>(userId, 'tag_limit');
    if (tierLimit !== null && tierLimit > 0) return tierLimit;
  }
  const settingLimit = await getNumberSetting('commerce.tagActivation.nonMemberLimit');
  return settingLimit > 0 ? settingLimit : 1;
}

/** Usage numbers for the dashboard + CSR drawer widgets (same definitions everywhere). */
async function getTagUsage(userId: string): Promise<TagUsage> {
  const [activeCount, purchasedCount, limit] = await Promise.all([
    countActiveTags(userId),
    Tag.countDocuments({
      ownerId: userId,
      deletedAt: null,
      status: { $nin: ['returned', 'cancelled'] },
    }),
    resolveTagLimit(userId),
  ]);
  return { activeCount, purchasedCount, limit };
}

/** A completed (not refunded) activation-fee order exists for this specific tag. */
async function hasPaidActivationFee(userId: string, tagId: string): Promise<boolean> {
  const order = await Order.findOne({
    userId,
    'tagActivation.tagId': tagId,
    'payment.status': 'completed',
  }).select('_id');
  return !!order;
}

/**
 * A customer paid for ANOTHER tag's activation but never activated it —
 * they must not be charged again (R5 / risk table: max one unused paid fee).
 */
async function findUnusedPaidFee(userId: string, excludeTagId?: string): Promise<string | null> {
  const query: Record<string, unknown> = {
    userId,
    'payment.status': 'completed',
    'tagActivation.tagId': { $exists: true },
  };
  if (excludeTagId) query['tagActivation.tagId'] = { $exists: true, $ne: excludeTagId };

  const paidFeeOrders = await Order.find(query).select('tagActivation.tagId').limit(10);
  for (const order of paidFeeOrders) {
    const paidTagId = (order as any).tagActivation?.tagId;
    if (!paidTagId) continue;
    const tag = await Tag.findOne({ tagId: paidTagId }).select('status');
    if (tag && tag.status !== 'active') return paidTagId;
  }
  return null;
}

/**
 * Evaluate the cap before activating `tagId` (optional).
 * Pure decision function — the caller turns a disallowed result into the
 * typed 409 payload (docs/TAG-ACTIVATION-LIMIT.md decision tree).
 */
async function checkActivationCap(
  userId: string,
  opts: { tagId?: string; replacingTagId?: unknown } = {},
): Promise<ActivationCap> {
  // R4: replacements occupy the same physical slot — never capped/charged
  if (opts.replacingTagId) {
    const [activeCount, limit] = await Promise.all([countActiveTags(userId), resolveTagLimit(userId)]);
    return { allowed: true, feeEligible: false, limit, activeCount, upgradeUrl: '/membership' };
  }

  const [activeCount, limit] = await Promise.all([countActiveTags(userId), resolveTagLimit(userId)]);

  if (activeCount < limit) {
    return { allowed: true, feeEligible: false, limit, activeCount, upgradeUrl: '/membership' };
  }

  if (opts.tagId && (await hasPaidActivationFee(userId, opts.tagId))) {
    // This specific tag's fee is already spent — the limit+1 slot is theirs
    return { allowed: true, feeEligible: false, limit, activeCount, upgradeUrl: '/membership' };
  }

  if (activeCount > limit) {
    // Reached limit + 1 (the paid slot is used or the limit shrank) → upgrade only
    return { allowed: false, feeEligible: false, limit, activeCount, upgradeUrl: '/membership' };
  }

  // activeCount === limit → the single paid activation is available
  const existingPaidTagId = (await findUnusedPaidFee(userId, opts.tagId)) ?? undefined;
  const feeAmount = await getNumberSetting('commerce.tagActivation.feeAmount');
  return {
    allowed: false,
    feeEligible: !existingPaidTagId,
    limit,
    activeCount,
    feeAmount: feeAmount > 0 ? feeAmount : undefined,
    existingPaidTagId,
    upgradeUrl: '/membership',
  };
}

export const tagActivationService = {
  countActiveTags,
  resolveTagLimit,
  getTagUsage,
  hasPaidActivationFee,
  findUnusedPaidFee,
  checkActivationCap,
};

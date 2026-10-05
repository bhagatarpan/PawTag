/**
 * Detach tags that were physically returned to PawTag.
 *
 * Partial returns (2 of 3) must detach ONLY the returned tags.
 * Prefer Return.items[].tagIds. Never fall back to "all order tags"
 * when the return quantity is less than the total tags on the order.
 *
 * refundWithoutReturn: goods never came back — do not detach.
 * Idempotent: already-returned tags are skipped.
 */
import { Fulfilment, Tag } from '@pawtag/db';
import mongoose from 'mongoose';
import logger from '../../lib/logger';

export interface DetachTagsForReturnParams {
  orderId: mongoose.Types.ObjectId | string;
  returnId: mongoose.Types.ObjectId | string;
  /** Explicit tag ids from return items (required for partial returns). */
  tagIds?: Array<mongoose.Types.ObjectId | string>;
  /** Return items with optional pre-resolved tagIds + quantities. */
  items?: Array<{
    orderItemId?: unknown;
    productName?: string;
    quantity?: number;
    tagIds?: unknown[];
  }>;
  refundWithoutReturn?: boolean;
}

/** Human tagId strings (PT-...) → ObjectId for Tag docs. */
export async function resolveTagObjectIdsFromHumanIds(
  humanIds: string[],
): Promise<mongoose.Types.ObjectId[]> {
  const cleaned = humanIds.filter(Boolean).map((id) => String(id).trim());
  if (cleaned.length === 0) return [];
  const tags = await Tag.find({ tagId: { $in: cleaned } }).select('_id tagId').lean();
  return tags.map((t) => t._id);
}

/**
 * Resolve tag ObjectIds for a return from fulfilment assignments + order tags.
 * - Prefer items[].tagIds when present.
 * - Else match fulfilment tagAssignments by orderItemId for each return line.
 * - Else for a line that returns ALL remaining tags on the order for matching product qty,
 *   take unreturned tags on the order up to quantity (full-line return).
 */
export async function resolveTagIdsForReturn(params: {
  orderId: mongoose.Types.ObjectId | string;
  items?: DetachTagsForReturnParams['items'];
}): Promise<mongoose.Types.ObjectId[]> {
  const { orderId, items } = params;

  const fromItems = (items || [])
    .flatMap((i) => i.tagIds || [])
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(String(id)));
  if (fromItems.length > 0) {
    return fromItems;
  }

  const orderTags = await Tag.find({ orderId, deletedAt: null }).lean();
  if (orderTags.length === 0) return [];

  const unreturned = orderTags.filter((t) => t.status !== 'returned' && !t.returnedAt);
  const fulfilments = await Fulfilment.find({ orderId }).lean();
  const assignments = fulfilments.flatMap((f) => f.tagAssignments || []);

  // Map human PT- id → ObjectId
  const humanToObject = new Map<string, mongoose.Types.ObjectId>();
  for (const t of orderTags) {
    humanToObject.set(String(t.tagId), t._id);
  }

  const resolved = new Set<string>();

  for (const item of items || []) {
    const qty = Number(item.quantity || 0);
    if (qty <= 0) continue;

    // 1) Fulfilment assignments for this orderItemId
    if (item.orderItemId) {
      const matches = assignments.filter(
        (a) => String(a.orderItemId) === String(item.orderItemId),
      );
      for (const a of matches) {
        const oid = humanToObject.get(String(a.tagId));
        if (oid) resolved.add(String(oid));
      }
      if (resolved.size > 0 && matches.length >= qty) continue;
    }

    // 2) Product name + qty from unreturned order tags (best-effort)
    if (item.productName) {
      // Without per-product tag mapping, only safe when return qty equals
      // number of unreturned tags (full remaining return on this order).
      if (qty >= unreturned.length && unreturned.length > 0) {
        for (const t of unreturned) resolved.add(String(t._id));
      }
    }
  }

  return Array.from(resolved).map((id) => new mongoose.Types.ObjectId(id));
}

/**
 * True when return covers every remaining unreturned tag on the order.
 * Only then is a full-order detach fallback safe.
 */
export async function isFullOrderTagReturn(params: {
  orderId: mongoose.Types.ObjectId | string;
  items?: DetachTagsForReturnParams['items'];
}): Promise<boolean> {
  const unreturned = await Tag.find({
    orderId: params.orderId,
    deletedAt: null,
    status: { $ne: 'returned' },
  }).lean();
  if (unreturned.length === 0) return true;

  const totalReturnQty = (params.items || []).reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  return totalReturnQty >= unreturned.length;
}

/**
 * Mark tags as returned to PawTag. Clears ownership so they disappear
 * from customer tag lists and stop serving finder data.
 */
export async function detachTagsReturnedToPawTag(
  params: DetachTagsForReturnParams,
): Promise<{ detached: number; skipped: number; tagIds: string[]; safety?: string }> {
  const { orderId, returnId, refundWithoutReturn } = params;

  if (refundWithoutReturn) {
    logger.info({ orderId, returnId }, '[Returns] refundWithoutReturn — tags not detached');
    return { detached: 0, skipped: 0, tagIds: [], safety: 'refund_without_return' };
  }

  let tagObjectIdList = (params.tagIds || [])
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(String(id)));

  if (tagObjectIdList.length === 0) {
    tagObjectIdList = await resolveTagIdsForReturn({ orderId, items: params.items });
  }

  if (tagObjectIdList.length === 0) {
    // Safe fallback: only if this return covers all remaining tags
    const full = await isFullOrderTagReturn({ orderId, items: params.items });
    if (full) {
      const all = await Tag.find({
        orderId,
        deletedAt: null,
        status: { $ne: 'returned' },
      }).lean();
      tagObjectIdList = all.map((t) => t._id);
    } else {
      logger.warn(
        { orderId, returnId, itemCount: params.items?.length },
        '[Returns] Partial return without tagIds — refusing order-wide detach (would hide kept tags)',
      );
      return {
        detached: 0,
        skipped: 0,
        tagIds: [],
        safety: 'partial_return_without_tag_ids',
      };
    }
  }

  let detached = 0;
  let skipped = 0;
  const detachedIds: string[] = [];

  for (const tagId of tagObjectIdList) {
    const tag = await Tag.findById(tagId);
    if (!tag) {
      skipped += 1;
      continue;
    }
    if (tag.status === 'returned' || tag.returnedAt) {
      skipped += 1;
      detachedIds.push(String(tag._id));
      continue;
    }

    tag.returnedOwnerId = tag.ownerId;
    tag.ownerId = undefined;
    tag.petId = undefined;
    tag.status = 'returned';
    tag.returnedAt = new Date();
    tag.returnId = new mongoose.Types.ObjectId(String(returnId));
    tag.subscriptionStatus = 'none';
    await tag.save();

    detached += 1;
    detachedIds.push(String(tag._id));
    logger.info(
      { tagId: tag.tagId, returnId, orderId },
      '[Returns] Tag detached after return (status=returned, ownership cleared)',
    );
  }

  return { detached, skipped, tagIds: detachedIds };
}

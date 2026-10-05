/**
 * Detach tags that were physically returned to PawTag.
 * Idempotent: returned tags are skipped.
 *
 * refundWithoutReturn: goods never came back — do not detach.
 */
import { Fulfilment, Tag } from '@pawtag/db';
import mongoose from 'mongoose';
import logger from '../../lib/logger';

export interface DetachTagsForReturnParams {
  orderId: mongoose.Types.ObjectId | string;
  returnId: mongoose.Types.ObjectId | string;
  /** Explicit tag ids from return items (preferred for partial returns). */
  tagIds?: Array<mongoose.Types.ObjectId | string>;
  refundWithoutReturn?: boolean;
}

/**
 * Resolve tag ids for an order from fulfilment assignments when return items lack tagIds.
 */
export async function resolveTagIdsForOrder(
  orderId: mongoose.Types.ObjectId | string,
): Promise<mongoose.Types.ObjectId[]> {
  const fulfilments = await Fulfilment.find({ orderId }).lean();
  const ids = new Set<string>();
  for (const f of fulfilments) {
    for (const a of f.tagAssignments || []) {
      if (a.tagId) ids.add(String(a.tagId));
    }
  }
  return Array.from(ids).map((id) => new mongoose.Types.ObjectId(id));
}

/**
 * Mark tags as returned to PawTag. Clears ownership so they disappear
 * from customer tag lists and stop serving finder data.
 */
export async function detachTagsReturnedToPawTag(
  params: DetachTagsForReturnParams,
): Promise<{ detached: number; skipped: number; tagIds: string[] }> {
  const { orderId, returnId, refundWithoutReturn } = params;

  if (refundWithoutReturn) {
    logger.info({ orderId, returnId }, '[Returns] refundWithoutReturn — tags not detached');
    return { detached: 0, skipped: 0, tagIds: [] };
  }

  let tagObjectIdList = (params.tagIds || [])
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(String(id)));

  if (tagObjectIdList.length === 0) {
    tagObjectIdList = await resolveTagIdsForOrder(orderId);
  }

  if (tagObjectIdList.length === 0) {
    logger.warn({ orderId, returnId }, '[Returns] No tag ids found for return detachment');
    return { detached: 0, skipped: 0, tagIds: [] };
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

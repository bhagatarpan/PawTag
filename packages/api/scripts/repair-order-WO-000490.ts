/**
 * One-time operational repair for order WO-000490.
 *
 * Customer returned 2 of 3 tags (PawTag Scan + PawTag Classic) and was refunded.
 * Return/refund completed before tag-detach existed, so tags still show on
 * Membership Manage "Your Tags".
 *
 * Returned tags (confirmed from order refund lines + tag status pattern):
 *   PT-8WQ669TY (Scan)
 *   PT-NHQ26JBQ (Classic)
 * Kept tag:
 *   PT-NKP4YYZC (Plus — only tag still status=active)
 *
 * Idempotent: already-returned tags are skipped.
 */
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const ORDER_NUMBER = 'WO-000490';
const RETURN_ID = '6ac348b7b035dfdb42f54a84';
const RETURNED_TAG_IDS = ['PT-8WQ669TY', 'PT-NHQ26JBQ'];

async function main() {
  const uri = process.env.DB_URL || process.env.MONGODB_URI;
  if (!uri) throw new Error('DB_URL not configured');

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const { Tag, Return } = await import('@pawtag/db');

  const order = await (await import('@pawtag/db')).Order.findOne({ orderNumber: ORDER_NUMBER }).lean();
  if (!order) throw new Error(`Order ${ORDER_NUMBER} not found`);

  const ret = await Return.findById(RETURN_ID).lean();
  if (!ret) throw new Error(`Return ${RETURN_ID} not found`);

  // Stamp return items with tagIds for future ops visibility
  const tagDocs = await Tag.find({ tagId: { $in: RETURNED_TAG_IDS } }).lean();
  const tagIdByHuman = new Map(tagDocs.map((t) => [t.tagId, t._id]));
  const returnedObjectIds = RETURNED_TAG_IDS
    .map((h) => tagIdByHuman.get(h))
    .filter(Boolean) as mongoose.Types.ObjectId[];

  if (returnedObjectIds.length !== RETURNED_TAG_IDS.length) {
    console.warn('Some returned tag ids not found:', RETURNED_TAG_IDS);
  }

  if (ret.items?.length) {
    // Best-effort: attach all returned tag ids to first line if still empty
    const anyTagIds = ret.items.some((i: any) => (i.tagIds || []).length > 0);
    if (!anyTagIds && returnedObjectIds.length > 0) {
      await Return.updateOne(
        { _id: RETURN_ID },
        { $set: { 'items.0.tagIds': returnedObjectIds } },
      );
      console.log('Stamped Return.items[0].tagIds with returned tag ObjectIds');
    }
  }

  const { detachTagsReturnedToPawTag } = await import('../src/services/returns/tag-return-detach.service');
  const result = await detachTagsReturnedToPawTag({
    orderId: order._id,
    returnId: RETURN_ID,
    tagIds: returnedObjectIds,
    refundWithoutReturn: Boolean(ret.refundWithoutReturn),
  });

  console.log('Detach result:', result);

  const after = await Tag.find({ tagId: { $in: RETURNED_TAG_IDS } }).lean();
  for (const t of after) {
    console.log(t.tagId, {
      status: t.status,
      ownerId: t.ownerId ? String(t.ownerId) : null,
      returnedAt: t.returnedAt || null,
    });
  }

  await mongoose.disconnect();
  console.log('Repair complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

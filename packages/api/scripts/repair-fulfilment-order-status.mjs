/**
 * One-time data repair for order/fulfilment status mismatch.
 *
 * WO-000486: fulfilment is 'fulfilled' but order status was stuck at 'packing'
 * because fulfilment→order sync compared fulfilment names with indexOf() against
 * the order status sequence ('fulfilled' is not an order status → -1 → no update).
 *
 * This script:
 * 1. Finds orders whose linked fulfilment is fulfilled but order is not shipped/delivered
 * 2. Sets order status to 'shipped' when fulfilment is fulfilled
 * 3. Adds an activity entry for the correction
 * 4. Does NOT touch payment, refund, tracking, or tag fields
 *
 * Usage:
 *   node packages/api/scripts/repair-fulfilment-order-status.mjs
 *   node packages/api/scripts/repair-fulfilment-order-status.mjs --dry-run
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes('--dry-run');

function loadDbUrl() {
  if (process.env.DB_URL) return process.env.DB_URL;
  const envPath = path.resolve(__dirname, '../.env');
  const env = fs.readFileSync(envPath, 'utf8');
  const match = env.match(/^DB_URL=(.+)$/m);
  if (!match) throw new Error('DB_URL not found in packages/api/.env or environment');
  return match[1].trim();
}

async function main() {
  const uri = loadDbUrl();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

  const orders = mongoose.connection.collection('orders');
  const fulfilments = mongoose.connection.collection('fulfilments');

  const mismatched = await fulfilments
    .aggregate([
      { $match: { status: 'fulfilled' } },
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: '$order' },
      {
        $match: {
          'order.status': { $nin: ['shipped', 'delivered', 'cancelled', 'refunded'] },
        },
      },
      {
        $project: {
          orderNumber: '$order.orderNumber',
          orderId: '$order._id',
          orderStatus: '$order.status',
          fulfilmentStatus: '$status',
          fulfilledAt: 1,
        },
      },
    ])
    .toArray();

  console.log(`Found ${mismatched.length} order(s) with fulfilled fulfilment but non-shipped order status`);

  for (const row of mismatched) {
    console.log(
      `- ${row.orderNumber}: order=${row.orderStatus} → shipped (fulfilment=${row.fulfilmentStatus})`,
    );
    if (dryRun) continue;

    const result = await orders.updateOne(
      { _id: row.orderId, status: { $nin: ['shipped', 'delivered', 'cancelled', 'refunded'] } },
      {
        $set: { status: 'shipped', updatedAt: new Date() },
        $push: {
          activity: {
            type: 'status_synced',
            message: `Order status repaired to shipped — linked fulfilment was already fulfilled (sync bug fix)`,
            timestamp: new Date(),
            actor: 'system',
          },
        },
      },
    );

    if (result.modifiedCount === 1) {
      console.log(`  ✓ repaired ${row.orderNumber}`);
    } else {
      console.log(`  ~ skipped ${row.orderNumber} (no longer mismatched or terminal)`);
    }
  }

  await mongoose.disconnect();
  console.log(dryRun ? 'Dry run complete — no changes written' : 'Repair complete');
}

main().catch((err) => {
  console.error('Repair failed:', err);
  process.exit(1);
});

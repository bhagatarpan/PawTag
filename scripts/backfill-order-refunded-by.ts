/**
 * Backfill refundedBy audit fields on existing refunded orders.
 *
 * For every order with status 'refunded' that is missing refundedBy,
 * derives the refunded by info from:
 *   1. activity log metadata (type: 'refunded')
 *   2. PaymentTransaction records (type: 'refund')
 *   3. Falls back to admin user who processed it
 *
 * Sets:
 *   - refundedBy          "Dave Macenzie (Admin)"
 *   - refundedByType      "Admin"
 *   - refundedByPortal    "admin-web"
 *   - refundedByDescription  "Order refunded via Admin Web Portal by Dave Macenzie (Admin)"
 *   - refundedAt          timestamp from activity or payment transaction
 *
 * Safe to re-run — only touches orders without refundedBy.
 *
 * Usage: npx tsx scripts/backfill-order-refunded-by.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import '@pawtag/db';

dotenv.config();

function formatRefundedByDescription(portal: string, fullName: string, roleDisplayName: string): string {
  const portalLabel = portal === 'customer-web' ? 'Customer Web Portal' :
    portal === 'customer-mobile' ? 'Customer Mobile App' :
    portal === 'admin-web' ? 'Admin Web Portal' :
    portal === 'system' ? 'System (Auto)' : portal;

  if (portal === 'system') {
    return `Order refunded by System`;
  }
  if (portal.startsWith('customer')) {
    return `Order refunded via ${portalLabel} by ${fullName}`;
  }
  return `Order refunded via ${portalLabel} by ${fullName} (${roleDisplayName})`;
}

function formatRefundedBy(fullName: string, roleDisplayName: string): string {
  if (roleDisplayName.toLowerCase() === 'customer') {
    return `Customer (${fullName})`;
  }
  return `${fullName} (${roleDisplayName})`;
}

async function backfill() {
  const uri = process.env.DB_URL;
  if (!uri) throw new Error('DB_URL not set');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const Order = mongoose.model('Order');
  const PaymentTransaction = mongoose.model('PaymentTransaction');

  const orders = await Order.find({
    status: 'refunded',
    refundedBy: { $exists: false },
  }).sort({ createdAt: 1 }).lean();

  console.log(`Found ${orders.length} refunded orders missing refundedBy fields.\n`);

  if (orders.length === 0) {
    console.log('Nothing to backfill.');
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const order of orders) {
    try {
      // Try to get refund info from activity log first
      const refundActivity = order.activity?.find((a: any) => a.type === 'refunded');
      let refundedBy = null;
      let refundedByType = null;
      let refundedByPortal = 'admin-web';
      let refundedAt = order.refundedAt || (refundActivity?.timestamp ? new Date(refundActivity.timestamp) : new Date());

      if (refundActivity?.metadata) {
        const meta = refundActivity.metadata;
        if (meta.refundedBy) refundedBy = meta.refundedBy;
        if (meta.refundedByType) refundedByType = meta.refundedByType;
        if (meta.refundedByPortal) refundedByPortal = meta.refundedByPortal;
      }

      // Fallback: check PaymentTransaction
      if (!refundedBy) {
        const paymentTx = await PaymentTransaction.findOne({
          orderId: order._id,
          type: 'refund',
        }).sort({ createdAt: -1 }).lean();

        if (paymentTx) {
          refundedBy = paymentTx.initiatedBy === 'admin' ? 'Admin' : paymentTx.initiatedBy;
          refundedByType = paymentTx.initiatedBy === 'admin' ? 'Admin' : 'Unknown';
          refundedAt = paymentTx.createdAt || refundedAt;
        }
      }

      // Final fallback: assume admin
      if (!refundedBy) {
        refundedBy = 'Admin';
        refundedByType = 'Admin';
      }

      const fullName = refundedBy.replace(/ \(.*\)$/, ''); // Remove role suffix if present
      const roleDisplayName = refundedByType || 'Admin';
      const portal = refundedByPortal || 'admin-web';

      const formattedRefundedBy = formatRefundedBy(fullName, roleDisplayName);
      const refundedByDescription = formatRefundedByDescription(portal, fullName, roleDisplayName);

      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            refundedBy: formattedRefundedBy,
            refundedByType: roleDisplayName,
            refundedByPortal: portal,
            refundedByDescription,
            refundedAt,
          },
        },
      );

      console.log(`  [${order.orderNumber}] -> ${formattedRefundedBy} (${roleDisplayName}, ${portal})`);
      updated++;
    } catch (err: any) {
      console.error(`  [${order.orderNumber}] ERROR: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
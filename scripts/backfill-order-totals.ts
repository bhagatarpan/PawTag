/**
 * Backfill order price breakdown for invoices.
 *
 * Infers subtotal, shippingCost, tax, and discount from existing order data
 * so that the enhanced invoice template can display the full breakdown.
 *
 * Safe to re-run — only updates orders where subtotal is null.
 *
 * Usage: npx tsx scripts/backfill-order-totals.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import '@pawtag/db';

dotenv.config();

const GST_RATE = 0.15;

async function backfill() {
  const uri = process.env.DB_URL;
  if (!uri) throw new Error('DB_URL not set');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const Order = mongoose.model('Order');

  const orders = await Order.find({ subtotal: { $exists: false } }).sort({ createdAt: 1 }).lean();
  console.log(`Found ${orders.length} orders to backfill\n`);

  if (orders.length === 0) {
    console.log('Nothing to backfill.');
    await mongoose.disconnect();
    return;
  }

  let updated = 0;

  for (const order of orders) {
    const itemsTotal = order.items?.reduce((s: number, i: any) => s + (i.totalPrice || 0), 0) || 0;
    const total = order.payment?.amount || 0;

    // GST-inclusive decomposition
    const tax = Math.round(total * GST_RATE / (1 + GST_RATE) * 100) / 100;

    let subtotal = itemsTotal;
    let shipping = 0;
    let discount = 0;

    if (total < itemsTotal) {
      // Discount was applied
      discount = Math.round((itemsTotal - total) * 100) / 100;
      shipping = 0;
    } else if (total > itemsTotal) {
      // Shipping was charged
      shipping = Math.round((total - itemsTotal) * 100) / 100;
    }

    console.log(`${order.orderNumber}:`);
    console.log(`  itemsTotal=${itemsTotal.toFixed(2)} -> subtotal=${subtotal.toFixed(2)}, shipping=${shipping.toFixed(2)}, discount=${discount.toFixed(2)}, tax=${tax.toFixed(2)}`);

    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          subtotal,
          shippingCost: shipping,
          tax,
          ...(discount > 0 ? { discount: { percent: 0, amount: discount, reason: '' } } : {}),
        },
      },
    );

    updated++;
  }

  console.log(`\nBackfilled ${updated} orders.`);
  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});

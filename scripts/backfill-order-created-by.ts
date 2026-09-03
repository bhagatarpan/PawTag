/**
 * Backfill createdBy audit fields on existing orders.
 *
 * For every order missing createdBy, resolves the creator from the linked
 * User document and populates:
 *   - createdBy          "Customer (Full Name)"
 *   - createdByType      "Customer"
 *   - createdByPortal    "customer-web"
 *   - createdByDescription  "Order placed via Customer Web Portal by Full Name"
 *   - createdByEmail     user's email
 *
 * Safe to re-run — only updates orders where createdBy is null/missing.
 *
 * Usage: npx tsx scripts/backfill-order-created-by.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import '@pawtag/db';

dotenv.config();

async function backfill() {
  const uri = process.env.DB_URL;
  if (!uri) throw new Error('DB_URL not set');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const Order = mongoose.model('Order');
  const User = mongoose.model('User');

  const orders = await Order.find({ createdBy: { $exists: false } }).sort({ createdAt: 1 }).lean();
  console.log(`Found ${orders.length} orders to backfill\n`);

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
      const user = await User.findById(order.userId).select('fullName email').lean();

      const fullName = user?.fullName || 'Unknown User';
      const email = user?.email || null;
      const createdBy = `Customer (${fullName})`;
      const createdByDescription = `Order placed via Customer Web Portal by ${fullName}`;

      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            createdBy,
            createdByType: 'Customer',
            createdByPortal: 'customer-web',
            createdByDescription,
            createdByEmail: email,
          },
        },
      );

      console.log(`  [${order.orderNumber}] ${createdBy} (${email || 'no email'})`);
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

/**
 * Data migration: Fix orphaned cancelled subscriptions
 *
 * Before this migration, cancelSubscription() never set status to 'cancelled'.
 * This resulted in subscriptions with cancelledAt set but status still 'active'.
 * This script fixes those records by setting status to 'cancelled'.
 *
 * Run: npx tsx scripts/migrate-fix-cancelled-subs.ts
 */

import mongoose from 'mongoose';

const DB_URL = process.env.DB_URL;
if (!DB_URL) {
  console.error('DB_URL environment variable is required');
  process.exit(1);
}

async function migrate() {
  console.log('Connecting to database...');
  await mongoose.connect(DB_URL);
  console.log('Connected.');

  const subscriptions = mongoose.connection.db!.collection('subscriptions');

  // Find subscriptions that have cancelledAt set but status is still 'active'
  const orphaned = await subscriptions.countDocuments({
    cancelledAt: { $exists: true, $ne: null },
    status: 'active',
  });

  console.log(`Found ${orphaned} orphaned cancelled subscriptions (cancelledAt set but status='active')`);

  if (orphaned === 0) {
    console.log('No migration needed.');
    await mongoose.disconnect();
    return;
  }

  const result = await subscriptions.updateMany(
    { cancelledAt: { $exists: true, $ne: null }, status: 'active' },
    { $set: { status: 'cancelled' } },
  );

  console.log(`Migration complete. Updated ${result.modifiedCount} subscriptions from 'active' to 'cancelled'.`);

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

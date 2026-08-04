/**
 * MongoDB Index Migration Script
 * 
 * Run: npx tsx scripts/create-indexes.ts
 * 
 * Creates all production indexes. Safe to run multiple times (skips existing indexes).
 * Connects to DB_URL from packages/api/.env or environment variable.
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';

// Load .env from packages/api
config({ path: path.resolve(__dirname, '../packages/api/.env') });

async function createIndexes() {
  const uri = process.env.DB_URL;
  if (!uri) {
    console.error('ERROR: DB_URL environment variable is required');
    console.error('Set it in packages/api/.env or as an environment variable');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected.\n');

  const db = mongoose.connection.db!;
  const collections = await db.listCollections().toArray();
  const collectionNames = new Set(collections.map(c => c.name));

  let created = 0;
  let skipped = 0;

  async function ensureIndex(
    collectionName: string,
    indexSpec: Record<string, 1 | -1>,
    options: Record<string, any> = {}
  ) {
    if (!collectionNames.has(collectionName)) {
      console.log(`  SKIP [${collectionName}] — collection does not exist`);
      skipped++;
      return;
    }

    const coll = db.collection(collectionName);
    const existingIndexes = await coll.indexes();
    const indexName = options.name || Object.entries(indexSpec)
      .map(([k, v]) => `${k}_${v}`)
      .join('_');

    const exists = existingIndexes.some(idx => idx.name === indexName);
    if (exists) {
      skipped++;
      return;
    }

    await coll.createIndex(indexSpec, { name: indexName, ...options });
    created++;
    console.log(`  CREATED [${collectionName}] ${indexName}`);
  }

  console.log('Ensuring indexes...\n');

  // --- HIGH PRIORITY ---

  console.log('=== HIGH PRIORITY ===');

  // Subscription: stripeSubscriptionId (Stripe webhook lookups)
  await ensureIndex('subscriptions', { stripeSubscriptionId: 1 });

  // User: phoneNumber (phone login, OTP)
  await ensureIndex('users', { phoneNumber: 1 });

  // Invoice: subscriptionId + createdAt (subscription detail views)
  await ensureIndex('invoices', { subscriptionId: 1, createdAt: -1 });

  // --- MEDIUM PRIORITY ---

  console.log('\n=== MEDIUM PRIORITY ===');

  // Subscription: compound indexes
  await ensureIndex('subscriptions', { userId: 1, status: 1, currentPeriodEnd: -1 });
  await ensureIndex('subscriptions', { status: 1, currentPeriodEnd: 1, autoRenew: 1, deletedAt: 1 });

  // Order: compound indexes
  await ensureIndex('orders', { userId: 1, createdAt: -1 });
  await ensureIndex('orders', { status: 1, createdAt: -1 });

  // Invoice: compound indexes
  await ensureIndex('invoices', { userId: 1, subscriptionId: 1, createdAt: -1 });

  // Tag: compound indexes
  await ensureIndex('tags', { petId: 1, deletedAt: 1 });
  await ensureIndex('tags', { ownerId: 1, deletedAt: 1 });

  // Pet: compound indexes
  await ensureIndex('pets', { ownerId: 1, deletedAt: 1, createdAt: -1 });
  await ensureIndex('pets', { status: 1, deletedAt: 1 });
  await ensureIndex('pets', { status: 1, foundByFinderAt: 1, deletedAt: 1 });

  // FinderScan: compound indexes
  await ensureIndex('finderscans', { petId: 1, action: 1, notifiedAt: -1 });
  await ensureIndex('finderscans', { createdAt: -1 });

  // Referral: compound indexes
  await ensureIndex('referrals', { orderId: 1, status: 1 });
  await ensureIndex('referrals', { referrerId: 1, status: 1 });

  // TagExpiryNotification
  await ensureIndex('tagexpirynotifications', { acknowledged: 1, daysUntilExpiry: 1 });

  // --- SUMMARY ---

  console.log(`\nDone. ${created} created, ${skipped} skipped (already exist).`);

  await mongoose.disconnect();
  process.exit(0);
}

createIndexes().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

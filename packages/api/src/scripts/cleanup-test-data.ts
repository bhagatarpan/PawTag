import { connectDatabase } from '@pawtag/db';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PRESERVED_USER_EMAILS = ['admin@pawtag.co.nz'];

async function cleanupTestData() {
  console.log('🧹 Starting test data cleanup...\n');

  const db = mongoose.connection;

  // Helper to count and delete
  async function cleanCollection(name: string, filter: any = {}) {
    const collection = db.collection(name);
    const count = await collection.countDocuments(filter);
    if (count > 0) {
      await collection.deleteMany(filter);
      console.log(`  ✅ Deleted ${count} documents from ${name}`);
    } else {
      console.log(`  ⚪ No documents in ${name}`);
    }
    return count;
  }

  // Helper to delete ALL documents
  async function cleanAll(name: string) {
    return cleanCollection(name, {});
  }

  // 1. Get admin user IDs to preserve
  const usersCollection = db.collection('users');
  const adminUsers = await usersCollection.find({
    $or: [
      { email: { $in: PRESERVED_USER_EMAILS } },
      { role: 'super_admin' },
    ],
  }).toArray();
  const adminUserIds = adminUsers.map((u: any) => u._id);
  console.log(`\n🔒 Preserving ${adminUserIds.length} admin account(s)\n`);

  // 2. Get all non-admin user IDs
  const allUsers = await usersCollection.find({}).toArray();
  const customerUserIds = allUsers
    .filter((u: any) => !adminUserIds.some((adminId: any) => adminId.equals(u._id)))
    .map((u: any) => u._id);
  console.log(`👤 Found ${customerUserIds.length} customer account(s) to delete\n`);

  // 3. Delete in dependency order

  console.log('Deleting notifications...');
  await cleanCollection('notifications', { userId: { $in: customerUserIds } });

  console.log('\nDeleting finder data...');
  const customerTags = await db.collection('tags').find({ ownerId: { $in: customerUserIds } }).toArray();
  const customerTagIds = customerTags.map((t: any) => t._id);
  await cleanCollection('finderscans', { tagId: { $in: customerTagIds } });
  await cleanCollection('locationevents', { tagId: { $in: customerTagIds } });
  await cleanCollection('escalationrecords', { tagId: { $in: customerTagIds } });

  console.log('\nDeleting commerce data...');
  await cleanCollection('subscriptions', { userId: { $in: customerUserIds } });
  await cleanCollection('orders', { userId: { $in: customerUserIds } });
  await cleanCollection('carts', { userId: { $in: customerUserIds } });
  await cleanCollection('invoices', { userId: { $in: customerUserIds } });
  await cleanCollection('paymenttransactions', { userId: { $in: customerUserIds } });
  await cleanCollection('pendingorders', { userId: { $in: customerUserIds } });
  await cleanCollection('pendingrefundretries', {});
  await cleanCollection('stockmovements', {});
  await cleanCollection('shipments', {});
  await cleanCollection('fulfilments', {});
  await cleanCollection('returns', {});
  await cleanCollection('invoiceaccesstokens', {});

  console.log('\nDeleting pet/tag data...');
  await cleanCollection('pets', { ownerId: { $in: customerUserIds } });
  await cleanCollection('tags', { ownerId: { $in: customerUserIds } });

  console.log('\nDeleting loyalty/rewards data...');
  await cleanCollection('guardianpointsledgers', { userId: { $in: customerUserIds } });
  await cleanCollection('guardiantierhistories', { userId: { $in: customerUserIds } });
  await cleanCollection('pawrewardsledgers', { userId: { $in: customerUserIds } });
  await cleanCollection('referrals', { userId: { $in: customerUserIds } });
  await cleanCollection('referralcodes', { userId: { $in: customerUserIds } });
  await cleanCollection('usermemberships', { userId: { $in: customerUserIds } });

  console.log('\nDeleting user-related data...');
  await cleanCollection('userroles', { userId: { $in: customerUserIds } });
  await cleanCollection('refreshtokens', { userId: { $in: customerUserIds } });
  await cleanCollection('verificationtokens', {});
  await cleanCollection('pushtokens', { userId: { $in: customerUserIds } });
  await cleanCollection('tagexpirynotifications', {});

  console.log('\nDeleting customer accounts...');
  await cleanCollection('users', { _id: { $in: customerUserIds } });

  console.log('\nDeleting operational logs...');
  await cleanAll('auditevents');
  await cleanAll('systemlogs');
  await cleanAll('emailaudits');
  await cleanAll('webhookevents');
  await cleanAll('supportrequests');

  console.log('\nClearing job locks...');
  await cleanAll('job_locks');

  // 4. Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ Cleanup complete!');
  console.log('='.repeat(50));
  console.log(`\nPreserved:`);
  console.log(`  - ${adminUserIds.length} admin account(s)`);
  console.log(`  - All RBAC data (roles, permissions)`);
  console.log(`  - All settings`);
  console.log(`  - All CMS content`);
  console.log(`  - All products`);
  console.log(`  - All membership tiers`);
  console.log(`  - All background job configs`);
  console.log(`\nDeleted:`);
  console.log(`  - ${customerUserIds.length} customer account(s)`);
  console.log(`  - All related data (pets, tags, orders, subscriptions, etc.)`);
  console.log(`  - All operational logs`);
  console.log(`\nNext steps:`);
  console.log(`  1. pnpm seed (RBAC + admin)`);
  console.log(`  2. pnpm seed:cms (CMS content)`);
  console.log(`  3. pnpm seed:products (Products)`);
  console.log(`  4. pnpm seed:memberships (Membership tiers)`);
  console.log(`  5. Restart API server`);
}

// Run
connectDatabase()
  .then(() => cleanupTestData())
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });

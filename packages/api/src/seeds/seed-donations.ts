/**
 * Seed donation settings + RBAC permissions.
 * Usage: pnpm --filter @pawtag/api exec tsx src/seeds/seed-donations.ts
 *
 * - Settings: $setOnInsert only (never overwrite admin edits)
 * - Permissions: donation.read / donation.receipts / donation.refund
 * - Assigns those permissions to Super Admin roles (and any role named CSR/Donation)
 */
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

import { connectDatabase, disconnectDatabase } from '@pawtag/db';
import { seedDonationSettingsIfMissing } from '../services/donation/donation-config';

const DONATION_PERMISSIONS = [
  {
    name: 'donation.read',
    displayName: 'Read Donations',
    description: 'View donation list and search',
    resource: 'donation',
    action: 'read',
  },
  {
    name: 'donation.receipts',
    displayName: 'Donation Receipts',
    description: 'View, download, and email donation receipts',
    resource: 'donation',
    action: 'receipts',
  },
  {
    name: 'donation.refund',
    displayName: 'Refund Donations',
    description: 'Process donation refunds',
    resource: 'donation',
    action: 'refund',
  },
] as const;

async function ensurePermissionGroup(): Promise<mongoose.Types.ObjectId> {
  const col = mongoose.connection.collection('permissiongroups');
  const existing = await col.findOne({ name: 'DONATION_MANAGEMENT' });
  if (existing?._id) return existing._id as mongoose.Types.ObjectId;

  const inserted = await col.insertOne({
    name: 'DONATION_MANAGEMENT',
    displayName: 'Donation Management',
    description: 'Manage donations and donation receipts',
    icon: 'Heart',
    sortOrder: 270,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return inserted.insertedId as mongoose.Types.ObjectId;
}

async function ensurePermissions(groupId: mongoose.Types.ObjectId): Promise<Map<string, mongoose.Types.ObjectId>> {
  const col = mongoose.connection.collection('permissions');
  const map = new Map<string, mongoose.Types.ObjectId>();

  for (const p of DONATION_PERMISSIONS) {
    const existing = await col.findOne({ name: p.name });
    if (existing?._id) {
      map.set(p.name, existing._id as mongoose.Types.ObjectId);
      continue;
    }
    const inserted = await col.insertOne({
      ...p,
      permissionGroupId: groupId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    map.set(p.name, inserted.insertedId as mongoose.Types.ObjectId);
  }
  return map;
}

async function assignToRoles(perms: Map<string, mongoose.Types.ObjectId>): Promise<void> {
  const rolesCol = mongoose.connection.collection('roles');
  const rpCol = mongoose.connection.collection('rolepermissions');

  // Super Admin + any donation/CSR-named roles
  const roles = await rolesCol
    .find({
      $or: [
        { isSuperAdmin: true },
        { name: { $in: ['SUPER_ADMIN', 'DONATION_CSR', 'CUSTOMER_SERVICE', 'ADMIN'] } },
        { name: { $regex: /donation|csr/i } },
      ],
    })
    .toArray();

  for (const role of roles) {
    for (const [, permId] of perms) {
      const existing = await rpCol.findOne({
        roleId: role._id,
        permissionId: permId,
      });
      if (existing) continue;
      await rpCol.insertOne({
        roleId: role._id,
        permissionId: permId,
        scopeId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    console.log(`Assigned donation permissions to role: ${role.name}`);
  }
}

async function main() {
  await connectDatabase();
  await seedDonationSettingsIfMissing();
  console.log('Donation settings ensured');

  const groupId = await ensurePermissionGroup();
  const perms = await ensurePermissions(groupId);
  console.log('Donation permissions ensured:', [...perms.keys()]);

  await assignToRoles(perms);
  console.log('Donation permissions assigned to admin/CSR roles');

  await disconnectDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

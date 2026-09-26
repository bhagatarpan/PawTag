/**
 * @module HYBRID 2 Data Migration Script
 * @description Migration script for implementing the HYBRID 2 model.
 *
 * This script:
 * 1. Deletes existing subscriptions, orders, invoices for tag products
 * 2. Deletes existing tags
 * 3. Adds new fields to models with defaults
 * 4. Updates MembershipTier with tag limits
 *
 * WARNING: This is a DESTRUCTIVE migration. Run in controlled environment with backups.
 *
 * Usage:
 *   pnpm --filter @pawtag/api exec tsx ../../scripts/migrate-hybrid2.ts
 *
 * Environment variables:
 *   - DB_URL: MongoDB connection string
 *   - DRY_RUN: Set to 'true' to preview changes without executing
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Subscription, Tag, Invoice, Product, MembershipTier, UserMembership, Order, PendingOrder, Fulfilment, Shipment, FinderScan, EscalationRecord } from '@pawtag/db';

dotenv.config({ path: path.resolve(__dirname, '../packages/api/.env') });

const DRY_RUN = process.env.DRY_RUN === 'true';
const DB_URL = process.env.DB_URL || 'mongodb://localhost:27017/pawtag';

// ─── Helper Functions ─────────────────────────────────────────

async function connect() {
  console.log(`Connecting to ${DB_URL}...`);
  await mongoose.connect(DB_URL);
  console.log('Connected to MongoDB');
}

async function disconnect() {
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

function log(message: string) {
  console.log(`[HYBRID2] ${message}`);
}

function logWarning(message: string) {
  console.warn(`[HYBRID2 WARNING] ${message}`);
}

function logDryRun(message: string) {
  console.log(`[HYBRID2 DRY RUN] ${message}`);
}

// ─── Migration Steps ──────────────────────────────────────────

/**
 * Step 1: Delete existing subscriptions for tag products
 */
async function deleteTagSubscriptions(): Promise<number> {
  log('Step 1: Deleting existing tag subscriptions...');
  
  const count = await Subscription.countDocuments({ planType: { $in: ['annual', 'monthly'] } });
  
  if (DRY_RUN) {
    logDryRun(`Would delete ${count} subscriptions`);
    return count;
  }
  
  const result = await Subscription.deleteMany({ planType: { $in: ['annual', 'monthly'] } });
  log(`Deleted ${result.deletedCount} subscriptions`);
  return result.deletedCount;
}

/**
 * Step 2: Delete existing tags
 */
async function deleteTags(): Promise<number> {
  log('Step 2: Deleting existing tags...');
  
  const count = await Tag.countDocuments({});
  
  if (DRY_RUN) {
    logDryRun(`Would delete ${count} tags`);
    return count;
  }
  
  const result = await Tag.deleteMany({});
  log(`Deleted ${result.deletedCount} tags`);
  return result.deletedCount;
}

/**
 * Step 3: Delete existing invoices
 */
async function deleteTagInvoices(): Promise<number> {
  log('Step 3: Deleting existing invoices...');
  
  const count = await Invoice.countDocuments({});
  
  if (DRY_RUN) {
    logDryRun(`Would delete ${count} invoices`);
    return count;
  }
  
  const result = await Invoice.deleteMany({});
  log(`Deleted ${result.deletedCount} invoices`);
  return result.deletedCount;
}

/**
 * Step 3b: Delete existing orders
 */
async function deleteOrders(): Promise<number> {
  log('Step 3b: Deleting existing orders...');
  
  const count = await Order.countDocuments({});
  
  if (DRY_RUN) {
    logDryRun(`Would delete ${count} orders`);
    return count;
  }
  
  const result = await Order.deleteMany({});
  log(`Deleted ${result.deletedCount} orders`);
  return result.deletedCount;
}

/**
 * Step 3c: Delete pending orders
 */
async function deletePendingOrders(): Promise<number> {
  log('Step 3c: Deleting pending orders...');
  
  const count = await PendingOrder.countDocuments({});
  
  if (DRY_RUN) {
    logDryRun(`Would delete ${count} pending orders`);
    return count;
  }
  
  const result = await PendingOrder.deleteMany({});
  log(`Deleted ${result.deletedCount} pending orders`);
  return result.deletedCount;
}

/**
 * Step 3d: Delete fulfilments and shipments
 */
async function deleteFulfilmentsAndShipments(): Promise<number> {
  log('Step 3d: Deleting fulfilments and shipments...');
  
  const fulfilmentCount = await Fulfilment.countDocuments({});
  const shipmentCount = await Shipment.countDocuments({});
  
  if (DRY_RUN) {
    logDryRun(`Would delete ${fulfilmentCount} fulfilments and ${shipmentCount} shipments`);
    return fulfilmentCount + shipmentCount;
  }
  
  const fulfilmentResult = await Fulfilment.deleteMany({});
  const shipmentResult = await Shipment.deleteMany({});
  log(`Deleted ${fulfilmentResult.deletedCount} fulfilments and ${shipmentResult.deletedCount} shipments`);
  return fulfilmentResult.deletedCount + shipmentResult.deletedCount;
}

/**
 * Step 3e: Delete finder scans and escalation records
 */
async function deleteFinderData(): Promise<number> {
  log('Step 3e: Deleting finder scans and escalation records...');
  
  const scanCount = await FinderScan.countDocuments({});
  const escalationCount = await EscalationRecord.countDocuments({});
  
  if (DRY_RUN) {
    logDryRun(`Would delete ${scanCount} finder scans and ${escalationCount} escalation records`);
    return scanCount + escalationCount;
  }
  
  const scanResult = await FinderScan.deleteMany({});
  const escalationResult = await EscalationRecord.deleteMany({});
  log(`Deleted ${scanResult.deletedCount} finder scans and ${escalationResult.deletedCount} escalation records`);
  return scanResult.deletedCount + escalationResult.deletedCount;
}

/**
 * Step 4: Update Product model with new fields
 */
async function updateProducts(): Promise<number> {
  log('Step 4: Updating Product model with new fields...');
  
  if (DRY_RUN) {
    const count = await Product.countDocuments({ isTagProduct: true });
    logDryRun(`Would update ${count} tag products with activePeriodMonths: 3`);
    return count;
  }
  
  const result = await Product.updateMany(
    { isTagProduct: true },
    { $set: { activePeriodMonths: 3 } }
  );
  log(`Updated ${result.modifiedCount} tag products with activePeriodMonths: 3`);
  return result.modifiedCount;
}

/**
 * Step 5: Update MembershipTier with tag limits
 */
async function updateMembershipTiers(): Promise<number> {
  log('Step 5: Updating MembershipTier with tag limits...');
  
  if (DRY_RUN) {
    logDryRun('Would update MembershipTier with tag limits: Gold=3, Platinum=10, Black=999');
    return 3;
  }
  
  const goldResult = await MembershipTier.updateMany(
    { tier: 'gold' },
    { $set: { tagLimit: 3 } }
  );
  
  const platinumResult = await MembershipTier.updateMany(
    { tier: 'platinum' },
    { $set: { tagLimit: 10 } }
  );
  
  const blackResult = await MembershipTier.updateMany(
    { tier: 'black' },
    { $set: { tagLimit: 999 } }
  );
  
  const total = goldResult.modifiedCount + platinumResult.modifiedCount + blackResult.modifiedCount;
  log(`Updated ${total} membership tiers with tag limits`);
  return total;
}

/**
 * Step 6: Clean up UserMembership extendedTagIds
 */
async function cleanUserMemberships(): Promise<number> {
  log('Step 6: Cleaning UserMembership extendedTagIds...');
  
  if (DRY_RUN) {
    const count = await UserMembership.countDocuments({});
    logDryRun(`Would clean ${count} user memberships`);
    return count;
  }
  
  const result = await UserMembership.updateMany(
    {},
    { $set: { extendedTagIds: [] } }
  );
  log(`Cleaned ${result.modifiedCount} user memberships`);
  return result.modifiedCount;
}

// ─── Main Migration ───────────────────────────────────────────

async function migrate() {
  const startTime = Date.now();
  
  log('Starting HYBRID 2 migration...');
  if (DRY_RUN) {
    logWarning('DRY RUN MODE - No changes will be made');
  }
  
  try {
    await connect();
    
    // Execute migration steps - delete all existing commerce data
    const deletedSubscriptions = await deleteTagSubscriptions();
    const deletedTags = await deleteTags();
    const deletedInvoices = await deleteTagInvoices();
    const deletedOrders = await deleteOrders();
    const deletedPendingOrders = await deletePendingOrders();
    const deletedFulfilments = await deleteFulfilmentsAndShipments();
    const deletedFinderData = await deleteFinderData();
    
    // Update models with new fields
    const updatedProducts = await updateProducts();
    const updatedTiers = await updateMembershipTiers();
    const cleanedMemberships = await cleanUserMemberships();
    
    // Summary
    const duration = Date.now() - startTime;
    log('Migration completed successfully!');
    log('Summary:');
    log(`  - Deleted ${deletedSubscriptions} subscriptions`);
    log(`  - Deleted ${deletedTags} tags`);
    log(`  - Deleted ${deletedInvoices} invoices`);
    log(`  - Deleted ${deletedOrders} orders`);
    log(`  - Deleted ${deletedPendingOrders} pending orders`);
    log(`  - Deleted ${deletedFulfilments} fulfilments/shipments`);
    log(`  - Deleted ${deletedFinderData} finder scans/escalations`);
    log(`  - Updated ${updatedProducts} products`);
    log(`  - Updated ${updatedTiers} membership tiers`);
    log(`  - Cleaned ${cleanedMemberships} user memberships`);
    log(`  - Duration: ${duration}ms`);
    
    if (DRY_RUN) {
      logWarning('DRY RUN MODE - No changes were made');
    }
  } catch (error) {
    console.error('[HYBRID2] Migration failed:', error);
    process.exit(1);
  } finally {
    await disconnect();
  }
}

// Run migration
migrate();

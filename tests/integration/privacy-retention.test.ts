import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import { FinderScan, LocationEvent, EscalationRecord } from '../../packages/db/src';
import { runPrivacyRetentionCleanup, RETENTION_CONFIG } from '../../packages/api/src/jobs/privacyRetention';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

// ═══════════════════════════════════════════
// PRIVACY RETENTION CLEANUP
// ═══════════════════════════════════════════

describe('Integration: Privacy Retention Cleanup', () => {
  it('anonymizes finder contact info for resolved incidents', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const petId = new mongoose.Types.ObjectId();
    const tagId = new mongoose.Types.ObjectId();

    // Create a resolved escalation older than retention period
    const resolvedAt = new Date(Date.now() - (RETENTION_CONFIG.finderContactRetentionDays + 1) * 24 * 60 * 60 * 1000);

    const scan = await FinderScan.create({
      tagId,
      petId,
      deviceInfo: 'Mozilla/5.0',
      action: 'notified_owner',
      finderPhone: '+64211111111',
      finderEmail: 'finder@example.com',
      finderName: 'John Finder',
    });

    await EscalationRecord.create({
      petId,
      ownerId,
      tagId,
      finderScanId: scan._id,
      status: 'resolved',
      foundAt: resolvedAt,
      ownerNotifiedAt: resolvedAt,
      escalationDeadline: new Date(resolvedAt.getTime() + 30 * 60 * 1000),
      resolvedAt,
      resolvedBy: 'owner',
      finderPhone: '+64211111111',
      finderEmail: 'finder@example.com',
      finderName: 'John Finder',
    });

    // Run cleanup
    const results = await runPrivacyRetentionCleanup();
    expect(results.finderContactsAnonymized).toBeGreaterThanOrEqual(1);

    // Verify anonymization
    const updatedScan = await FinderScan.findById(scan._id);
    expect(updatedScan?.finderPhone).toBe('[anonymized]');
    expect(updatedScan?.finderEmail).toBe('[anonymized]');
    expect(updatedScan?.finderName).toBe('[anonymized]');
  });

  it('does NOT anonymize active incidents', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const petId = new mongoose.Types.ObjectId();
    const tagId = new mongoose.Types.ObjectId();

    // Create an active (pending) escalation
    const scan = await FinderScan.create({
      tagId,
      petId,
      deviceInfo: 'Mozilla/5.0',
      action: 'notified_owner',
      finderPhone: '+64211111111',
      finderEmail: 'finder@example.com',
      finderName: 'John Finder',
    });

    await EscalationRecord.create({
      petId,
      ownerId,
      tagId,
      finderScanId: scan._id,
      status: 'pending',
      foundAt: new Date(),
      ownerNotifiedAt: new Date(),
      escalationDeadline: new Date(Date.now() + 30 * 60 * 1000),
      finderPhone: '+64211111111',
      finderEmail: 'finder@example.com',
      finderName: 'John Finder',
    });

    // Run cleanup
    await runPrivacyRetentionCleanup();

    // Verify NOT anonymized
    const updatedScan = await FinderScan.findById(scan._id);
    expect(updatedScan?.finderPhone).toBe('+64211111111');
    expect(updatedScan?.finderEmail).toBe('finder@example.com');
  });

  it('anonymizes old IP locations', async () => {
    const petId = new mongoose.Types.ObjectId();
    const tagId = new mongoose.Types.ObjectId();

    // Create a scan and manually set old createdAt using raw MongoDB
    const scan = await FinderScan.create({
      tagId,
      petId,
      deviceInfo: 'Mozilla/5.0',
      action: 'viewed',
      ipLocation: {
        city: 'Auckland',
        region: 'Auckland',
        country: 'NZ',
        latitude: -36.8485,
        longitude: 174.7633,
      },
    });

    // Use raw collection to bypass Mongoose timestamp protection
    const oldDate = new Date(Date.now() - (RETENTION_CONFIG.ipLocationRetentionDays + 1) * 24 * 60 * 60 * 1000);
    await mongoose.connection.collections.finderscans.updateOne(
      { _id: scan._id },
      { $set: { createdAt: oldDate } }
    );

    // Run cleanup
    const results = await runPrivacyRetentionCleanup();
    expect(results.ipLocationsAnonymized).toBeGreaterThanOrEqual(1);

    // Verify anonymization
    const updatedScan = await FinderScan.findById(scan._id);
    expect(updatedScan?.ipLocation?.latitude).toBeUndefined();
    expect(updatedScan?.ipLocation?.longitude).toBeUndefined();
    expect(updatedScan?.ipLocation?.city).toBeUndefined();
  });

  it('cleanup is idempotent', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const petId = new mongoose.Types.ObjectId();
    const tagId = new mongoose.Types.ObjectId();

    const resolvedAt = new Date(Date.now() - (RETENTION_CONFIG.finderContactRetentionDays + 1) * 24 * 60 * 60 * 1000);

    const scan = await FinderScan.create({
      tagId,
      petId,
      deviceInfo: 'Mozilla/5.0',
      action: 'notified_owner',
      finderPhone: '+64211111111',
      finderEmail: 'finder@example.com',
    });

    await EscalationRecord.create({
      petId,
      ownerId,
      tagId,
      finderScanId: scan._id,
      status: 'resolved',
      foundAt: resolvedAt,
      ownerNotifiedAt: resolvedAt,
      escalationDeadline: new Date(resolvedAt.getTime() + 30 * 60 * 1000),
      resolvedAt,
      resolvedBy: 'owner',
      finderPhone: '+64211111111',
      finderEmail: 'finder@example.com',
    });

    // Run cleanup twice
    await runPrivacyRetentionCleanup();
    await runPrivacyRetentionCleanup();

    // Should not throw or create errors
    const updatedScan = await FinderScan.findById(scan._id);
    expect(updatedScan?.finderPhone).toBe('[anonymized]');
  });
});

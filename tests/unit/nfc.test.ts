import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { Tag } from '@pawtag/db';
import { setupTestDb, teardownTestDb, clearDb } from '../integration/setup';

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

describe('Phase 12 — NFC Support', () => {
  describe('Tag nfcEnabled field', () => {
    it('should default nfcEnabled to false', async () => {
      const tag = await Tag.create({
        tagId: 'PT-NFC-TEST-001',
        tagType: 'qr',
        status: 'inactive',
      });

      expect(tag.nfcEnabled).toBe(false);
    });

    it('should allow setting nfcEnabled to true', async () => {
      const tag = await Tag.create({
        tagId: 'PT-NFC-TEST-002',
        tagType: 'qr',
        nfcEnabled: true,
        status: 'inactive',
      });

      expect(tag.nfcEnabled).toBe(true);
    });

    it('should allow updating nfcEnabled from false to true', async () => {
      const tag = await Tag.create({
        tagId: 'PT-NFC-TEST-003',
        tagType: 'qr',
        status: 'inactive',
      });

      expect(tag.nfcEnabled).toBe(false);

      tag.nfcEnabled = true;
      await tag.save();

      const updated = await Tag.findById(tag._id);
      expect(updated!.nfcEnabled).toBe(true);
    });
  });
});

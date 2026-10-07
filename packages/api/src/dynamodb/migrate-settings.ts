/**
 * Phase 12 — Settings → DynamoDB migration tool.
 *
 * Copies Setting documents from MongoDB to DynamoDB.
 * - Idempotent PutItem by key
 * - Dry-run mode
 * - Never deletes MongoDB data
 * - Checkpoint file for resume
 *
 * Usage (from repo root):
 *   pnpm --filter @pawtag/api exec tsx src/dynamodb/migrate-settings.ts --dry-run
 *   pnpm --filter @pawtag/api exec tsx src/dynamodb/migrate-settings.ts
 *   pnpm --filter @pawtag/api exec tsx src/dynamodb/migrate-settings.ts --compare
 */
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

import { connectDatabase, disconnectDatabase } from '@pawtag/db';
import {
  MongoSettingRepository,
  DynamoSettingRepository,
  getDynamoDocumentClient,
  getSettingsTableName,
  isDynamoConfigured,
  normalizeSetting,
} from '@pawtag/db';

const CHECKPOINT = path.join(__dirname, '.settings-migration-checkpoint.json');

function loadCheckpoint(): { lastKey?: string; migrated: number } {
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'));
  } catch {
    return { migrated: 0 };
  }
}

function saveCheckpoint(cp: { lastKey?: string; migrated: number }): void {
  fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const compareOnly = args.includes('--compare');

  if (!isDynamoConfigured()) {
    console.error('AWS credentials not configured. Set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in packages/api/.env.local');
    process.exit(1);
  }

  await connectDatabase();
  const mongoRepo = new MongoSettingRepository();
  const dynamoRepo = new DynamoSettingRepository(getDynamoDocumentClient(), getSettingsTableName());

  // Read all settings from Mongo via raw collection for simple full scan
  const docs = await mongoose.connection.collections.settings
    .find({})
    .sort({ key: 1 })
    .toArray();

  console.log(`Found ${docs.length} settings in MongoDB`);
  console.log(`DynamoDB table: ${getSettingsTableName()}`);

  if (compareOnly) {
    let match = 0;
    let mismatch = 0;
    let missing = 0;
    for (const doc of docs) {
      const mongoRec = {
        key: doc.key,
        value: doc.value,
        displayValue: doc.displayValue || undefined,
        category: doc.category,
        description: doc.description || undefined,
        updatedBy: doc.updatedBy ? String(doc.updatedBy) : undefined,
      };
      const dyn = await dynamoRepo.getByKey(doc.key);
      if (!dyn) {
        missing++;
        console.log(`MISSING in DynamoDB: ${doc.key}`);
        continue;
      }
      const a = normalizeSetting(mongoRec);
      const b = normalizeSetting(dyn);
      if (JSON.stringify(a) === JSON.stringify(b)) match++;
      else {
        mismatch++;
        console.log(`MISMATCH ${doc.key}: mongo=${JSON.stringify(a)} dynamo=${JSON.stringify(b)}`);
      }
    }
    console.log(`Compare complete: match=${match} mismatch=${mismatch} missing=${missing}`);
    await disconnectDatabase();
    process.exit(mismatch === 0 && missing === 0 ? 0 : 2);
  }

  const cp = loadCheckpoint();
  let migrated = cp.migrated;
  let lastKey = cp.lastKey;

  for (const doc of docs) {
    if (lastKey && doc.key <= lastKey) continue;

    const record = {
      key: doc.key,
      value: doc.value,
      displayValue: doc.displayValue || undefined,
      category: doc.category,
      description: doc.description || undefined,
      updatedBy: doc.updatedBy ? String(doc.updatedBy) : undefined,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    if (dryRun) {
      console.log(`[dry-run] would migrate ${doc.key} (${record.category})`);
    } else {
      await dynamoRepo.upsert(record);
      migrated++;
      console.log(`migrated ${doc.key}`);
    }

    lastKey = doc.key;
    if (!dryRun) saveCheckpoint({ lastKey, migrated });
  }

  if (dryRun) {
    console.log(`Dry-run complete. ${docs.length} settings would be migrated.`);
  } else {
    console.log(`Migration complete. migrated=${migrated}`);
  }

  await disconnectDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

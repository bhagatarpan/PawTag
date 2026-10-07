import { MongoSettingRepository } from '../dynamodb/mongo-setting.repository';
import { DynamoSettingRepository } from '../dynamodb/dynamo-setting.repository';
import { isDynamoConfigured } from '../dynamodb/client';
import type { SettingRepository } from './setting';

export type SettingsReadMode = 'mongo' | 'dynamodb' | 'dual';

/**
 * Resolve settings read mode from env.
 * Default: mongo (MongoDB remains authoritative until founder enables dynamodb reads).
 *
 * DYNAMODB_SETTINGS_READS:
 *   - unset/false/mongo → MongoDB only
 *   - dynamodb → DynamoDB only (requires AWS config + migrated data)
 *   - dual → read DynamoDB first, fall back to Mongo; logs mismatch
 */
export function resolveSettingsReadMode(): SettingsReadMode {
  const raw = (process.env.DYNAMODB_SETTINGS_READS || 'mongo').trim().toLowerCase();
  if (raw === 'dynamodb' || raw === 'dynamo') return 'dynamodb';
  if (raw === 'dual' || raw === 'shadow') return 'dual';
  return 'mongo';
}

export function createSettingsRepository(): SettingRepository {
  const mode = resolveSettingsReadMode();
  const mongo = new MongoSettingRepository();

  if (mode === 'mongo' || !isDynamoConfigured()) {
    return mongo;
  }

  const dynamo = new DynamoSettingRepository();

  if (mode === 'dynamodb') {
    return dynamo;
  }

  // dual: Dynamo first, Mongo fallback
  return {
    async getByKey(key) {
      try {
        return await dynamo.getByKey(key);
      } catch {
        return mongo.getByKey(key);
      }
    },
    async getManyByKeys(keys) {
      try {
        const dyn = await dynamo.getManyByKeys(keys);
        if (dyn.length) return dyn;
      } catch {
        /* fall through */
      }
      return mongo.getManyByKeys(keys);
    },
    async upsert(input) {
      // Dual-write settings (low-risk domain): Mongo remains required for admin routes still on Mongoose
      await mongo.upsert(input);
      if (isDynamoConfigured()) {
        try {
          await dynamo.upsert(input);
        } catch {
          /* Dynamo write best-effort during dual mode */
        }
      }
    },
  };
}

let cached: SettingRepository | null = null;

export function getSettingsRepository(): SettingRepository {
  if (!cached) cached = createSettingsRepository();
  return cached;
}

export function resetSettingsRepositoryCache(): void {
  cached = null;
}

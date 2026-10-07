import { describe, it, expect } from 'vitest';

/**
 * Phase 12 acceptance evidence helpers.
 * Full AWS integration requires DynamoDB Local or IAM keys in .env.local.
 * These tests prove key mapping + mode defaults without network.
 */
describe('Phase 12 — DynamoDB settings migration contract', () => {
  it('preserves Mongo setting identity as string keys', async () => {
    const { settingKeys, normalizeSetting } = await import('../../packages/db/src/repositories/setting');
    const keys = settingKeys('company.name');
    expect(keys.PK).toBe('SETTING#company.name');
    const n = normalizeSetting({ key: 'company.name', value: 'PawTag', category: 'company' });
    expect(n?.key).toBe('company.name');
    expect(n?.value).toBe('PawTag');
  });

  it('documents that Mongo remains default authoritative source', async () => {
    const { resolveSettingsReadMode } = await import('../../packages/db/src/repositories/settings-repository');
    const prev = process.env.DYNAMODB_SETTINGS_READS;
    delete process.env.DYNAMODB_SETTINGS_READS;
    expect(resolveSettingsReadMode()).toBe('mongo');
    if (prev !== undefined) process.env.DYNAMODB_SETTINGS_READS = prev;
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoSettingRepository } from '../../packages/db/src/dynamodb/dynamo-setting.repository';
import {
  normalizeSetting,
  toDynamoSettingItem,
  fromDynamoSettingItem,
} from '../../packages/db/src/repositories/setting';
import {
  resolveSettingsReadMode,
  createSettingsRepository,
  resetSettingsRepositoryCache,
} from '../../packages/db/src/repositories/settings-repository';

describe('Phase 12 — Settings DynamoDB repository', () => {
  beforeEach(() => {
    resetSettingsRepositoryCache();
  });

  it('maps settings items with SETTING# PK/SK', () => {
    const item = toDynamoSettingItem({
      key: 'commerce.tax.rate',
      value: '0.15',
      category: 'commerce',
    });
    expect(item.PK).toBe('SETTING#commerce.tax.rate');
    expect(item.SK).toBe('META');
    expect(item.value).toBe('0.15');
  });

  it('normalizes Mongo vs Dynamo records for comparison', () => {
    const mongo = normalizeSetting({
      key: 'commerce.tax.rate',
      value: '0.15',
      displayValue: '15%',
      category: 'commerce',
      description: 'GST',
      updatedBy: 'abc',
    });
    const dynamo = normalizeSetting(
      fromDynamoSettingItem({
        PK: 'SETTING#commerce.tax.rate',
        SK: 'META',
        key: 'commerce.tax.rate',
        value: '0.15',
        displayValue: '15%',
        category: 'commerce',
        description: 'GST',
        updatedBy: 'abc',
      }),
    );
    expect(mongo).toEqual(dynamo);
  });

  it('DynamoSettingRepository getByKey uses document client GetCommand path', async () => {
    const send = vi.fn().mockResolvedValue({
      Item: {
        PK: 'SETTING#commerce.tax.rate',
        SK: 'META',
        key: 'commerce.tax.rate',
        value: '0.15',
        category: 'commerce',
      },
    });
    const client = { send } as unknown as DynamoDBDocumentClient;
    const repo = new DynamoSettingRepository(client, 'pawtag-dev-settings');
    const rec = await repo.getByKey('commerce.tax.rate');

    expect(rec?.key).toBe('commerce.tax.rate');
    expect(rec?.value).toBe('0.15');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('resolveSettingsReadMode defaults to mongo', () => {
    delete process.env.DYNAMODB_SETTINGS_READS;
    expect(resolveSettingsReadMode()).toBe('mongo');
  });

  it('createSettingsRepository returns mongo adapter when not configured', () => {
    const prev = { ...process.env };
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.DYNAMODB_SETTINGS_READS;
    const repo = createSettingsRepository();
    expect(repo.constructor.name).toBe('MongoSettingRepository');
    process.env = prev;
    resetSettingsRepositoryCache();
  });

  it('createSettingsRepository returns dynamodb adapter when mode+dynamodb env set', () => {
    const prev = { ...process.env };
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.DYNAMODB_SETTINGS_READS = 'dynamodb';
    const repo = createSettingsRepository();
    expect(repo.constructor.name).toBe('DynamoSettingRepository');
    process.env = prev;
    resetSettingsRepositoryCache();
  });
});

/** Normalized Setting shape independent of Mongo/Dynamo storage. */
export interface SettingRecord {
  key: string;
  value: string;
  displayValue?: string;
  category: string;
  description?: string;
  updatedBy?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface SettingRepository {
  getByKey(key: string): Promise<SettingRecord | null>;
  getManyByKeys(keys: string[]): Promise<SettingRecord[]>;
  upsert(input: SettingRecord): Promise<void>;
}

/** DynamoDB item keys for settings table (PK/SK from Phase 11 design). */
export function settingKeys(key: string): { PK: string; SK: string } {
  return { PK: `SETTING#${key}`, SK: 'META' };
}

export function toDynamoSettingItem(rec: SettingRecord): Record<string, unknown> {
  const { PK, SK } = settingKeys(rec.key);
  return {
    PK,
    SK,
    entity: 'Setting',
    key: rec.key,
    value: rec.value,
    displayValue: rec.displayValue,
    category: rec.category,
    description: rec.description,
    updatedBy: rec.updatedBy,
    createdAt: rec.createdAt ? new Date(rec.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: rec.updatedAt ? new Date(rec.updatedAt).toISOString() : new Date().toISOString(),
  };
}

export function fromDynamoSettingItem(item: any): SettingRecord | null {
  if (!item?.key) return null;
  return {
    key: String(item.key),
    value: String(item.value ?? ''),
    displayValue: item.displayValue ? String(item.displayValue) : undefined,
    category: String(item.category ?? 'general'),
    description: item.description ? String(item.description) : undefined,
    updatedBy: item.updatedBy ? String(item.updatedBy) : undefined,
    createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
    updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
  };
}

/** Normalize for comparison across Mongo/Dynamo. */
export function normalizeSetting(rec: SettingRecord | null | undefined): Omit<SettingRecord, 'createdAt' | 'updatedAt'> | null {
  if (!rec?.key) return null;
  return {
    key: rec.key,
    value: rec.value,
    displayValue: rec.displayValue || undefined,
    category: rec.category || 'general',
    description: rec.description || undefined,
    updatedBy: rec.updatedBy || undefined,
  };
}

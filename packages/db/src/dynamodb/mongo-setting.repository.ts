import { Setting } from '../models/Setting';
import type { SettingRecord, SettingRepository } from '../repositories/setting';

/**
 * MongoDB adapter for SettingRepository.
 * Preserves current Mongoose behavior as the default authoritative source.
 */
export class MongoSettingRepository implements SettingRepository {
  async getByKey(key: string): Promise<SettingRecord | null> {
    const doc = await Setting.findOne({ key }).lean();
    if (!doc) return null;
    return {
      key: doc.key,
      value: doc.value,
      displayValue: doc.displayValue || undefined,
      category: doc.category,
      description: doc.description || undefined,
      updatedBy: doc.updatedBy ? String(doc.updatedBy) : undefined,
      createdAt: (doc as any).createdAt,
      updatedAt: (doc as any).updatedAt,
    };
  }

  async getManyByKeys(keys: string[]): Promise<SettingRecord[]> {
    if (!keys.length) return [];
    const docs = await Setting.find({ key: { $in: keys } }).lean();
    return docs.map((doc) => ({
      key: doc.key,
      value: doc.value,
      displayValue: doc.displayValue || undefined,
      category: doc.category,
      description: doc.description || undefined,
      updatedBy: doc.updatedBy ? String(doc.updatedBy) : undefined,
      createdAt: (doc as any).createdAt,
      updatedAt: (doc as any).updatedAt,
    }));
  }

  async upsert(input: SettingRecord): Promise<void> {
    await Setting.findOneAndUpdate(
      { key: input.key },
      {
        $set: {
          key: input.key,
          value: input.value,
          displayValue: input.displayValue,
          category: input.category,
          description: input.description,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          updatedBy: input.updatedBy,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
  }
}

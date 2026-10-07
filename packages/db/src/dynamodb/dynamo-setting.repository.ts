import {
  GetCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { getDynamoDocumentClient, getSettingsTableName } from './client';
import {
  fromDynamoSettingItem,
  settingKeys,
  toDynamoSettingItem,
  type SettingRecord,
  type SettingRepository,
} from '../repositories/setting';

/**
 * DynamoDB adapter for SettingRepository.
 * Access pattern: PK=SETTING#{key}, SK=META
 */
export class DynamoSettingRepository implements SettingRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient = getDynamoDocumentClient(),
    private readonly tableName: string = getSettingsTableName(),
  ) {}

  async getByKey(key: string): Promise<SettingRecord | null> {
    const { PK, SK } = settingKeys(key);
    const res = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { PK, SK } }),
    );
    return fromDynamoSettingItem(res.Item);
  }

  async getManyByKeys(keys: string[]): Promise<SettingRecord[]> {
    const results: SettingRecord[] = [];
    for (const key of keys) {
      const rec = await this.getByKey(key);
      if (rec) results.push(rec);
    }
    return results;
  }

  async upsert(input: SettingRecord): Promise<void> {
    const item = toDynamoSettingItem(input);
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  /** Debug helper — list all settings (migration/compare only; not request path). */
  async listAll(limit = 500): Promise<SettingRecord[]> {
    const items: SettingRecord[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const res = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'begins_with(PK, :pk)',
          ExpressionAttributeValues: { ':pk': 'SETTING#' },
          Limit: Math.min(limit, 100),
          ExclusiveStartKey,
        }),
      );
      for (const raw of res.Items || []) {
        const rec = fromDynamoSettingItem(raw);
        if (rec) items.push(rec);
      }
      ExclusiveStartKey = res.LastEvaluatedKey;
      if (items.length >= limit) break;
    } while (ExclusiveStartKey);
    return items;
  }
}

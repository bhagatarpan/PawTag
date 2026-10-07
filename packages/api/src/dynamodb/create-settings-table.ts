/**
 * Create DynamoDB settings table (Phase 12 low-risk domain).
 * Idempotent CreateTable if not exists.
 *
 * Usage:
 *   pnpm --filter @pawtag/api exec tsx src/dynamodb/create-settings-table.ts
 */
import path from 'path';
import dotenv from 'dotenv';
import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import { getSettingsTableName, getDynamoTablePrefix } from '@pawtag/db';

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

async function main(): Promise<void> {
  const region = process.env.AWS_REGION?.trim() || 'ap-southeast-2';
  const endpoint = process.env.DYNAMODB_ENDPOINT?.trim() || undefined;
  const tableName = getSettingsTableName();

  const client = new DynamoDBClient({
    region,
    ...(endpoint ? { endpoint } : {}),
  });

  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`Table already exists: ${tableName}`);
    return;
  } catch {
    // create below
  }

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
    }),
  );

  console.log(`Created table: ${tableName} (prefix=${getDynamoTablePrefix()})`);
  console.log('Note: DynamoDB Local may take a moment to become active.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

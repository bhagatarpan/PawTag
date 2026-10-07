/**
 * DynamoDB client factory (server-only).
 * Never import from web/admin/finder apps.
 *
 * Env:
 * - AWS_REGION (default ap-southeast-2)
 * - AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (from packages/api/.env.local)
 * - DYNAMODB_ENDPOINT (empty = real AWS; http://localhost:8000 = DynamoDB Local)
 * - DYNAMODB_TABLE_PREFIX (default pawtag-dev-)
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

let docClient: DynamoDBDocumentClient | null = null;

export function getDynamoTablePrefix(): string {
  return process.env.DYNAMODB_TABLE_PREFIX?.trim() || 'pawtag-dev-';
}

export function getSettingsTableName(): string {
  return `${getDynamoTablePrefix()}settings`;
}

export function isDynamoConfigured(): boolean {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

export function getDynamoDocumentClient(): DynamoDBDocumentClient {
  if (docClient) return docClient;

  const region = process.env.AWS_REGION?.trim() || 'ap-southeast-2';
  const endpoint = process.env.DYNAMODB_ENDPOINT?.trim() || undefined;

  const client = new DynamoDBClient({
    region,
    ...(endpoint ? { endpoint } : {}),
  });

  docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  return docClient;
}

export function resetDynamoClientCache(): void {
  docClient = null;
}

/** Test helper */
export function setDynamoDocumentClientForTests(client: DynamoDBDocumentClient | null): void {
  docClient = client;
}

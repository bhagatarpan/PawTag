/**
 * DynamoDB PawRewards hold operations (Phase 13 design + tests).
 * Mirrors Phase 02 Mongo invariants: available = balance - reserved.
 * Production rewards remain on MongoDB until cutover is approved.
 */
import { UpdateCommand, GetCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export interface RewardsUser {
  userId: string;
  pawRewardsBalance: number;
  pawRewardsReserved: number;
}

export class DynamoRewardsService {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async getUserRewards(userId: string): Promise<RewardsUser | null> {
    const res = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: `USER#${userId}`, SK: 'REWARDS' },
      }),
    );
    if (!res.Item) return null;
    return {
      userId,
      pawRewardsBalance: Number(res.Item.pawRewardsBalance ?? 0),
      pawRewardsReserved: Number(res.Item.pawRewardsReserved ?? 0),
    };
  }

  /** Atomic hold when balance - reserved >= amount. */
  async reserve(userId: string, amount: number, checkoutId: string): Promise<{ success: boolean; error?: string }> {
    if (amount <= 0) return { success: false, error: 'Amount must be positive' };
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: `USER#${userId}`, SK: 'REWARDS' },
          UpdateExpression: 'SET pawRewardsReserved = pawRewardsReserved + :a, updatedAt = :now',
          ConditionExpression:
            'attribute_exists(PK) AND (pawRewardsBalance - pawRewardsReserved) >= :a',
          ExpressionAttributeValues: {
            ':a': amount,
            ':now': new Date().toISOString(),
          },
        }),
      );
      // Separate reservation record for idempotent checkout binding
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: `RES#${checkoutId}`, SK: 'META' },
          UpdateExpression: 'SET userId = :u, amount = :a, #s = :reserved, updatedAt = :now',
          ConditionExpression: 'attribute_not_exists(PK) OR #s = :released',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':u': userId,
            ':a': amount,
            ':reserved': 'reserved',
            ':released': 'released',
            ':now': new Date().toISOString(),
          },
        }),
      );
      return { success: true };
    } catch (err: any) {
      if (err?.name === 'ConditionalCheckFailedException') {
        return { success: false, error: 'Insufficient PawRewards available to reserve' };
      }
      throw err;
    }
  }

  /** Commit hold: debit balance and clear reserved, once. */
  async commit(userId: string, amount: number, checkoutId: string): Promise<{ committed: boolean; alreadyCommitted: boolean }> {
    const res = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: `RES#${checkoutId}`, SK: 'META' },
      }),
    );
    if (res.Item?.status === 'committed') {
      return { committed: false, alreadyCommitted: true };
    }

    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: `USER#${userId}`, SK: 'REWARDS' },
          UpdateExpression:
            'SET pawRewardsBalance = pawRewardsBalance - :a, pawRewardsTotalRedeemed = pawRewardsTotalRedeemed + :a, pawRewardsReserved = pawRewardsReserved - :a, updatedAt = :now',
          ConditionExpression: 'pawRewardsReserved >= :a',
          ExpressionAttributeValues: {
            ':a': amount,
            ':now': new Date().toISOString(),
          },
        }),
      );
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: `RES#${checkoutId}`, SK: 'META' },
          UpdateExpression: 'SET #s = :c, committedAt = :now',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':c': 'committed', ':now': new Date().toISOString() },
        }),
      );
      return { committed: true, alreadyCommitted: false };
    } catch (err: any) {
      if (err?.name === 'ConditionalCheckFailedException') {
        throw new Error('Unable to commit PawRewards reservation: insufficient reserved balance');
      }
      throw err;
    }
  }

  /** Release hold without debiting balance. */
  async release(userId: string, amount: number, checkoutId: string): Promise<{ released: boolean }> {
    const res = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: `RES#${checkoutId}`, SK: 'META' },
      }),
    );
    if (res.Item?.status === 'released' || res.Item?.status === 'committed') {
      return { released: false };
    }

    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: `USER#${userId}`, SK: 'REWARDS' },
          UpdateExpression: 'SET pawRewardsReserved = pawRewardsReserved - :a, updatedAt = :now',
          ConditionExpression: 'pawRewardsReserved >= :a',
          ExpressionAttributeValues: { ':a': amount, ':now': new Date().toISOString() },
        }),
      );
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: `RES#${checkoutId}`, SK: 'META' },
          UpdateExpression: 'SET #s = :r, releasedAt = :now',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':r': 'released', ':now': new Date().toISOString() },
        }),
      );
      return { released: true };
    } catch (err: any) {
      if (err?.name === 'ConditionalCheckFailedException') {
        return { released: false };
      }
      throw err;
    }
  }
}

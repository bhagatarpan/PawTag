/**
 * DynamoDB inventory stock operations (Phase 13 design + tests).
 * Conditional writes mirror Mongo inventory.service invariants.
 * Production inventory remains on MongoDB until cutover is explicitly approved.
 */
import { UpdateCommand, GetCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export interface StockItem {
  productId: string;
  stock: number;
  reserved: number;
  stockPolicy: 'deny' | 'allow';
}

export function stockPk(productId: string): string {
  return `PROD#${productId}`;
}

export function stockSk(): string {
  return 'STOCK';
}

export class DynamoInventoryService {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async getStock(productId: string): Promise<StockItem | null> {
    const res = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: stockPk(productId), SK: stockSk() },
      }),
    );
    if (!res.Item) return null;
    return {
      productId,
      stock: Number(res.Item.stock ?? 0),
      reserved: Number(res.Item.reserved ?? 0),
      stockPolicy: (res.Item.stockPolicy as any) || 'deny',
    };
  }

  /**
   * Atomic reserve: only succeed if available = stock - reserved >= qty
   * or stockPolicy === 'allow'.
   */
  async reserve(productId: string, quantity: number, orderId: string): Promise<{ success: boolean; error?: string }> {
    if (quantity <= 0) return { success: false, error: 'Quantity must be positive' };

    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: stockPk(productId), SK: stockSk() },
          UpdateExpression: 'SET reserved = reserved + :q, updatedAt = :now',
          ConditionExpression:
            'attribute_exists(PK) AND (stockPolicy = :allow OR (stock - reserved) >= :q)',
          ExpressionAttributeValues: {
            ':q': quantity,
            ':allow': 'allow',
            ':now': new Date().toISOString(),
          },
        }),
      );
      void orderId; // reservation reference stored by caller in stock movement ledger (Mongo today)
      return { success: true };
    } catch (err: any) {
      if (err?.name === 'ConditionalCheckFailedException') {
        return { success: false, error: `Only available stock for product ${productId}` };
      }
      throw err;
    }
  }

  /** Release reservation (checkout fail/expiry). */
  async release(productId: string, quantity: number): Promise<void> {
    if (quantity <= 0) return;
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: stockPk(productId), SK: stockSk() },
        UpdateExpression: 'SET reserved = reserved - :q, updatedAt = :now',
        ConditionExpression: 'attribute_exists(PK) AND reserved >= :q',
        ExpressionAttributeValues: { ':q': quantity, ':now': new Date().toISOString() },
      }),
    );
  }

  /**
   * Confirm sale: stock -qty AND reserved -qty.
   * Fails loudly if reservation/stock condition not met (no silent no-op).
   */
  async confirmSale(productId: string, quantity: number, orderId: string): Promise<void> {
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: stockPk(productId), SK: stockSk() },
          UpdateExpression: 'SET stock = stock - :q, reserved = reserved - :q, updatedAt = :now',
          ConditionExpression: 'attribute_exists(PK) AND stock >= :q AND reserved >= :q',
          ExpressionAttributeValues: {
            ':q': quantity,
            ':now': new Date().toISOString(),
          },
        }),
      );
      void orderId;
    } catch (err: any) {
      if (err?.name === 'ConditionalCheckFailedException') {
        throw new Error(
          `Inventory confirmation failed for product ${productId} (order ${orderId}): atomic stock transition did not occur`,
        );
      }
      throw err;
    }
  }
}

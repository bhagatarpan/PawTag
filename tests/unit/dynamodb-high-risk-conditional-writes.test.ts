import { describe, it, expect, vi } from 'vitest';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoInventoryService } from '../../packages/db/src/dynamodb/inventory.service';
import { DynamoRewardsService } from '../../packages/db/src/dynamodb/rewards.service';

function mockClient(handlers: Record<string, (input: any) => any>) {
  return {
    send: vi.fn().mockImplementation(async (cmd: any) => {
      const name = cmd.constructor?.name || '';
      for (const [key, fn] of Object.entries(handlers)) {
        if (name.includes(key) || key === '*') return fn(cmd.input || cmd);
      }
      throw new Error(`Unexpected command ${name}`);
    }),
  } as unknown as DynamoDBDocumentClient;
}

function conditionalFail() {
  const err: any = new Error('The conditional request failed');
  err.name = 'ConditionalCheckFailedException';
  throw err;
}

describe('Phase 13 — DynamoDB inventory conditional writes', () => {
  it('reserve succeeds when stock-reserved >= qty', async () => {
    const client = mockClient({
      UpdateCommand: () => ({}),
    });
    const inv = new DynamoInventoryService(client, 'pawtag-dev-commerce');
    const res = await inv.reserve('prod1', 1, 'ORD-1');
    expect(res.success).toBe(true);
  });

  it('reserve fails closed when stock insufficient', async () => {
    const client = mockClient({
      UpdateCommand: () => conditionalFail(),
    });
    const inv = new DynamoInventoryService(client, 'pawtag-dev-commerce');
    const res = await inv.reserve('prod1', 5, 'ORD-1');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/available/i);
  });

  it('confirmSale throws when atomic transition fails (no silent no-op)', async () => {
    const client = mockClient({
      UpdateCommand: () => conditionalFail(),
    });
    const inv = new DynamoInventoryService(client, 'pawtag-dev-commerce');
    await expect(inv.confirmSale('prod1', 1, 'ORD-1')).rejects.toThrow(/Inventory confirmation failed/i);
  });

  it('release decrements reserved when condition holds', async () => {
    const client = mockClient({ UpdateCommand: () => ({}) });
    const inv = new DynamoInventoryService(client, 'pawtag-dev-commerce');
    await expect(inv.release('prod1', 2)).resolves.toBeUndefined();
  });
});

describe('Phase 13 — DynamoDB rewards conditional writes', () => {
  it('reserve succeeds when available balance covers amount', async () => {
    const client = mockClient({
      UpdateCommand: () => ({}),
      GetCommand: () => ({ Item: null }),
    });
    const rewards = new DynamoRewardsService(client, 'pawtag-dev-membership');
    const res = await rewards.reserve('user1', 5, 'checkout-1');
    expect(res.success).toBe(true);
  });

  it('reserve fails when double-spend would occur', async () => {
    const client = mockClient({
      UpdateCommand: () => conditionalFail(),
    });
    const rewards = new DynamoRewardsService(client, 'pawtag-dev-membership');
    const res = await rewards.reserve('user1', 15, 'checkout-2');
    expect(res.success).toBe(false);
  });

  it('commit is idempotent for same checkoutId', async () => {
    let calls = 0;
    const client = {
      send: vi.fn().mockImplementation(async (cmd: any) => {
        const name = cmd.constructor?.name || '';
        if (name.includes('GetCommand')) {
          return { Item: calls === 0 ? null : { status: 'committed' } };
        }
        calls++;
        return {};
      }),
    } as unknown as DynamoDBDocumentClient;
    const rewards = new DynamoRewardsService(client, 'pawtag-dev-membership');
    const first = await rewards.commit('user1', 5, 'checkout-c');
    expect(first.committed).toBe(true);
    const second = await rewards.commit('user1', 5, 'checkout-c');
    expect(second.alreadyCommitted).toBe(true);
  });

  it('release without debiting balance when hold exists', async () => {
    const client = mockClient({
      GetCommand: () => ({ Item: { status: 'reserved' } }),
      UpdateCommand: () => ({}),
    });
    const rewards = new DynamoRewardsService(client, 'pawtag-dev-membership');
    const res = await rewards.release('user1', 5, 'checkout-r');
    expect(res.released).toBe(true);
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { inventoryService } from '../../packages/api/src/commerce/services/inventory.service';
import { Product } from '@pawtag/db';

async function createTestProduct(overrides: Record<string, unknown> = {}) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const doc = {
    name: 'PawTag Pro',
    sku: `PT-${id}`,
    slug: `pawtag-pro-${id}`,
    description: 'Test product',
    category: 'tags',
    price: 50,
    stock: 1,
    reserved: 0,
    stockPolicy: 'deny',
    productType: 'physical',
    isActive: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  const result = await mongoose.connection.collections.products.insertOne(doc as any);
  return result.insertedId.toString();
}

describe('Phase 02 — Inventory lifecycle', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 10000);

  beforeEach(async () => {
    await mongoose.connection.collections.products.deleteMany({});
  });

  it('confirmSale throws when atomic stock transition cannot complete (no silent no-op)', async () => {
    const productId = await createTestProduct({ stock: 1, reserved: 0 });

    const reserve = await inventoryService.reserve({
      productId,
      quantity: 1,
      orderId: 'ORD-CONFIRM-1',
    });
    expect(reserve.success).toBe(true);

    await Product.updateOne({ _id: productId }, { $set: { reserved: 0 } });

    await expect(
      inventoryService.confirmSale(productId, 1, 'ORD-CONFIRM-1'),
    ).rejects.toThrow(/Inventory confirmation failed/i);
  });

  it('confirmSale succeeds when reservation exists', async () => {
    const productId = await createTestProduct({ stock: 5, reserved: 0, name: 'PawTag Mini' });

    await inventoryService.reserve({
      productId,
      quantity: 2,
      orderId: 'ORD-CONFIRM-2',
    });

    await inventoryService.confirmSale(productId, 2, 'ORD-CONFIRM-2');

    const updated = await Product.findById(productId).lean();
    expect(updated!.stock).toBe(3);
    expect(updated!.reserved).toBe(0);
  });

  it('reserveAll compensates when a later line fails', async () => {
    const okId = await createTestProduct({ stock: 5, reserved: 0, name: 'OK Product' });
    const failId = await createTestProduct({ stock: 0, reserved: 0, name: 'Fail Product' });

    const result = await inventoryService.reserveAll(
      [
        { productId: okId, quantity: 2 },
        { productId: failId, quantity: 1 },
      ],
      'CHECKOUT-COMP-1',
    );

    expect(result.success).toBe(false);
    const okAfter = await Product.findById(okId).lean();
    expect(okAfter!.reserved).toBe(0);
  });

  it('concurrent reservations do not oversell the last unit', async () => {
    const productId = await createTestProduct({ stock: 1, reserved: 0, name: 'Last Unit' });

    const [a, b] = await Promise.all([
      inventoryService.reserve({ productId, quantity: 1, orderId: 'ORD-RACE-A' }),
      inventoryService.reserve({ productId, quantity: 1, orderId: 'ORD-RACE-B' }),
    ]);

    const successes = [a, b].filter((r) => r.success).length;
    expect(successes).toBe(1);

    const updated = await Product.findById(productId).lean();
    expect(updated!.reserved).toBe(1);
  });
});

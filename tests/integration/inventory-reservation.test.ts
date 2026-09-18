import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import { Product, StockMovement } from '../../packages/db/src/models/Product';
import { inventoryService } from '../../packages/api/src/commerce/services/inventory.service';

async function createProduct(overrides: Record<string, any> = {}) {
  const product = await Product.create({
    name: overrides.name || 'Test Product',
    slug: overrides.slug || `test-product-${Date.now()}`,
    sku: overrides.sku || `SKU-${Date.now()}`,
    price: 39.00,
    stock: overrides.stock ?? 10,
    reserved: 0,
    stockPolicy: overrides.stockPolicy || 'deny',
    status: 'active',
    category: 'tags',
    description: 'Test product',
    ...overrides,
  });
  return String(product._id);
}

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

// ═══════════════════════════════════════════
// SINGLE RESERVATION
// ═══════════════════════════════════════════

describe('Integration: Inventory Reservation', () => {
  it('reserves stock atomically', async () => {
    const productId = await createProduct({ stock: 5 });
    const result = await inventoryService.reserve({
      productId,
      quantity: 2,
      orderId: 'order-001',
    });

    expect(result.success).toBe(true);

    const status = await inventoryService.getStatus(productId);
    expect(status.reserved).toBe(2);
    expect(status.available).toBe(3);
  });

  it('fails when insufficient stock', async () => {
    const productId = await createProduct({ stock: 2 });
    const result = await inventoryService.reserve({
      productId,
      quantity: 5,
      orderId: 'order-002',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/available/);
  });

  it('prevents overselling with concurrent reservations', async () => {
    const productId = await createProduct({ stock: 1 });

    // Two concurrent reservations for the last unit
    const [res1, res2] = await Promise.all([
      inventoryService.reserve({ productId, quantity: 1, orderId: 'order-concurrent-1' }),
      inventoryService.reserve({ productId, quantity: 1, orderId: 'order-concurrent-2' }),
    ]);

    // Exactly one should succeed
    const successes = [res1, res2].filter(r => r.success);
    expect(successes).toHaveLength(1);

    const status = await inventoryService.getStatus(productId);
    expect(status.reserved).toBe(1);
    expect(status.available).toBe(0);
  });
});

// ═══════════════════════════════════════════
// RELEASE
// ═══════════════════════════════════════════

describe('Integration: Inventory Release', () => {
  it('releases reservation with correct quantity', async () => {
    const productId = await createProduct({ stock: 5 });
    await inventoryService.reserve({ productId, quantity: 3, orderId: 'order-release-001' });

    let status = await inventoryService.getStatus(productId);
    expect(status.reserved).toBe(3);

    await inventoryService.release(`${productId}:order-release-001`, 3);

    status = await inventoryService.getStatus(productId);
    expect(status.reserved).toBe(0);
    expect(status.available).toBe(5);
  });

  it('releaseForOrder releases all items', async () => {
    const productId1 = await createProduct({ name: 'Product 1', stock: 5 });
    const productId2 = await createProduct({ name: 'Product 2', stock: 3 });
    const orderId = 'order-release-all';

    await inventoryService.reserve({ productId: productId1, quantity: 2, orderId });
    await inventoryService.reserve({ productId: productId2, quantity: 1, orderId });

    await inventoryService.releaseForOrder(orderId, [
      { productId: productId1, quantity: 2 },
      { productId: productId2, quantity: 1 },
    ]);

    const status1 = await inventoryService.getStatus(productId1);
    const status2 = await inventoryService.getStatus(productId2);
    expect(status1.reserved).toBe(0);
    expect(status2.reserved).toBe(0);
  });
});

// ═══════════════════════════════════════════
// RESERVE ALL WITH COMPENSATION
// ═══════════════════════════════════════════

describe('Integration: Inventory reserveAll with Compensation', () => {
  it('reserves all items successfully', async () => {
    const productId1 = await createProduct({ name: 'Product A', stock: 5 });
    const productId2 = await createProduct({ name: 'Product B', stock: 3 });

    const result = await inventoryService.reserveAll(
      [
        { productId: productId1, quantity: 2 },
        { productId: productId2, quantity: 1 },
      ],
      'checkout-001',
    );

    expect(result.success).toBe(true);
    expect(result.reserved).toHaveLength(2);

    const status1 = await inventoryService.getStatus(productId1);
    const status2 = await inventoryService.getStatus(productId2);
    expect(status1.reserved).toBe(2);
    expect(status2.reserved).toBe(1);
  });

  it('compensates all reservations when later item fails', async () => {
    const productId1 = await createProduct({ name: 'Product A', stock: 5 });
    const productId2 = await createProduct({ name: 'Product B', stock: 0 }); // No stock!

    const result = await inventoryService.reserveAll(
      [
        { productId: productId1, quantity: 2 },
        { productId: productId2, quantity: 1 }, // This will fail
      ],
      'checkout-compensate',
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/available/);

    // First product should have been released
    const status1 = await inventoryService.getStatus(productId1);
    expect(status1.reserved).toBe(0);
    expect(status1.available).toBe(5);
  });

  it('no abandoned reservations when checkout setup fails mid-reservation', async () => {
    const productId1 = await createProduct({ name: 'Product A', stock: 5 });
    const productId2 = await createProduct({ name: 'Product B', stock: 1 });
    const productId3 = await createProduct({ name: 'Product C', stock: 0 }); // Will fail

    const result = await inventoryService.reserveAll(
      [
        { productId: productId1, quantity: 2 },
        { productId: productId2, quantity: 1 },
        { productId: productId3, quantity: 1 }, // This will fail
      ],
      'checkout-multi-compensate',
    );

    expect(result.success).toBe(false);

    // All products should have no reservations
    const status1 = await inventoryService.getStatus(productId1);
    const status2 = await inventoryService.getStatus(productId2);
    expect(status1.reserved).toBe(0);
    expect(status2.reserved).toBe(0);
  });
});

// ═══════════════════════════════════════════
// CONCURRENCY
// ═══════════════════════════════════════════

describe('Integration: Inventory Concurrency', () => {
  it('two concurrent checkouts for the last unit — only one succeeds', async () => {
    const productId = await createProduct({ stock: 1 });

    const [result1, result2] = await Promise.all([
      inventoryService.reserveAll(
        [{ productId, quantity: 1 }],
        'checkout-concurrent-1',
      ),
      inventoryService.reserveAll(
        [{ productId, quantity: 1 }],
        'checkout-concurrent-2',
      ),
    ]);

    // Exactly one should succeed
    const successes = [result1, result2].filter(r => r.success);
    expect(successes).toHaveLength(1);

    const status = await inventoryService.getStatus(productId);
    expect(status.reserved).toBe(1);
    expect(status.available).toBe(0);
  });

  it('concurrent multi-item checkouts — no oversell', async () => {
    const productId1 = await createProduct({ name: 'Product A', stock: 1 });
    const productId2 = await createProduct({ name: 'Product B', stock: 1 });

    const [result1, result2] = await Promise.all([
      inventoryService.reserveAll(
        [
          { productId: productId1, quantity: 1 },
          { productId: productId2, quantity: 1 },
        ],
        'checkout-concurrent-multi-1',
      ),
      inventoryService.reserveAll(
        [
          { productId: productId1, quantity: 1 },
          { productId: productId2, quantity: 1 },
        ],
        'checkout-concurrent-multi-2',
      ),
    ]);

    // Both might succeed if they reserve different products,
    // or one fails and compensates. The key is no oversell.
    const status1 = await inventoryService.getStatus(productId1);
    const status2 = await inventoryService.getStatus(productId2);
    expect(status1.reserved).toBeLessThanOrEqual(1);
    expect(status2.reserved).toBeLessThanOrEqual(1);
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Cart, Product, ShippingMethod } from '@pawtag/db';
import { shippingService } from '../../packages/api/src/commerce/services/shipping.service';

describe('Phase 02 — Shipping method identity', () => {
  let mongoServer: MongoMemoryServer;
  let userId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 10000);

  beforeEach(async () => {
    await Cart.deleteMany({});
    await Product.deleteMany({});
    await ShippingMethod.deleteMany({});
    await mongoose.connection.collections.users.deleteMany({});
    const user = await mongoose.connection.collections.users.insertOne({
      email: `ship-${Date.now()}@example.com`,
      passwordHash: 'x',
      fullName: 'Ship User',
      phoneNumber: '+64210008888',
      role: 'customer',
      status: 'active',
      emailVerified: true,
      phoneVerified: true,
      responsibilityScore: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    userId = user.insertedId.toString();
    await Cart.create({
      userId: user.insertedId,
      status: 'active',
      items: [],
    });
  });

  it('getRates returns DB-resolvable IDs even when no methods are configured', async () => {
    const rates = await shippingService.getRates(userId, {
      line1: '1 St', city: 'Auckland', state: 'AKL', zip: '1010', country: 'NZ',
    });

    expect(rates.length).toBeGreaterThan(0);
    for (const rate of rates) {
      const method = await ShippingMethod.findById(rate.id).lean();
      expect(method).toBeTruthy();
    }
  });

  it('selectMethod rejects unknown ids and resolves fallback by name', async () => {
    const rates = await shippingService.getRates(userId, {
      line1: '1 St', city: 'Auckland', state: 'AKL', zip: '1010', country: 'NZ',
    });
    const standard = rates.find((r) => r.name.includes('Standard')) || rates[0];

    await shippingService.selectMethod(userId, standard.id, standard.name);
    const cart = await Cart.findOne({ userId, status: 'active' }).lean();
    expect(cart!.shippingMethodId).toBe(standard.id);
    expect(cart!.shippingCost).toBe(standard.cost);

    // Unknown id fails — does not trust client cost
    await expect(
      shippingService.selectMethod(userId, 'synthetic-free-id', 'Fake'),
    ).rejects.toThrow(/not found/i);
  });
});

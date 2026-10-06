import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PromoCode, PromoUsage, Order } from '@pawtag/db';

/**
 * Phase 02 — Promo usage idempotency contract.
 * Mirrors checkout.service confirmCheckout promo commit logic.
 */
async function commitPromoUsageOnce(code: string, orderId: string, orderNumber: string, userId: string) {
  const upper = code.toUpperCase();
  const usage = await PromoUsage.findOneAndUpdate(
    { code: upper, orderId },
    { $setOnInsert: { code: upper, orderId, orderNumber, userId } },
    { upsert: true, new: false },
  );

  if (!usage) {
    const promo = await PromoCode.findOne({ code: upper });
    if (promo) {
      const limitFilter: Record<string, unknown> = { code: upper };
      if (promo.usageLimit && promo.usageLimit > 0) {
        limitFilter.usageCount = { $lt: promo.usageLimit };
      }
      await PromoCode.findOneAndUpdate(limitFilter, { $inc: { usageCount: 1 } }, { new: true });
    }
    return { incremented: true };
  }
  return { incremented: false };
}

describe('Phase 02 — Promo usage concurrency/idempotency', () => {
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
    await PromoCode.deleteMany({});
    await PromoUsage.deleteMany({});
    await Order.deleteMany({});
  });

  it('duplicate finalization increments promo usage only once', async () => {
    await PromoCode.create({
      code: 'SAVE10',
      description: '10% off',
      discountType: 'percentage',
      discountValue: 10,
      isActive: true,
      usageCount: 0,
    });
    const order = await mongoose.connection.collections.orders.insertOne({
      orderNumber: 'ORD-PROMO-1',
      userId: new mongoose.Types.ObjectId(),
      items: [],
      status: 'paid',
      shippingAddress: { line1: '1 St', city: 'Auckland', state: 'AKL', zip: '1010', country: 'NZ' },
      payment: { amount: 100, currency: 'NZD', status: 'completed', method: 'card' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const orderId = order.insertedId.toString();

    const userId = new mongoose.Types.ObjectId().toString();
    const r1 = await commitPromoUsageOnce('SAVE10', orderId, 'ORD-PROMO-1', userId);
    const r2 = await commitPromoUsageOnce('SAVE10', orderId, 'ORD-PROMO-1', userId);
    const r3 = await commitPromoUsageOnce('save10', orderId, 'ORD-PROMO-1', userId);

    expect(r1.incremented).toBe(true);
    expect(r2.incremented).toBe(false);
    expect(r3.incremented).toBe(false);

    const promo = await PromoCode.findOne({ code: 'SAVE10' }).lean();
    expect(promo!.usageCount).toBe(1);
  });

  it('promo usage limit is enforced at finalization', async () => {
    await PromoCode.create({
      code: 'ONCE',
      description: 'Once only',
      discountType: 'percentage',
      discountValue: 5,
      isActive: true,
      usageCount: 1,
      usageLimit: 1,
    });

    const order = await mongoose.connection.collections.orders.insertOne({
      orderNumber: 'ORD-PROMO-2',
      userId: new mongoose.Types.ObjectId(),
      items: [],
      status: 'paid',
      shippingAddress: { line1: '1 St', city: 'Auckland', state: 'AKL', zip: '1010', country: 'NZ' },
      payment: { amount: 50, currency: 'NZD', status: 'completed', method: 'card' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const orderId = order.insertedId.toString();
    const userId = new mongoose.Types.ObjectId().toString();

    await commitPromoUsageOnce('ONCE', orderId, 'ORD-PROMO-2', userId);

    const promo = await PromoCode.findOne({ code: 'ONCE' }).lean();
    expect(promo!.usageCount).toBe(1); // already at limit — not incremented past it
  });
});

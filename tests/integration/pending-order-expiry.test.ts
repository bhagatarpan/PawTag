import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PendingOrder, Product, User, PawRewardsReservation } from '@pawtag/db';
import { inventoryService } from '../../packages/api/src/commerce/services/inventory.service';
import { runPendingOrderExpiryJob } from '../../packages/api/src/jobs/pendingOrderExpiry';

describe('Phase 02 — PendingOrder expiry releases reservations', () => {
  let mongoServer: MongoMemoryServer;
  let userId: string;
  let productId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 10000);

  beforeEach(async () => {
    await PendingOrder.deleteMany({});
    await Product.deleteMany({});
    await User.deleteMany({});
    await PawRewardsReservation.deleteMany({});

    const user = await User.create({
      email: 'expiry@example.com',
      passwordHash: 'x',
      fullName: 'Expiry User',
      phoneNumber: '+64210007777',
      role: 'customer',
      status: 'active',
      pawRewardsBalance: 10,
      pawRewardsReserved: 0,
    });
    userId = user._id.toString();

    const product = await mongoose.connection.collections.products.insertOne({
      name: 'Expiry Product',
      sku: `EXP-${Date.now()}`,
      slug: 'expiry-product',
      description: 'Expiry test product',
      category: 'tags',
      price: 40,
      stock: 3,
      reserved: 0,
      stockPolicy: 'deny',
      productType: 'physical',
      isActive: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    productId = product.insertedId.toString();

    // Simulate active checkout reservations
    await inventoryService.reserve({ productId, quantity: 2, orderId: 'pending-exp-1' });
    const { reserveRewards } = await import('../../packages/api/src/services/loyalty/pawrewards.service');
    await reserveRewards(userId, 5, 'pending-exp-1');

    await PendingOrder.create({
      userId: user._id,
      items: [{
        productId: new mongoose.Types.ObjectId(productId),
        productName: 'Expiry Product',
        sku: 'EXP-1',
        unitPrice: 40,
        customizationTotal: 0,
        quantity: 2,
      }],
      subtotal: 80,
      discount: 5,
      shipping: 0,
      tax: 0,
      total: 75,
      currency: 'NZD',
      stripePaymentIntentId: 'pi_pending_exp_1',
      status: 'pending',
      pawRewardsRedemption: 5,
      pawRewardsReserved: true,
      expiresAt: new Date(Date.now() - 60_000),
      lastAccessedAt: new Date(),
    });
  });

  it('expired pending checkout releases stock and rewards holds', async () => {
    const result = await runPendingOrderExpiryJob();
    expect(result.success).toBe(true);

    const product = await Product.findById(productId).lean();
    expect(product!.reserved).toBe(0);

    const user = await User.findById(userId).lean();
    expect(user!.pawRewardsReserved).toBe(0);
    expect(user!.pawRewardsBalance).toBe(10); // not debited

    const pending = await PendingOrder.findOne({ stripePaymentIntentId: 'pi_pending_exp_1' }).lean();
    expect(pending!.status).toBe('expired');
  });
});

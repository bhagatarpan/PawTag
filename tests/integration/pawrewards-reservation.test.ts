import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, PawRewardsReservation } from '@pawtag/db';
import {
  reserveRewards,
  commitRewardsReservation,
  releaseRewardsReservation,
} from '../../packages/api/src/services/loyalty/pawrewards.service';

describe('Phase 02 — PawRewards atomic reservation', () => {
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
    await User.deleteMany({});
    await PawRewardsReservation.deleteMany({});
    const user = await User.create({
      email: 'rewards@example.com',
      passwordHash: 'x',
      fullName: 'Rewards User',
      phoneNumber: '+64210009999',
      role: 'customer',
      status: 'active',
      pawRewardsBalance: 20,
      pawRewardsReserved: 0,
    });
    userId = user._id.toString();
  });

  it('two concurrent reservations cannot hold the same balance twice', async () => {
    const results = await Promise.allSettled([
      reserveRewards(userId, 15, 'checkout-A'),
      reserveRewards(userId, 15, 'checkout-B'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(1);

    const user = await User.findById(userId).lean();
    expect(user!.pawRewardsReserved).toBe(15);
    expect(user!.pawRewardsBalance).toBe(20); // hold does not debit balance until commit
    expect(Math.max(0, (user!.pawRewardsBalance || 0) - (user!.pawRewardsReserved || 0))).toBe(5);
  });

  it('reserve is idempotent for the same checkoutId', async () => {
    const a = await reserveRewards(userId, 10, 'checkout-idem');
    const b = await reserveRewards(userId, 10, 'checkout-idem');
    expect(a.reserved).toBe(10);
    expect(b.reserved).toBe(10);

    const user = await User.findById(userId).lean();
    expect(user!.pawRewardsReserved).toBe(10);
  });

  it('commit debits balance and clears reserved exactly once', async () => {
    await reserveRewards(userId, 8, 'checkout-commit');
    const first = await commitRewardsReservation(userId, 8, 'ORD-1', 'checkout-commit');
    const second = await commitRewardsReservation(userId, 8, 'ORD-1', 'checkout-commit');

    expect(first.committed).toBe(true);
    expect(second.alreadyCommitted).toBe(true);

    const user = await User.findById(userId).lean();
    expect(user!.pawRewardsBalance).toBe(12);
    expect(user!.pawRewardsReserved).toBe(0);
    expect(user!.pawRewardsTotalRedeemed).toBe(8);
  });

  it('release frees the hold without debiting balance', async () => {
    await reserveRewards(userId, 6, 'checkout-release');
    await releaseRewardsReservation(userId, 6, 'ORD-2', 'checkout-release');

    const user = await User.findById(userId).lean();
    expect(user!.pawRewardsBalance).toBe(20);
    expect(user!.pawRewardsReserved).toBe(0);
  });

  it('commit fails loud when reservation is missing', async () => {
    await expect(
      commitRewardsReservation(userId, 5, 'ORD-MISSING', 'checkout-none'),
    ).rejects.toThrow(/insufficient reserved balance/i);
  });
});

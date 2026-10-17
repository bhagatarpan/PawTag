import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from './setup';

/**
 * Proportional Guardian Points clawback + credit-note creation for
 * refunds. Founder decision: claw back what was ACTUALLY earned
 * (multiplier + repeat bonus included), proportionally to the refunded
 * amount — a flat 1pt/$1 let members keep most of their bonus on
 * refunded purchases. Every live refund path (cancellation, return
 * refund, admin refund, refund retry) must route through these.
 */

async function createUserWithPoints(points: number): Promise<string> {
  const res = await mongoose.connection.collections.users.insertOne({
    email: `clawback-${Date.now()}-${Math.random()}@example.com`,
    passwordHash: 'x',
    fullName: 'Clawback Tester',
    phoneNumber: '+64217777777',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    guardianPoints: points,
    guardianTier: 'CARE',
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return res.insertedId.toString();
}

async function seedPurchase(userId: string, orderId: string, points: number): Promise<void> {
  await mongoose.connection.collections.guardianpointsledgers.insertOne({
    userId: new mongoose.Types.ObjectId(userId),
    points,
    activity: 'purchase',
    referenceId: orderId,
    metadata: {},
    createdAt: new Date(),
  });
}

beforeAll(async () => { await setupTestDb(); }, 30000);
afterAll(async () => { await teardownTestDb(); }, 10000);
beforeEach(async () => { await clearDb(); });

describe('Proportional Guardian Points clawback', () => {
  it('deducts proportionally to the refund share of the original award', async () => {
    const { refundClawbackForOrder } = await import('../../packages/api/src/services/loyalty/points-earning.service');
    const userId = await createuserWithPointsSafe(300);
    const orderId = new mongoose.Types.ObjectId().toString();
    await seedPurchase(userId, orderId, 300); // e.g. Black member, $100 order

    // Half of the order refunded → half of the 300 points
    const result = await refundClawbackForOrder({
      userId,
      orderId,
      refundAmount: 50,
      capturedAmount: 100,
    });
    expect(result.pointsToDeduct).toBe(150);

    const { User, GuardianPointsLedger } = await import('@pawtag/db');
    const user = await User.findById(userId).lean();
    expect(user!.guardianPoints).toBe(150); // 300 - 150
    const deduction = await GuardianPointsLedger.findOne({ userId: new mongoose.Types.ObjectId(userId), activity: 'refund', referenceId: orderId }).lean();
    expect(deduction!.points).toBe(-150);
  });

  it('caps cumulative clawbacks at the original award across multiple partial refunds', async () => {
    const { refundClawbackForOrder } = await import('../../packages/api/src/services/loyalty/points-earning.service');
    const userId = await createUserWithPoints(100);
    const orderId = new mongoose.Types.ObjectId().toString();
    await seedPurchase(userId, orderId, 100);

    const first = await refundClawbackForOrder({ userId, orderId, refundAmount: 60, capturedAmount: 100 });
    expect(first.pointsToDeduct).toBe(60);

    // Second refund of the same size would proportionally be 60, but only
    // 40 points remain — capped
    const second = await refundClawbackForOrder({ userId, orderId, refundAmount: 60, capturedAmount: 100 });
    expect(second.pointsToDeduct).toBe(40);

    const { User } = await import('@pawtag/db');
    const user = await User.findById(userId).lean();
    expect(user!.guardianPoints).toBe(0); // never negative

    // A third refund deducts nothing — already fully clawed back
    const third = await refundClawbackForOrder({ userId, orderId, refundAmount: 50, capturedAmount: 100 });
    expect(third.pointsToDeduct).toBe(0);
  });

  it('deducts nothing when the order never earned points', async () => {
    const { refundClawbackForOrder } = await import('../../packages/api/src/services/loyalty/points-earning.service');
    const userId = await createUserWithPoints(10);
    const orderId = new mongoose.Types.ObjectId().toString(); // no purchase ledger entry

    const result = await refundClawbackForOrder({ userId, orderId, refundAmount: 80, capturedAmount: 100 });
    expect(result.pointsToDeduct).toBe(0);
  });

  it('handles zero/invalid amounts without deducting', async () => {
    const { refundClawbackForOrder } = await import('../../packages/api/src/services/loyalty/points-earning.service');
    const userId = await createUserWithPoints(10);
    const orderId = new mongoose.Types.ObjectId().toString();
    await seedPurchase(userId, orderId, 50);

    expect((await refundClawbackForOrder({ userId, orderId, refundAmount: 0, capturedAmount: 100 })).pointsToDeduct).toBe(0);
    expect((await refundClawbackForOrder({ userId, orderId, refundAmount: 10, capturedAmount: 0 })).pointsToDeduct).toBe(0);
  });
});

// Small alias so the first test reads cleanly
async function createuserWithPointsSafe(points: number): Promise<string> {
  return createUserWithPoints(points);
}

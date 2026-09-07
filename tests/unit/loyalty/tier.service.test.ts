import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@pawtag/db', () => ({
  User: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  Subscription: {
    findOne: vi.fn(),
  },
  GuardianTierHistory: {
    find: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  Setting: {
    findOne: vi.fn(),
  },
}));

vi.mock('../../../packages/api/src/services/email.service', () => ({
  sendMail: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../packages/api/src/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  TIER_THRESHOLDS,
  TIER_BENEFITS,
  calculateTier,
} from '../../../packages/api/src/services/loyalty/tier.service';
import { User, GuardianTierHistory } from '@pawtag/db';

const mockUser = vi.mocked(User);
const mockTierHistory = vi.mocked(GuardianTierHistory);

beforeEach(() => {
  vi.clearAllMocks();
});

function mockUserWithPoints(points: number) {
  mockUser.findById.mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockReturnValue({ _id: 'u1', guardianPoints: points }),
    }),
  } as any);
}

function mockLifetimeHistory(entries: Array<{ tier: string; effectiveFrom: Date; effectiveTo: Date | null }>) {
  mockTierHistory.find.mockReturnValue({
    sort: vi.fn().mockReturnValue({
      lean: vi.fn().mockReturnValue(entries),
    }),
  } as any);
}

describe('TIER_THRESHOLDS', () => {
  it('has correct ranges', () => {
    expect(TIER_THRESHOLDS.CARE.min).toBe(0);
    expect(TIER_THRESHOLDS.CARE.max).toBe(99);
    expect(TIER_THRESHOLDS.NURTURE.min).toBe(100);
    expect(TIER_THRESHOLDS.NURTURE.max).toBe(199);
    expect(TIER_THRESHOLDS.PROTECTOR.min).toBe(200);
    expect(TIER_THRESHOLDS.PROTECTOR.max).toBe(299);
    expect(TIER_THRESHOLDS.SAFEGUARD.min).toBe(300);
    expect(TIER_THRESHOLDS.SAFEGUARD.max).toBe(Infinity);
  });
});

describe('TIER_BENEFITS', () => {
  it('has increasing rewards per tier', () => {
    expect(TIER_BENEFITS.CARE.pawRewardsMonthly).toBeLessThan(TIER_BENEFITS.NURTURE.pawRewardsMonthly);
    expect(TIER_BENEFITS.NURTURE.pawRewardsMonthly).toBeLessThan(TIER_BENEFITS.PROTECTOR.pawRewardsMonthly);
    expect(TIER_BENEFITS.PROTECTOR.pawRewardsMonthly).toBeLessThan(TIER_BENEFITS.SAFEGUARD.pawRewardsMonthly);
  });

  it('decreases free shipping threshold per tier', () => {
    expect(TIER_BENEFITS.CARE.freeShippingThreshold).toBeGreaterThan(TIER_BENEFITS.NURTURE.freeShippingThreshold);
    expect(TIER_BENEFITS.NURTURE.freeShippingThreshold).toBeGreaterThan(TIER_BENEFITS.PROTECTOR.freeShippingThreshold);
    expect(TIER_BENEFITS.PROTECTOR.freeShippingThreshold).toBeGreaterThan(TIER_BENEFITS.SAFEGUARD.freeShippingThreshold);
  });

  it('has early access at Protector and above', () => {
    expect(TIER_BENEFITS.CARE.earlyAccess).toBe(false);
    expect(TIER_BENEFITS.NURTURE.earlyAccess).toBe(false);
    expect(TIER_BENEFITS.PROTECTOR.earlyAccess).toBe(true);
    expect(TIER_BENEFITS.SAFEGUARD.earlyAccess).toBe(true);
  });

  it('has priority support at Protector and above', () => {
    expect(TIER_BENEFITS.CARE.prioritySupport).toBe(false);
    expect(TIER_BENEFITS.PROTECTOR.prioritySupport).toBe(true);
    expect(TIER_BENEFITS.SAFEGUARD.prioritySupport).toBe(true);
  });

  it('has annual gift at Protector and Safeguard', () => {
    expect(TIER_BENEFITS.CARE.annualGift).toBeUndefined();
    expect(TIER_BENEFITS.PROTECTOR.annualGift).toBe(false);
    expect(TIER_BENEFITS.SAFEGUARD.annualGift).toBe(true);
  });
});

describe('calculateTier', () => {
  it('returns CARE for 0-99 points', async () => {
    mockUserWithPoints(50);
    mockLifetimeHistory([]);

    const result = await calculateTier('u1');
    expect(result.tier).toBe('CARE');
    expect(result.points).toBe(50);
    expect(result.pointsToNextTier).toBe(50);
    expect(result.nextTier).toBe('NURTURE');
    expect(result.isLifetime).toBe(false);
  });

  it('returns NURTURE for 100-199 points', async () => {
    mockUserWithPoints(150);
    mockLifetimeHistory([]);

    const result = await calculateTier('u1');
    expect(result.tier).toBe('NURTURE');
    expect(result.points).toBe(150);
    expect(result.pointsToNextTier).toBe(50);
    expect(result.nextTier).toBe('PROTECTOR');
  });

  it('returns PROTECTOR for 200-299 points', async () => {
    mockUserWithPoints(250);
    mockLifetimeHistory([]);

    const result = await calculateTier('u1');
    expect(result.tier).toBe('PROTECTOR');
    expect(result.points).toBe(250);
    expect(result.pointsToNextTier).toBe(50);
    expect(result.nextTier).toBe('SAFEGUARD');
  });

  it('returns SAFEGUARD for 300+ points', async () => {
    mockUserWithPoints(350);
    mockLifetimeHistory([]);

    const result = await calculateTier('u1');
    expect(result.tier).toBe('SAFEGUARD');
    expect(result.points).toBe(350);
    expect(result.pointsToNextTier).toBeNull();
    expect(result.nextTier).toBeNull();
    expect(result.isLifetime).toBe(false);
  });

  it('returns SAFEGUARD tier for lifetime status with 3 consecutive years', async () => {
    mockUserWithPoints(100); // Would be NURTURE normally
    const now = new Date();

    // 3 consecutive years of SAFEGUARD history
    mockLifetimeHistory([
      { tier: 'SAFEGUARD', effectiveFrom: new Date(now.getFullYear() - 3, 0, 1), effectiveTo: new Date(now.getFullYear() - 2, 0, 1) },
      { tier: 'SAFEGUARD', effectiveFrom: new Date(now.getFullYear() - 2, 0, 1), effectiveTo: new Date(now.getFullYear() - 1, 0, 1) },
      { tier: 'SAFEGUARD', effectiveFrom: new Date(now.getFullYear() - 1, 0, 1), effectiveTo: null },
    ]);

    const result = await calculateTier('u1');
    expect(result.tier).toBe('SAFEGUARD');
    expect(result.isLifetime).toBe(true);
  });

  it('throws if user not found', async () => {
    mockUser.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue(null),
      }),
    } as any);

    await expect(calculateTier('nonexistent')).rejects.toThrow('User not found');
  });
});

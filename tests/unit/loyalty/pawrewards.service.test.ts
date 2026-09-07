import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@pawtag/db', () => ({
  User: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    find: vi.fn(),
  },
  Subscription: {
    findOne: vi.fn(),
  },
  Order: {
    find: vi.fn(),
  },
  Setting: {
    findOne: vi.fn(),
  },
  PawRewardsLedger: {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../../../packages/api/src/services/loyalty/tier.service', () => ({
  calculateTier: vi.fn(),
  TIER_BENEFITS: {
    CARE: { pawRewardsMonthly: 2.00 },
    NURTURE: { pawRewardsMonthly: 3.00 },
    PROTECTOR: { pawRewardsMonthly: 5.00 },
    SAFEGUARD: { pawRewardsMonthly: 8.00 },
  },
}));

vi.mock('../../../packages/api/src/services/email.service', () => ({
  sendMail: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../packages/api/src/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  PAWREWARDS_CONFIG,
  redeemRewards,
  getPawRewardsBalance,
  getPawRewardsHistory,
} from '../../../packages/api/src/services/loyalty/pawrewards.service';
import { User, PawRewardsLedger } from '@pawtag/db';

const mockUser = vi.mocked(User);
const mockLedger = vi.mocked(PawRewardsLedger);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PAWREWARDS_CONFIG', () => {
  it('has correct monthly allocations', () => {
    expect(PAWREWARDS_CONFIG.MONTHLY_ALLOCATION.CARE).toBe(2.00);
    expect(PAWREWARDS_CONFIG.MONTHLY_ALLOCATION.NURTURE).toBe(3.00);
    expect(PAWREWARDS_CONFIG.MONTHLY_ALLOCATION.PROTECTOR).toBe(5.00);
    expect(PAWREWARDS_CONFIG.MONTHLY_ALLOCATION.SAFEGUARD).toBe(8.00);
  });

  it('has increasing allocations per tier', () => {
    expect(PAWREWARDS_CONFIG.MONTHLY_ALLOCATION.CARE).toBeLessThan(
      PAWREWARDS_CONFIG.MONTHLY_ALLOCATION.NURTURE
    );
    expect(PAWREWARDS_CONFIG.MONTHLY_ALLOCATION.NURTURE).toBeLessThan(
      PAWREWARDS_CONFIG.MONTHLY_ALLOCATION.PROTECTOR
    );
    expect(PAWREWARDS_CONFIG.MONTHLY_ALLOCATION.PROTECTOR).toBeLessThan(
      PAWREWARDS_CONFIG.MONTHLY_ALLOCATION.SAFEGUARD
    );
  });

  it('has correct earning rates', () => {
    expect(PAWREWARDS_CONFIG.EARNING_RATE.GUARDIAN).toBe(50);
    expect(PAWREWARDS_CONFIG.EARNING_RATE.GOLD).toBe(25);
  });

  it('has correct redemption rules', () => {
    expect(PAWREWARDS_CONFIG.MINIMUM_REDEMPTION).toBe(2.00);
    expect(PAWREWARDS_CONFIG.EXPIRATION_MONTHS).toBe(6);
  });

  it('has correct max balances', () => {
    expect(PAWREWARDS_CONFIG.MAX_BALANCE.GUARDIAN).toBe(20.00);
    expect(PAWREWARDS_CONFIG.MAX_BALANCE.GOLD).toBe(40.00);
  });
});

describe('redeemRewards', () => {
  it('redeems rewards successfully', async () => {
    mockUser.findById.mockReturnValue({
      lean: vi.fn().mockReturnValue({ _id: 'u1', pawRewardsBalance: 10 }),
    } as any);
    mockLedger.create.mockResolvedValue({} as any);
    mockUser.findByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockReturnValue({ pawRewardsBalance: 5 }),
    } as any);

    const result = await redeemRewards('u1', 5, 'order123');
    expect(result.redeemed).toBe(5);
    expect(result.newBalance).toBe(5);
  });

  it('throws if amount below minimum', async () => {
    mockUser.findById.mockReturnValue({
      lean: vi.fn().mockReturnValue({ _id: 'u1', pawRewardsBalance: 10 }),
    } as any);

    await expect(redeemRewards('u1', 1, 'order123')).rejects.toThrow(
      'Minimum redemption is $2'
    );
  });

  it('throws if insufficient balance', async () => {
    mockUser.findById.mockReturnValue({
      lean: vi.fn().mockReturnValue({ _id: 'u1', pawRewardsBalance: 3 }),
    } as any);

    await expect(redeemRewards('u1', 5, 'order123')).rejects.toThrow(
      'Insufficient PawRewards balance'
    );
  });
});

describe('getPawRewardsBalance', () => {
  it('returns full balance info', async () => {
    mockUser.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          pawRewardsBalance: 15.50,
          pawRewardsTotalEarned: 25.00,
          pawRewardsTotalRedeemed: 10.00,
          pawRewardsTotalExpired: 2.50,
        }),
      }),
    } as any);

    // Mock getNextExpiration: findOne returns null (no expiring rewards)
    mockLedger.findOne.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue(null),
      }),
    } as any);

    const result = await getPawRewardsBalance('u1');
    expect(result.balance).toBe(15.50);
    expect(result.totalEarned).toBe(25.00);
    expect(result.totalRedeemed).toBe(10.00);
    expect(result.totalExpired).toBe(2.50);
  });

  it('throws if user not found', async () => {
    mockUser.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue(null),
      }),
    } as any);

    await expect(getPawRewardsBalance('nonexistent')).rejects.toThrow('User not found');
  });
});

describe('getPawRewardsHistory', () => {
  it('returns transaction history', async () => {
    mockLedger.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockReturnValue([
              { amount: 5, type: 'redemption', description: 'Redeemed', createdAt: new Date() },
              { amount: 2, type: 'allocation', description: 'Monthly', createdAt: new Date() },
            ]),
          }),
        }),
      }),
    } as any);

    const result = await getPawRewardsHistory('u1');
    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe(5);
    expect(result[0].type).toBe('redemption');
    expect(result[1].amount).toBe(2);
    expect(result[1].type).toBe('allocation');
  });
});

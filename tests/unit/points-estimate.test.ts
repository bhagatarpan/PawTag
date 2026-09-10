import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@pawtag/db', () => ({
  Setting: {
    findOne: vi.fn(),
  },
}));

vi.mock('../../packages/api/src/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getGuardianNumber } from '../../packages/api/src/services/loyalty/guardian-config';
import { clearGuardianCache } from '../../packages/api/src/services/loyalty/guardian-config';
import { Setting } from '@pawtag/db';

const mockSetting = vi.mocked(Setting);

function mockSettings(settings: Record<string, string>) {
  mockSetting.findOne.mockImplementation(({ key }: any) => ({
    lean: vi.fn().mockReturnValue(settings[key] !== undefined ? { value: settings[key] } : null),
  }) as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  clearGuardianCache();
  // Default settings: rate=1, spentAmount=1 for Guardian; rate=2, spentAmount=1 for Gold
  mockSettings({
    'guardian.purchaseRateGuardian': '1',
    'guardian.purchaseSpentAmount': '1',
    'guardian.purchaseRateGold': '2',
    'guardian.purchaseSpentAmountGold': '1',
  });
});

// Simulate the formula used by the backend endpoint and frontend
function calculatePoints(total: number, isGoldMember: boolean, rates: { guardianRate: number; guardianSpentAmount: number; goldRate: number; goldSpentAmount: number }): number {
  const rate = isGoldMember ? rates.goldRate : rates.guardianRate;
  const spentAmount = isGoldMember ? rates.goldSpentAmount : rates.guardianSpentAmount;
  return Math.floor((total / spentAmount) * rate);
}

describe('Points calculation formula', () => {
  describe('Default settings (rate=1, spentAmount=1 for Guardian; rate=2, spentAmount=1 for Gold)', () => {
    it('calculates 1pt per $1 for Guardian', async () => {
      const rates = {
        guardianRate: await getGuardianNumber('purchaseRateGuardian'),
        guardianSpentAmount: await getGuardianNumber('purchaseSpentAmount'),
        goldRate: await getGuardianNumber('purchaseRateGold'),
        goldSpentAmount: await getGuardianNumber('purchaseSpentAmountGold'),
      };
      expect(calculatePoints(9.99, false, rates)).toBe(9);
      expect(calculatePoints(100, false, rates)).toBe(100);
      expect(calculatePoints(0, false, rates)).toBe(0);
    });

    it('calculates 2pts per $1 for Gold', async () => {
      const rates = {
        guardianRate: await getGuardianNumber('purchaseRateGuardian'),
        guardianSpentAmount: await getGuardianNumber('purchaseSpentAmount'),
        goldRate: await getGuardianNumber('purchaseRateGold'),
        goldSpentAmount: await getGuardianNumber('purchaseSpentAmountGold'),
      };
      expect(calculatePoints(9.99, true, rates)).toBe(19);
      expect(calculatePoints(100, true, rates)).toBe(200);
    });

    it('floors fractional points', async () => {
      const rates = {
        guardianRate: await getGuardianNumber('purchaseRateGuardian'),
        guardianSpentAmount: await getGuardianNumber('purchaseSpentAmount'),
        goldRate: await getGuardianNumber('purchaseRateGold'),
        goldSpentAmount: await getGuardianNumber('purchaseSpentAmountGold'),
      };
      expect(calculatePoints(0.50, false, rates)).toBe(0);
      expect(calculatePoints(1.99, false, rates)).toBe(1);
    });
  });

  describe('Custom settings (rate=1, spentAmount=10 for Guardian)', () => {
    beforeEach(() => {
      mockSettings({
        'guardian.purchaseRateGuardian': '1',
        'guardian.purchaseSpentAmount': '10',
        'guardian.purchaseRateGold': '2',
        'guardian.purchaseSpentAmountGold': '5',
      });
      clearGuardianCache();
    });

    it('$9.99 order earns 0 Guardian points (below $10 threshold)', async () => {
      const rates = {
        guardianRate: await getGuardianNumber('purchaseRateGuardian'),
        guardianSpentAmount: await getGuardianNumber('purchaseSpentAmount'),
        goldRate: await getGuardianNumber('purchaseRateGold'),
        goldSpentAmount: await getGuardianNumber('purchaseSpentAmountGold'),
      };
      expect(calculatePoints(9.99, false, rates)).toBe(0);
    });

    it('$10 order earns 1 Guardian point', async () => {
      const rates = {
        guardianRate: await getGuardianNumber('purchaseRateGuardian'),
        guardianSpentAmount: await getGuardianNumber('purchaseSpentAmount'),
        goldRate: await getGuardianNumber('purchaseRateGold'),
        goldSpentAmount: await getGuardianNumber('purchaseSpentAmountGold'),
      };
      expect(calculatePoints(10, false, rates)).toBe(1);
    });

    it('$9.99 order earns 3 Gold points (spentAmount=5)', async () => {
      const rates = {
        guardianRate: await getGuardianNumber('purchaseRateGuardian'),
        guardianSpentAmount: await getGuardianNumber('purchaseSpentAmount'),
        goldRate: await getGuardianNumber('purchaseRateGold'),
        goldSpentAmount: await getGuardianNumber('purchaseSpentAmountGold'),
      };
      expect(calculatePoints(9.99, true, rates)).toBe(3);
    });

    it('$50 order earns 5 Guardian points', async () => {
      const rates = {
        guardianRate: await getGuardianNumber('purchaseRateGuardian'),
        guardianSpentAmount: await getGuardianNumber('purchaseSpentAmount'),
        goldRate: await getGuardianNumber('purchaseRateGold'),
        goldSpentAmount: await getGuardianNumber('purchaseSpentAmountGold'),
      };
      expect(calculatePoints(50, false, rates)).toBe(5);
    });

    it('$50 order earns 20 Gold points', async () => {
      const rates = {
        guardianRate: await getGuardianNumber('purchaseRateGuardian'),
        guardianSpentAmount: await getGuardianNumber('purchaseSpentAmount'),
        goldRate: await getGuardianNumber('purchaseRateGold'),
        goldSpentAmount: await getGuardianNumber('purchaseSpentAmountGold'),
      };
      expect(calculatePoints(50, true, rates)).toBe(20);
    });
  });

  describe('Edge cases', () => {
    it('handles zero total', async () => {
      const rates = {
        guardianRate: await getGuardianNumber('purchaseRateGuardian'),
        guardianSpentAmount: await getGuardianNumber('purchaseSpentAmount'),
        goldRate: await getGuardianNumber('purchaseRateGold'),
        goldSpentAmount: await getGuardianNumber('purchaseSpentAmountGold'),
      };
      expect(calculatePoints(0, false, rates)).toBe(0);
    });

    it('handles very large totals', async () => {
      const rates = {
        guardianRate: await getGuardianNumber('purchaseRateGuardian'),
        guardianSpentAmount: await getGuardianNumber('purchaseSpentAmount'),
        goldRate: await getGuardianNumber('purchaseRateGold'),
        goldSpentAmount: await getGuardianNumber('purchaseSpentAmountGold'),
      };
      expect(calculatePoints(100000, false, rates)).toBe(100000);
    });

    it('handles very small totals', async () => {
      const rates = {
        guardianRate: await getGuardianNumber('purchaseRateGuardian'),
        guardianSpentAmount: await getGuardianNumber('purchaseSpentAmount'),
        goldRate: await getGuardianNumber('purchaseRateGold'),
        goldSpentAmount: await getGuardianNumber('purchaseSpentAmountGold'),
      };
      expect(calculatePoints(0.01, false, rates)).toBe(0);
    });
  });
});

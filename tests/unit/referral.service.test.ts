import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@pawtag/db', () => ({
  ReferralCode: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  Referral: {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    countDocuments: vi.fn(),
  },
  User: {
    findById: vi.fn(),
  },
  Subscription: {
    findOne: vi.fn(),
  },
}));

vi.mock('../../packages/api/src/services/email.service', () => ({
  sendMail: vi.fn().mockResolvedValue({}),
}));

import {
  getOrCreateReferralCode,
  validateReferralCode,
  createReferralOnOrder,
  getReferralStats,
  getReferralHistory,
} from '../../packages/api/src/services/referral.service';
import { ReferralCode, Referral, User } from '@pawtag/db';

const mockReferralCode = vi.mocked(ReferralCode);
const mockReferral = vi.mocked(Referral);
const mockUser = vi.mocked(User);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('referral.service', () => {
  describe('getOrCreateReferralCode', () => {
    it('returns existing active code', async () => {
      mockReferralCode.findOne.mockResolvedValue({ code: 'ABC12345' });
      const code = await getOrCreateReferralCode('user1');
      expect(code).toBe('ABC12345');
    });

    it('creates new code when none exists', async () => {
      mockReferralCode.findOne.mockResolvedValueOnce(null); // existing check
      mockReferralCode.findOne.mockResolvedValueOnce(null); // uniqueness check
      mockReferralCode.findOneAndUpdate.mockResolvedValue({ code: 'XYZ98765' });

      const code = await getOrCreateReferralCode('user1');
      expect(code).toBe('XYZ98765');
      expect(mockReferralCode.findOneAndUpdate).toHaveBeenCalled();
    });

    it('generates 8-character code', async () => {
      mockReferralCode.findOne.mockResolvedValueOnce(null);
      mockReferralCode.findOne.mockResolvedValueOnce(null);
      mockReferralCode.findOneAndUpdate.mockImplementation((_q, update: any) => {
        return Promise.resolve({ code: update.code });
      });

      const code = await getOrCreateReferralCode('user1');
      expect(code.length).toBe(8);
    });
  });

  describe('validateReferralCode', () => {
    it('returns valid with referrer name for existing code', async () => {
      const mockPopulateResult = {
        code: 'ABC12345',
        userId: { fullName: 'John Doe', _id: { toString: () => 'user123' } },
      };
      mockReferralCode.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockPopulateResult),
      } as any);

      const result = await validateReferralCode('ABC12345');
      expect(result.valid).toBe(true);
      expect(result.referrerName).toBe('John Doe');
      expect(result.referrerId).toBe('user123');
    });

    it('returns invalid for non-existent code', async () => {
      mockReferralCode.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(null),
      } as any);

      const result = await validateReferralCode('INVALID');
      expect(result.valid).toBe(false);
    });

    it('converts code to uppercase', async () => {
      const populateFn = vi.fn().mockResolvedValue(null);
      mockReferralCode.findOne.mockReturnValue({
        populate: populateFn,
      } as any);

      await validateReferralCode('abc12345');
      expect(mockReferralCode.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ABC12345' })
      );
    });
  });

  describe('createReferralOnOrder', () => {
    it('creates referral record', async () => {
      mockReferral.findOne.mockResolvedValue(null);
      await createReferralOnOrder('referrer1', 'referee1', 'CODE1234', 'order1');
      expect(mockReferral.create).toHaveBeenCalledWith(
        expect.objectContaining({
          referrerId: 'referrer1',
          refereeId: 'referee1',
          referralCode: 'CODE1234',
          status: 'pending',
          orderId: 'order1',
        })
      );
    });

    it('does not create duplicate referral for same referee', async () => {
      mockReferral.findOne.mockResolvedValue({ _id: 'existing' });
      await createReferralOnOrder('referrer1', 'referee1', 'CODE1234', 'order1');
      expect(mockReferral.create).not.toHaveBeenCalled();
    });
  });

  describe('getReferralStats', () => {
    it('returns correct stats', async () => {
      vi.mocked(Referral.countDocuments)
        .mockResolvedValueOnce(5)  // total
        .mockResolvedValueOnce(3)  // completed
        .mockResolvedValueOnce(2); // pending

      vi.mocked(Referral.find).mockResolvedValue([
        { referrerRewardMonths: 1 },
        { referrerRewardMonths: 1 },
        { referrerRewardMonths: 1 },
      ]);

      const stats = await getReferralStats('user1');
      expect(stats.totalReferrals).toBe(5);
      expect(stats.completedReferrals).toBe(3);
      expect(stats.pendingReferrals).toBe(2);
      expect(stats.totalRewardMonths).toBe(3);
    });
  });

  describe('getReferralHistory', () => {
    it('returns referral history', async () => {
      const mockHistory = [
        { _id: 'r1', referralCode: 'CODE1', createdAt: new Date() },
        { _id: 'r2', referralCode: 'CODE2', createdAt: new Date() },
      ];
      mockReferral.find.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue(mockHistory),
            }),
          }),
        }),
      } as any);

      const history = await getReferralHistory('user1');
      expect(history).toEqual(mockHistory);
    });
  });
});

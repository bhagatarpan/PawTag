import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@pawtag/db', () => ({
  User: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  Subscription: {
    findOne: vi.fn(),
  },
  Order: {
    countDocuments: vi.fn(),
  },
  GuardianPointsLedger: {
    countDocuments: vi.fn(),
    create: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock('../../../packages/api/src/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  POINTS_CONFIG,
  awardPurchasePoints,
  awardReviewPoints,
  awardReferralPoints,
  awardPetMilestonePoints,
  awardTagScanPoints,
} from '../../../packages/api/src/services/loyalty/points-earning.service';
import { User, Subscription, Order, GuardianPointsLedger } from '@pawtag/db';

const mockUser = vi.mocked(User);
const mockSubscription = vi.mocked(Subscription);
const mockOrder = vi.mocked(Order);
const mockLedger = vi.mocked(GuardianPointsLedger);

function setupMocks(points: number, isGold = false, orderCount = 0) {
  mockUser.findById.mockReturnValue({
    lean: vi.fn().mockReturnValue({ _id: 'u1', guardianPoints: points }),
  } as any);

  mockSubscription.findOne.mockReturnValue({
    lean: vi.fn().mockReturnValue(
      isGold ? { planType: 'monthly', price: 1.99 } : { planType: 'annual', price: 0.99 }
    ),
  } as any);

  mockOrder.countDocuments.mockResolvedValue(orderCount);
  mockLedger.countDocuments.mockResolvedValue(0);
  mockLedger.create.mockResolvedValue({} as any);

  mockUser.findByIdAndUpdate.mockReturnValue({
    lean: vi.fn().mockReturnValue({ guardianPoints: points + 10 }),
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POINTS_CONFIG', () => {
  it('has correct purchase rates', () => {
    expect(POINTS_CONFIG.PURCHASE_RATE).toBe(1);
    expect(POINTS_CONFIG.PURCHASE_RATE_GOLD).toBe(2);
    expect(POINTS_CONFIG.GOLD_MULTIPLIER).toBe(2);
  });

  it('has correct review points', () => {
    expect(POINTS_CONFIG.REVIEW_TEXT).toBe(5);
    expect(POINTS_CONFIG.REVIEW_PHOTO).toBe(15);
    expect(POINTS_CONFIG.REVIEW_VIDEO).toBe(25);
  });

  it('has correct referral points', () => {
    expect(POINTS_CONFIG.REFERRAL_SIGNUP).toBe(20);
    expect(POINTS_CONFIG.REFERRAL_PURCHASE).toBe(50);
  });

  it('has correct pet milestone points', () => {
    expect(POINTS_CONFIG.PET_PROFILE_COMPLETE).toBe(15);
    expect(POINTS_CONFIG.PET_BIRTHDAY).toBe(10);
    expect(POINTS_CONFIG.PET_ADOPTION_ANNIVERSARY).toBe(10);
  });

  it('has correct tag scan config', () => {
    expect(POINTS_CONFIG.TAG_SCAN).toBe(2);
    expect(POINTS_CONFIG.TAG_SCAN_DAILY_LIMIT).toBe(3);
  });

  it('has correct social and lost pet points', () => {
    expect(POINTS_CONFIG.LOST_PET_REPORT).toBe(5);
    expect(POINTS_CONFIG.PET_REUNITED).toBe(20);
    expect(POINTS_CONFIG.SOCIAL_SHARE).toBe(3);
  });

  it('has correct repeat purchase bonuses', () => {
    expect(POINTS_CONFIG.REPEAT_PURCHASE_BONUS).toBe(10);
    expect(POINTS_CONFIG.REPEAT_PURCHASE_BONUS_GOLD).toBe(20);
  });

  it('has correct annual caps', () => {
    expect(POINTS_CONFIG.ANNUAL_CAPS.REFERRAL_SIGNUP).toBe(200);
    expect(POINTS_CONFIG.ANNUAL_CAPS.TAG_SCAN).toBe(100);
    expect(POINTS_CONFIG.ANNUAL_CAPS.REVIEW_TEXT).toBe(30);
  });
});

describe('awardPurchasePoints', () => {
  it('throws if user not found', async () => {
    mockUser.findById.mockReturnValue({
      lean: vi.fn().mockReturnValue(null),
    } as any);

    await expect(awardPurchasePoints('u1', 100, 'o1')).rejects.toThrow('User not found');
  });

  it('awards 1 pt per $1 for Guardian members', async () => {
    setupMocks(50, false, 0);
    const result = await awardPurchasePoints('u1', 100, 'o1');
    expect(result.pointsAwarded).toBe(100);
    expect(result.activity).toBe('purchase');
    expect(result.isGoldMember).toBe(false);
  });

  it('awards 2 pts per $1 for Gold members', async () => {
    setupMocks(50, true, 0);
    const result = await awardPurchasePoints('u1', 100, 'o1');
    expect(result.pointsAwarded).toBe(200);
    expect(result.isGoldMember).toBe(true);
  });

  it('adds repeat purchase bonus for 3rd+ order (Guardian)', async () => {
    setupMocks(50, false, 3);
    const result = await awardPurchasePoints('u1', 100, 'o1');
    expect(result.pointsAwarded).toBe(110); // 100 + 10 bonus
  });

  it('adds repeat purchase bonus for 3rd+ order (Gold)', async () => {
    setupMocks(50, true, 3);
    const result = await awardPurchasePoints('u1', 100, 'o1');
    expect(result.pointsAwarded).toBe(220); // 200 + 20 bonus
  });

  it('does not add repeat bonus for < 3 orders', async () => {
    setupMocks(50, false, 2);
    const result = await awardPurchasePoints('u1', 100, 'o1');
    expect(result.pointsAwarded).toBe(100);
  });
});

describe('awardReviewPoints', () => {
  it('awards 5 pts for text review', async () => {
    setupMocks(50);
    const result = await awardReviewPoints('u1', 'text', 'p1');
    expect(result.pointsAwarded).toBe(5);
    expect(result.activity).toBe('review_text');
  });

  it('awards 15 pts for photo review', async () => {
    setupMocks(50);
    const result = await awardReviewPoints('u1', 'photo', 'p1');
    expect(result.pointsAwarded).toBe(15);
    expect(result.activity).toBe('review_photo');
  });

  it('awards 25 pts for video review', async () => {
    setupMocks(50);
    const result = await awardReviewPoints('u1', 'video', 'p1');
    expect(result.pointsAwarded).toBe(25);
    expect(result.activity).toBe('review_video');
  });

  it('doubles points for Gold members', async () => {
    setupMocks(50, true);
    const result = await awardReviewPoints('u1', 'text', 'p1');
    expect(result.pointsAwarded).toBe(10); // 5 * 2
  });
});

describe('awardReferralPoints', () => {
  it('awards 20 pts for signup referral', async () => {
    setupMocks(50);
    const result = await awardReferralPoints('u1', 'signup', 'u2');
    expect(result.pointsAwarded).toBe(20);
    expect(result.activity).toBe('referral_signup');
  });

  it('awards 50 pts for purchase referral', async () => {
    setupMocks(50);
    const result = await awardReferralPoints('u1', 'purchase', 'u2');
    expect(result.pointsAwarded).toBe(50);
    expect(result.activity).toBe('referral_purchase');
  });

  it('doubles points for Gold members', async () => {
    setupMocks(50, true);
    const result = await awardReferralPoints('u1', 'signup', 'u2');
    expect(result.pointsAwarded).toBe(40); // 20 * 2
  });
});

describe('awardPetMilestonePoints', () => {
  it('awards 15 pts for profile completion', async () => {
    setupMocks(50);
    const result = await awardPetMilestonePoints('u1', 'profile_complete', 'pet1');
    expect(result.pointsAwarded).toBe(15);
    expect(result.activity).toBe('pet_profile_complete');
  });

  it('awards 10 pts for birthday', async () => {
    setupMocks(50);
    const result = await awardPetMilestonePoints('u1', 'birthday', 'pet1');
    expect(result.pointsAwarded).toBe(10);
    expect(result.activity).toBe('pet_birthday');
  });

  it('doubles points for Gold members', async () => {
    setupMocks(50, true);
    const result = await awardPetMilestonePoints('u1', 'profile_complete', 'pet1');
    expect(result.pointsAwarded).toBe(30); // 15 * 2
  });
});

describe('awardTagScanPoints', () => {
  it('awards 2 pts per scan', async () => {
    setupMocks(50);
    const result = await awardTagScanPoints('u1', 'tag1');
    expect(result.pointsAwarded).toBe(2);
    expect(result.activity).toBe('tag_scan');
  });

  it('doubles points for Gold members', async () => {
    setupMocks(50, true);
    const result = await awardTagScanPoints('u1', 'tag1');
    expect(result.pointsAwarded).toBe(4); // 2 * 2
  });
});

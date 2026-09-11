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
  Setting: {
    findOne: vi.fn().mockReturnValue({ lean: vi.fn().mockReturnValue(null) }),
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

vi.mock('../../../packages/api/src/lib/metrics', () => ({
  incrementCounter: vi.fn(),
  METRICS: { LOYALTY_POINTS_EARNED_TOTAL: 'loyalty_points_earned_total' },
}));

import {
  POINTS_CONFIG,
  awardPurchasePoints,
  awardReviewPoints,
  awardReferralPoints,
  awardPetMilestonePoints,
  awardTagActivationPoints,
  awardSocialSharePoints,
  awardMembershipMilestonePoints,
} from '../../../packages/api/src/services/loyalty/points-earning.service';
import { clearGuardianCache } from '../../../packages/api/src/services/loyalty/guardian-config';
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
      isGold ? { planType: 'gold', price: 1.99 } : { planType: 'annual', price: 0.99 }
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
  clearGuardianCache();
});

// ---------------------------------------------------------------------------
// POINTS_CONFIG constants
// ---------------------------------------------------------------------------
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

  it('has correct social share points', () => {
    expect(POINTS_CONFIG.SOCIAL_SHARE).toBe(3);
  });

  it('has correct repeat purchase bonuses', () => {
    expect(POINTS_CONFIG.REPEAT_PURCHASE_BONUS).toBe(10);
    expect(POINTS_CONFIG.REPEAT_PURCHASE_BONUS_GOLD).toBe(20);
  });

  it('has correct annual caps', () => {
    expect(POINTS_CONFIG.ANNUAL_CAPS.REFERRAL_SIGNUP).toBe(200);
    expect(POINTS_CONFIG.ANNUAL_CAPS.REVIEW_TEXT).toBe(30);
    expect(POINTS_CONFIG.ANNUAL_CAPS.REVIEW_PHOTO).toBe(50);
    expect(POINTS_CONFIG.ANNUAL_CAPS.REVIEW_VIDEO).toBe(75);
  });
});

// ---------------------------------------------------------------------------
// Purchase points — formula: Math.floor((orderTotal / spentAmount) * rate)
// Default settings: rate=1, spentAmount=1 for Guardian; rate=2, spentAmount=1 for Gold
// ---------------------------------------------------------------------------
describe('awardPurchasePoints', () => {
  it('throws if user not found', async () => {
    mockUser.findById.mockReturnValue({
      lean: vi.fn().mockReturnValue(null),
    } as any);

    await expect(awardPurchasePoints('u1', 100, 'o1')).rejects.toThrow('User not found');
  });

  it('awards 1 pt per $1 for Guardian (default settings)', async () => {
    setupMocks(50, false, 0);
    const result = await awardPurchasePoints('u1', 100, 'o1');
    expect(result.pointsAwarded).toBe(100);
    expect(result.activity).toBe('purchase');
    expect(result.isGoldMember).toBe(false);
  });

  it('awards 2 pts per $1 for Gold (default settings)', async () => {
    setupMocks(50, true, 0);
    const result = await awardPurchasePoints('u1', 100, 'o1');
    expect(result.pointsAwarded).toBe(200);
    expect(result.isGoldMember).toBe(true);
  });

  it('floors fractional points (e.g. $99.99 / $1 * 1 = 99)', async () => {
    setupMocks(0, false, 0);
    const result = await awardPurchasePoints('u1', 99.99, 'o1');
    expect(result.pointsAwarded).toBe(99);
  });

  it('handles zero order total', async () => {
    setupMocks(0, false, 0);
    const result = await awardPurchasePoints('u1', 0, 'o1');
    expect(result.pointsAwarded).toBe(0);
  });

  it('handles large order total', async () => {
    setupMocks(0, false, 0);
    const result = await awardPurchasePoints('u1', 10000, 'o1');
    expect(result.pointsAwarded).toBe(10000);
  });

  it('handles small order total', async () => {
    setupMocks(0, false, 0);
    const result = await awardPurchasePoints('u1', 0.50, 'o1');
    expect(result.pointsAwarded).toBe(0);
  });

  it('updates user guardianPoints', async () => {
    setupMocks(50, false, 0);
    await awardPurchasePoints('u1', 100, 'o1');
    expect(mockUser.findByIdAndUpdate).toHaveBeenCalledWith(
      'u1',
      { $inc: { guardianPoints: 100 } },
      { new: true }
    );
  });

  // --- Repeat purchase bonus ---

  it('does not add repeat bonus for < 3 orders', async () => {
    setupMocks(50, false, 2);
    const result = await awardPurchasePoints('u1', 100, 'o1');
    expect(result.pointsAwarded).toBe(100);
  });

  it('adds repeat bonus on exactly 3rd order (Guardian)', async () => {
    setupMocks(50, false, 3);
    const result = await awardPurchasePoints('u1', 100, 'o1');
    expect(result.pointsAwarded).toBe(110); // 100 + 10 bonus
  });

  it('adds repeat bonus on 10th order (Guardian)', async () => {
    setupMocks(50, false, 10);
    const result = await awardPurchasePoints('u1', 100, 'o1');
    expect(result.pointsAwarded).toBe(110); // 100 + 10 bonus
  });

  it('adds repeat bonus on 3rd+ order (Gold)', async () => {
    setupMocks(50, true, 3);
    const result = await awardPurchasePoints('u1', 100, 'o1');
    expect(result.pointsAwarded).toBe(220); // 200 + 20 bonus
  });

  it('does not add repeat bonus for Gold with < 3 orders', async () => {
    setupMocks(50, true, 2);
    const result = await awardPurchasePoints('u1', 100, 'o1');
    expect(result.pointsAwarded).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Review points — text/photo/video with Gold multiplier
// ---------------------------------------------------------------------------
describe('awardReviewPoints', () => {
  it('throws if user not found', async () => {
    mockUser.findById.mockReturnValue({
      lean: vi.fn().mockReturnValue(null),
    } as any);

    await expect(awardReviewPoints('u1', 'text', 'p1')).rejects.toThrow('User not found');
  });

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

  it('doubles text review points for Gold members', async () => {
    setupMocks(50, true);
    const result = await awardReviewPoints('u1', 'text', 'p1');
    expect(result.pointsAwarded).toBe(10); // 5 * 2
    expect(result.isGoldMember).toBe(true);
  });

  it('doubles photo review points for Gold members', async () => {
    setupMocks(50, true);
    const result = await awardReviewPoints('u1', 'photo', 'p1');
    expect(result.pointsAwarded).toBe(30); // 15 * 2
  });

  it('doubles video review points for Gold members', async () => {
    setupMocks(50, true);
    const result = await awardReviewPoints('u1', 'video', 'p1');
    expect(result.pointsAwarded).toBe(50); // 25 * 2
  });
});

// ---------------------------------------------------------------------------
// Referral points — signup/purchase with Gold multiplier
// ---------------------------------------------------------------------------
describe('awardReferralPoints', () => {
  it('throws if user not found', async () => {
    mockUser.findById.mockReturnValue({
      lean: vi.fn().mockReturnValue(null),
    } as any);

    await expect(awardReferralPoints('u1', 'signup', 'u2')).rejects.toThrow('User not found');
  });

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

  it('doubles signup referral points for Gold members', async () => {
    setupMocks(50, true);
    const result = await awardReferralPoints('u1', 'signup', 'u2');
    expect(result.pointsAwarded).toBe(40); // 20 * 2
    expect(result.isGoldMember).toBe(true);
  });

  it('doubles purchase referral points for Gold members', async () => {
    setupMocks(50, true);
    const result = await awardReferralPoints('u1', 'purchase', 'u2');
    expect(result.pointsAwarded).toBe(100); // 50 * 2
  });
});

// ---------------------------------------------------------------------------
// Pet milestone points — profile_complete/birthday/adoption_anniversary
// ---------------------------------------------------------------------------
describe('awardPetMilestonePoints', () => {
  it('throws if user not found', async () => {
    mockUser.findById.mockReturnValue({
      lean: vi.fn().mockReturnValue(null),
    } as any);

    await expect(awardPetMilestonePoints('u1', 'profile_complete', 'pet1')).rejects.toThrow('User not found');
  });

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

  it('awards 10 pts for adoption anniversary', async () => {
    setupMocks(50);
    const result = await awardPetMilestonePoints('u1', 'adoption_anniversary', 'pet1');
    expect(result.pointsAwarded).toBe(10);
    expect(result.activity).toBe('pet_adoption_anniversary');
  });

  it('doubles profile completion points for Gold members', async () => {
    setupMocks(50, true);
    const result = await awardPetMilestonePoints('u1', 'profile_complete', 'pet1');
    expect(result.pointsAwarded).toBe(30); // 15 * 2
    expect(result.isGoldMember).toBe(true);
  });

  it('doubles birthday points for Gold members', async () => {
    setupMocks(50, true);
    const result = await awardPetMilestonePoints('u1', 'birthday', 'pet1');
    expect(result.pointsAwarded).toBe(20); // 10 * 2
  });

  it('doubles adoption anniversary points for Gold members', async () => {
    setupMocks(50, true);
    const result = await awardPetMilestonePoints('u1', 'adoption_anniversary', 'pet1');
    expect(result.pointsAwarded).toBe(20); // 10 * 2
  });
});

// ---------------------------------------------------------------------------
// Tag activation points — new tags only, NOT replacement tags
// ---------------------------------------------------------------------------
describe('awardTagActivationPoints', () => {
  it('throws if user not found', async () => {
    mockUser.findById.mockReturnValue({
      lean: vi.fn().mockReturnValue(null),
    } as any);

    await expect(awardTagActivationPoints('u1', 'tag1')).rejects.toThrow('User not found');
  });

  it('awards 10 pts for tag activation', async () => {
    setupMocks(50);
    const result = await awardTagActivationPoints('u1', 'tag1');
    expect(result.pointsAwarded).toBe(10);
    expect(result.activity).toBe('tag_activation');
  });

  it('doubles points for Gold members', async () => {
    setupMocks(50, true);
    const result = await awardTagActivationPoints('u1', 'tag1');
    expect(result.pointsAwarded).toBe(20); // 10 * 2
    expect(result.isGoldMember).toBe(true);
  });

  it('updates user guardianPoints', async () => {
    setupMocks(50);
    await awardTagActivationPoints('u1', 'tag1');
    expect(mockUser.findByIdAndUpdate).toHaveBeenCalledWith(
      'u1',
      { $inc: { guardianPoints: 10 } },
      { new: true }
    );
  });
});

// ---------------------------------------------------------------------------
// Social share points
// ---------------------------------------------------------------------------
describe('awardSocialSharePoints', () => {
  it('throws if user not found', async () => {
    mockUser.findById.mockReturnValue({
      lean: vi.fn().mockReturnValue(null),
    } as any);

    await expect(awardSocialSharePoints('u1', 'facebook')).rejects.toThrow('User not found');
  });

  it('awards 3 pts for social share', async () => {
    setupMocks(50);
    const result = await awardSocialSharePoints('u1', 'facebook');
    expect(result.pointsAwarded).toBe(3);
    expect(result.activity).toBe('social_share');
  });

  it('doubles points for Gold members', async () => {
    setupMocks(50, true);
    const result = await awardSocialSharePoints('u1', 'twitter');
    expect(result.pointsAwarded).toBe(6); // 3 * 2
    expect(result.isGoldMember).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Membership milestone points — monthly/annual
// ---------------------------------------------------------------------------
describe('awardMembershipMilestonePoints', () => {
  it('throws if user not found', async () => {
    mockUser.findById.mockReturnValue({
      lean: vi.fn().mockReturnValue(null),
    } as any);

    await expect(awardMembershipMilestonePoints('u1', 'monthly')).rejects.toThrow('User not found');
  });

  it('awards 5 pts for monthly milestone', async () => {
    setupMocks(50);
    const result = await awardMembershipMilestonePoints('u1', 'monthly');
    expect(result.pointsAwarded).toBe(5);
    expect(result.activity).toBe('membership_monthly');
  });

  it('awards 25 pts for annual milestone', async () => {
    setupMocks(50);
    const result = await awardMembershipMilestonePoints('u1', 'annual');
    expect(result.pointsAwarded).toBe(25);
    expect(result.activity).toBe('membership_annual');
  });

  it('doubles monthly milestone points for Gold members', async () => {
    setupMocks(50, true);
    const result = await awardMembershipMilestonePoints('u1', 'monthly');
    expect(result.pointsAwarded).toBe(10); // 5 * 2
    expect(result.isGoldMember).toBe(true);
  });

  it('doubles annual milestone points for Gold members', async () => {
    setupMocks(50, true);
    const result = await awardMembershipMilestonePoints('u1', 'annual');
    expect(result.pointsAwarded).toBe(50); // 25 * 2
  });
});

// ---------------------------------------------------------------------------
// Gold multiplier — verify all activities are doubled
// ---------------------------------------------------------------------------
describe('Gold multiplier across all activities', () => {
  it('doubles review text points', async () => {
    setupMocks(50, true);
    const result = await awardReviewPoints('u1', 'text', 'p1');
    expect(result.pointsAwarded).toBe(10);
  });

  it('doubles review photo points', async () => {
    setupMocks(50, true);
    const result = await awardReviewPoints('u1', 'photo', 'p1');
    expect(result.pointsAwarded).toBe(30);
  });

  it('doubles review video points', async () => {
    setupMocks(50, true);
    const result = await awardReviewPoints('u1', 'video', 'p1');
    expect(result.pointsAwarded).toBe(50);
  });

  it('doubles referral signup points', async () => {
    setupMocks(50, true);
    const result = await awardReferralPoints('u1', 'signup', 'u2');
    expect(result.pointsAwarded).toBe(40);
  });

  it('doubles referral purchase points', async () => {
    setupMocks(50, true);
    const result = await awardReferralPoints('u1', 'purchase', 'u2');
    expect(result.pointsAwarded).toBe(100);
  });

  it('doubles pet profile points', async () => {
    setupMocks(50, true);
    const result = await awardPetMilestonePoints('u1', 'profile_complete', 'pet1');
    expect(result.pointsAwarded).toBe(30);
  });

  it('doubles pet birthday points', async () => {
    setupMocks(50, true);
    const result = await awardPetMilestonePoints('u1', 'birthday', 'pet1');
    expect(result.pointsAwarded).toBe(20);
  });

  it('doubles pet adoption anniversary points', async () => {
    setupMocks(50, true);
    const result = await awardPetMilestonePoints('u1', 'adoption_anniversary', 'pet1');
    expect(result.pointsAwarded).toBe(20);
  });

  it('doubles tag activation points', async () => {
    setupMocks(50, true);
    const result = await awardTagActivationPoints('u1', 'tag1');
    expect(result.pointsAwarded).toBe(20);
  });

  it('doubles social share points', async () => {
    setupMocks(50, true);
    const result = await awardSocialSharePoints('u1', 'facebook');
    expect(result.pointsAwarded).toBe(6);
  });

  it('doubles monthly membership points', async () => {
    setupMocks(50, true);
    const result = await awardMembershipMilestonePoints('u1', 'monthly');
    expect(result.pointsAwarded).toBe(10);
  });

  it('doubles annual membership points', async () => {
    setupMocks(50, true);
    const result = await awardMembershipMilestonePoints('u1', 'annual');
    expect(result.pointsAwarded).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Edge cases — non-Gold users get base points (no multiplier)
// ---------------------------------------------------------------------------
describe('Non-Gold users receive base points (no multiplier)', () => {
  it('purchase: base points only', async () => {
    setupMocks(0, false, 0);
    const result = await awardPurchasePoints('u1', 100, 'o1');
    expect(result.isGoldMember).toBe(false);
    expect(result.pointsAwarded).toBe(100);
  });

  it('review: base points only', async () => {
    setupMocks(0, false);
    const result = await awardReviewPoints('u1', 'text', 'p1');
    expect(result.isGoldMember).toBe(false);
    expect(result.pointsAwarded).toBe(5);
  });

  it('referral: base points only', async () => {
    setupMocks(0, false);
    const result = await awardReferralPoints('u1', 'signup', 'u2');
    expect(result.isGoldMember).toBe(false);
    expect(result.pointsAwarded).toBe(20);
  });

  it('tag activation: base points only', async () => {
    setupMocks(0, false);
    const result = await awardTagActivationPoints('u1', 'tag1');
    expect(result.isGoldMember).toBe(false);
    expect(result.pointsAwarded).toBe(10);
  });

  it('social share: base points only', async () => {
    setupMocks(0, false);
    const result = await awardSocialSharePoints('u1', 'facebook');
    expect(result.isGoldMember).toBe(false);
    expect(result.pointsAwarded).toBe(3);
  });

  it('membership monthly: base points only', async () => {
    setupMocks(0, false);
    const result = await awardMembershipMilestonePoints('u1', 'monthly');
    expect(result.isGoldMember).toBe(false);
    expect(result.pointsAwarded).toBe(5);
  });

  it('membership annual: base points only', async () => {
    setupMocks(0, false);
    const result = await awardMembershipMilestonePoints('u1', 'annual');
    expect(result.isGoldMember).toBe(false);
    expect(result.pointsAwarded).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// Subscription type detection — non-monthly plans are never Gold
// ---------------------------------------------------------------------------
describe('Subscription type detection', () => {
  it('annual subscription is never Gold', async () => {
    setupMocks(50, false, 0);
    const result = await awardPurchasePoints('u1', 100, 'o1');
    expect(result.isGoldMember).toBe(false);
  });

  it('monthly subscription is not Gold', async () => {
    mockUser.findById.mockReturnValue({
      lean: vi.fn().mockReturnValue({ _id: 'u1', guardianPoints: 50 }),
    } as any);
    mockSubscription.findOne.mockReturnValue({
      lean: vi.fn().mockReturnValue({ planType: 'monthly', price: 1.99 }),
    } as any);
    mockOrder.countDocuments.mockResolvedValue(0);
    mockLedger.countDocuments.mockResolvedValue(0);
    mockLedger.create.mockResolvedValue({} as any);
    mockUser.findByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockReturnValue({ guardianPoints: 150 }),
    } as any);

    const result = await awardPurchasePoints('u1', 100, 'o1');
    expect(result.isGoldMember).toBe(false);
    expect(result.pointsAwarded).toBe(100); // Guardian rate, not Gold
  });

  it('no subscription is not Gold', async () => {
    mockUser.findById.mockReturnValue({
      lean: vi.fn().mockReturnValue({ _id: 'u1', guardianPoints: 50 }),
    } as any);
    mockSubscription.findOne.mockReturnValue({
      lean: vi.fn().mockReturnValue(null),
    } as any);
    mockOrder.countDocuments.mockResolvedValue(0);
    mockLedger.countDocuments.mockResolvedValue(0);
    mockLedger.create.mockResolvedValue({} as any);
    mockUser.findByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockReturnValue({ guardianPoints: 150 }),
    } as any);

    const result = await awardPurchasePoints('u1', 100, 'o1');
    expect(result.isGoldMember).toBe(false);
  });
});

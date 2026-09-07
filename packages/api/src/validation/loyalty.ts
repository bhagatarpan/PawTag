import { z } from 'zod';

// Redemption validation
export const redeemRewardsSchema = z.object({
  amount: z
    .number()
    .min(2, 'Minimum redemption amount is $2')
    .max(100, 'Maximum redemption amount is $100'),
  orderId: z.string().min(1).optional(),
});

// Admin settings update validation
const numberSetting = z.number().min(0).max(1000);

export const guardianSettingsSchema = z.object({
  purchaseRateGuardian: numberSetting.optional(),
  purchaseRateGold: numberSetting.optional(),
  repeatPurchaseBonusGuardian: numberSetting.optional(),
  repeatPurchaseBonusGold: numberSetting.optional(),
  reviewTextPoints: numberSetting.optional(),
  reviewPhotoPoints: numberSetting.optional(),
  reviewVideoPoints: numberSetting.optional(),
  referralSignupPoints: numberSetting.optional(),
  referralPurchasePoints: numberSetting.optional(),
  petProfilePoints: numberSetting.optional(),
  petBirthdayPoints: numberSetting.optional(),
  petAnniversaryPoints: numberSetting.optional(),
  monthlyAnniversaryPoints: numberSetting.optional(),
  annualAnniversaryPoints: numberSetting.optional(),
  tagScanPoints: numberSetting.optional(),
  tagScanDailyLimit: numberSetting.optional(),
  lostPetReportPoints: numberSetting.optional(),
  petReunitedPoints: numberSetting.optional(),
  socialSharePoints: numberSetting.optional(),
  goldMultiplier: numberSetting.optional(),
  annualCapReviewText: numberSetting.optional(),
  annualCapReviewPhoto: numberSetting.optional(),
  annualCapReviewVideo: numberSetting.optional(),
  annualCapReferralSignup: numberSetting.optional(),
  annualCapTagScan: numberSetting.optional(),
  tierThresholdNurture: numberSetting.optional(),
  tierThresholdProtector: numberSetting.optional(),
  tierThresholdSafeguard: numberSetting.optional(),
  pawRewardsCare: numberSetting.optional(),
  pawRewardsNurture: numberSetting.optional(),
  pawRewardsProtector: numberSetting.optional(),
  pawRewardsSafeguard: numberSetting.optional(),
  pawRewardsEarningRateGuardian: numberSetting.optional(),
  pawRewardsEarningRateGold: numberSetting.optional(),
  pawRewardsMinRedemption: numberSetting.optional(),
  pawRewardsExpirationMonths: numberSetting.optional(),
  pawRewardsMaxBalanceGuardian: numberSetting.optional(),
  pawRewardsMaxBalanceGold: numberSetting.optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one setting must be provided' }
);

// Query pagination validation
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

// Members query validation
export const membersQuerySchema = paginationQuerySchema.extend({
  search: z.string().max(100).optional(),
  tier: z.enum(['CARE', 'NURTURE', 'PROTECTOR', 'SAFEGUARD']).optional(),
  sortBy: z.enum(['guardianPoints', 'pawRewardsBalance', 'createdAt', 'fullName']).default('guardianPoints'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

// Activity query validation
export const activityQuerySchema = paginationQuerySchema.extend({
  type: z.enum(['points', 'rewards', 'all']).default('all'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

import { PromoCode, UserMembership, MembershipTier } from '@pawtag/db';
import { getMembershipRetentionNumber } from './membership-config';
import logger from '../lib/logger';

export interface RetentionOffer {
  code: string;
  discountType: 'percentage';
  discountValue: number;
  maxDiscountAmount: number;
  freeShipping: boolean;
  expiresAt: Date;
}

/**
 * Generate a one-time retention offer for a member who is downgrading or cancelling.
 * Creates a promo code that can be used on their next purchase.
 *
 * All values (discount %, max amount, usage limits, expiry) are read from
 * admin-configurable settings in the `membership.retention.*` namespace.
 */
export async function generateRetentionOffer(
  userId: string,
  currentTierId: string,
  action: 'downgrade' | 'cancel',
): Promise<RetentionOffer | null> {
  try {
    const tier = await MembershipTier.findById(currentTierId).lean();
    if (!tier) return null;

    // Read configurable values from settings (with defaults)
    const discountPercent = await getMembershipRetentionNumber('discountPercent');
    const maxDiscountAmount = await getMembershipRetentionNumber('maxDiscountAmount');
    const usageLimit = await getMembershipRetentionNumber('usageLimit');
    const perUserLimit = await getMembershipRetentionNumber('perUserLimit');
    const expiryDays = await getMembershipRetentionNumber('expiryDays');

    // Generate unique code: RETAIN-{TIER}-{RANDOM}
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = `RETAIN-${tier.tier.substring(0, 4).toUpperCase()}-${random}`;

    // Set expiry based on configured days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Create the promo code
    await PromoCode.create({
      code,
      description: `Thank you for being a ${tier.displayName} member! Enjoy ${discountPercent}% off your next purchase.`,
      discountType: 'percentage',
      discountValue: discountPercent,
      maxDiscountAmount,
      minOrderAmount: 0,
      usageLimit,
      usageCount: 0,
      perUserLimit,
      startsAt: new Date(),
      expiresAt,
      isActive: true,
      applicableProducts: [],
      applicableCategories: [],
      createdBy: userId,
    });

    logger.info({ userId, code, tier: tier.tier, action, discountPercent, maxDiscountAmount }, '[Membership] Retention offer generated');

    return {
      code,
      discountType: 'percentage',
      discountValue: discountPercent,
      maxDiscountAmount,
      // freeShipping is false: the PromoCode model does not support a freeShipping
      // benefit. The discount engine only applies the percentage discount.
      freeShipping: false,
      expiresAt,
    };
  } catch (err) {
    logger.error({ err, userId }, '[Membership] Failed to generate retention offer');
    return null;
  }
}

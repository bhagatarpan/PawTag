import { PromoCode, UserMembership, MembershipTier } from '@pawtag/db';
import logger from '../lib/logger';

export interface RetentionOffer {
  code: string;
  discountType: 'percentage';
  discountValue: number;
  freeShipping: boolean;
  expiresAt: Date;
}

/**
 * Generate a one-time retention offer for a member who is downgrading or cancelling.
 * Creates a promo code that can be used on their next purchase.
 */
export async function generateRetentionOffer(
  userId: string,
  currentTierId: string,
  action: 'downgrade' | 'cancel',
): Promise<RetentionOffer | null> {
  try {
    const tier = await MembershipTier.findById(currentTierId).lean();
    if (!tier) return null;

    // Generate unique code: RETAIN-{TIER}-{RANDOM}
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = `RETAIN-${tier.tier.substring(0, 4).toUpperCase()}-${random}`;

    // Set expiry to 90 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    // Create the promo code
    await PromoCode.create({
      code,
      description: `Thank you for being a ${tier.displayName} member! Enjoy 15% off your next purchase.`,
      discountType: 'percentage',
      discountValue: 15,
      maxDiscountAmount: 50,
      minOrderAmount: 0,
      usageLimit: 1,
      usageCount: 0,
      perUserLimit: 1,
      startsAt: new Date(),
      expiresAt,
      isActive: true,
      applicableProducts: [],
      applicableCategories: [],
      createdBy: userId,
    });

    logger.info({ userId, code, tier: tier.tier, action }, '[Membership] Retention offer generated');

    return {
      code,
      discountType: 'percentage',
      discountValue: 15,
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

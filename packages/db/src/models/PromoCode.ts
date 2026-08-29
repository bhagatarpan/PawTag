/**
 * @module PromoCode Model
 * @description MongoDB model for discount/promo codes.
 *
 * Supports:
 * - Percentage discounts (e.g., 10% off)
 * - Fixed amount discounts (e.g., $5 off)
 * - Usage limits (total and per-user)
 * - Date-based validity (startDate, endDate)
 * - Minimum order amount
 * - Product/category restrictions
 * - Active/inactive toggle
 *
 * Pricing priority: salePrice > price. compareAtPrice is display-only.
 *
 * @example
 * ```typescript
 * const code = await PromoCode.findOne({ code: 'WELCOME10', isActive: true });
 * if (!code) throw new InvalidCartError('Invalid promo code');
 * if (!code.isValid()) throw new InvalidCartError('Promo code expired');
 * ```
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IPromoCodeDocument extends Document {
  /** Unique promo code (stored uppercase) */
  code: string;

  /** Human-readable description */
  description: string;

  /** Discount type: percentage or fixed amount */
  discountType: 'percentage' | 'fixed';

  /** Discount value (percentage: 0-100, fixed: amount in NZD) */
  discountValue: number;

  /** Maximum discount amount (for percentage discounts, caps the discount) */
  maxDiscountAmount?: number;

  /** Minimum order subtotal required to use this code */
  minOrderAmount?: number;

  /** Total usage limit (null = unlimited) */
  usageLimit?: number;

  /** Number of times this code has been used */
  usageCount: number;

  /** Per-user usage limit (null = unlimited) */
  perUserLimit?: number;

  /** Validity period */
  startsAt?: Date;
  expiresAt?: Date;

  /** Whether this code is currently active */
  isActive: boolean;

  /** Product IDs this code applies to (empty = all products) */
  applicableProducts: mongoose.Types.ObjectId[];

  /** Category names this code applies to (empty = all categories) */
  applicableCategories: string[];

  /** Who created this code */
  createdBy?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const PromoCodeSchema = new Schema<IPromoCodeDocument>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number, min: 0 },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    usageLimit: { type: Number, min: 0 },
    usageCount: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, min: 0 },
    startsAt: { type: Date },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
    applicableProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    applicableCategories: [{ type: String }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

PromoCodeSchema.index({ code: 1 }, { unique: true });
PromoCodeSchema.index({ isActive: 1, expiresAt: 1 });

/**
 * Check if the promo code is currently valid.
 */
PromoCodeSchema.methods.isValid = function (): boolean {
  if (!this.isActive) return false;
  const now = new Date();
  if (this.startsAt && now < this.startsAt) return false;
  if (this.expiresAt && now > this.expiresAt) return false;
  if (this.usageLimit && this.usageCount >= this.usageLimit) return false;
  return true;
};

/**
 * Calculate the discount amount for a given subtotal.
 *
 * @param subtotal - Order subtotal
 * @returns Discount amount (capped at maxDiscountAmount and subtotal)
 */
PromoCodeSchema.methods.calculateDiscount = function (subtotal: number): number {
  if (subtotal < (this.minOrderAmount || 0)) return 0;

  let discount: number;
  if (this.discountType === 'percentage') {
    discount = subtotal * (this.discountValue / 100);
    if (this.maxDiscountAmount) {
      discount = Math.min(discount, this.maxDiscountAmount);
    }
  } else {
    discount = this.discountValue;
  }

  // Cannot discount more than the subtotal
  return Math.min(discount, subtotal);
};

export const PromoCode = mongoose.model<IPromoCodeDocument>('PromoCode', PromoCodeSchema);

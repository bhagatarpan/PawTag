/**
 * @module Cart Model
 * @description MongoDB model for PawTag shopping carts.
 *
 * This is the PawTag-native cart, replacing Medusa's cart.
 * Each user has one active cart. Cart items store product snapshots
 * for price validation and display.
 *
 * Key design decisions:
 * - One cart per user (userId is unique)
 * - Items store priceAtTime for order creation accuracy
 * - Cart has TTL for abandoned cart cleanup
 * - Server-side price validation on every operation
 *
 * @example
 * ```typescript
 * const cart = await Cart.findOne({ userId });
 * if (!cart) {
 *   cart = await Cart.create({ userId, items: [] });
 * }
 * ```
 */

import mongoose, { Schema, Document } from 'mongoose';

/**
 * Cart item (embedded subdocument).
 * Stores a snapshot of product data at time of addition.
 */
export interface ICartItem {
  /** Product reference */
  productId: mongoose.Types.ObjectId;

  /** Product name at time of addition (snapshot) */
  productName: string;

  /** Variant name if applicable */
  variantName?: string;

  /** Product SKU at time of addition */
  sku: string;

  /** Unit price at time of addition (for order creation) */
  unitPrice: number;

  /** Customisation total at time of addition */
  customizationTotal: number;

  /** Quantity requested */
  quantity: number;

  /** Product image URL at time of addition */
  image?: string;

  /** Whether customisation is applied */
  customisation?: boolean;

  /** Timestamp when item was added */
  addedAt: Date;
}

/**
 * Cart document interface.
 */
export interface ICartDocument extends Document {
  /** Cart owner (one cart per user) */
  userId: mongoose.Types.ObjectId;

  /** Cart items */
  items: mongoose.Types.DocumentArray<ICartItem>;

  /** Promo code applied to cart */
  promoCode?: string;

  /** Discount amount from promo code */
  promoDiscount?: number;

  /** Shipping method ID (if selected) */
  shippingMethodId?: string;

  /** Shipping method name (for display) */
  shippingMethodName?: string;

  /** Shipping cost */
  shippingCost: number;

  /** Cart status */
  status: 'active' | 'abandoned' | 'converted';

  /** Expiration time (TTL index for cleanup) */
  expiresAt: Date;

  /** Last access time (for abandonment detection) */
  lastAccessedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const CartItemSchema = new Schema<ICartItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  variantName: { type: String },
  sku: { type: String, required: true },
  unitPrice: { type: Number, required: true, min: 0 },
  customizationTotal: { type: Number, default: 0, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  image: { type: String },
  customisation: { type: Boolean, default: false },
  addedAt: { type: Date, default: Date.now },
}, { _id: true });

const CartSchema = new Schema<ICartDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    items: [CartItemSchema],
    promoCode: { type: String },
    promoDiscount: { type: Number, min: 0 },
    shippingMethodId: { type: String },
    shippingMethodName: { type: String },
    shippingCost: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['active', 'abandoned', 'converted'], default: 'active', index: true },
    expiresAt: { type: Date, index: { expireAfterSeconds: 0 } }, // TTL index
    lastAccessedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

CartSchema.index({ status: 1, lastAccessedAt: 1 });

export const Cart = mongoose.model<ICartDocument>('Cart', CartSchema);

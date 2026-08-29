/**
 * @module PendingOrder Model
 * @description MongoDB model for pending orders during checkout.
 *
 * When a customer initiates checkout, a PendingOrder is created to hold
 * their cart contents and payment intent ID. This ensures recovery if
 * the browser closes or the network fails after payment.
 *
 * Lifecycle:
 * 1. Created when checkout starts (with Stripe PaymentIntent ID)
 * 2. Updated when payment succeeds (status: 'paid')
 * 3. Converted to Order + Invoice on successful checkout
 * 4. Auto-expired after TTL if payment not completed
 *
 * @example
 * ```typescript
 * const pending = await PendingOrder.create({
 *   userId, items, totals, stripePaymentIntentId, expiresAt,
 * });
 * ```
 */

import mongoose, { Schema, Document } from 'mongoose';

export type PendingOrderStatus = 'pending' | 'paid' | 'converted' | 'expired' | 'failed';

export interface IPendingOrderItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  unitPrice: number;
  customizationTotal: number;
  quantity: number;
  image?: string;
  customisation?: boolean;
}

export interface IPendingOrderDocument extends Document {
  /** Cart owner */
  userId: mongoose.Types.ObjectId;

  /** Cart items snapshot at checkout time */
  items: IPendingOrderItem[];

  /** Subtotal (items only) */
  subtotal: number;

  /** Promo discount amount */
  discount: number;

  /** Promo code applied */
  promoCode?: string;

  /** Shipping cost */
  shipping: number;

  /** Shipping method ID */
  shippingMethodId?: string;

  /** Shipping method name */
  shippingMethodName?: string;

  /** Tax amount */
  tax: number;

  /** Grand total */
  total: number;

  /** Currency code */
  currency: string;

  /** Shipping address */
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
  };

  /** Stripe PaymentIntent ID */
  stripePaymentIntentId: string;

  /** Stripe PaymentIntent client secret (for frontend confirmation) */
  stripeClientSecret?: string;

  /** Current status */
  status: PendingOrderStatus;

  /** Referral code from cart */
  referralCode?: string;

  /** Timestamp when this checkout expires */
  expiresAt: Date;

  /** Last access time */
  lastAccessedAt: Date;

  /** Conversion details (set after order is created) */
  convertedOrderId?: mongoose.Types.ObjectId;
  convertedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const PendingOrderItemSchema = new Schema<IPendingOrderItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  sku: { type: String, required: true },
  unitPrice: { type: Number, required: true, min: 0 },
  customizationTotal: { type: Number, default: 0, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  image: { type: String },
  customisation: { type: Boolean, default: false },
}, { _id: false });

const PendingOrderSchema = new Schema<IPendingOrderDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: [PendingOrderItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    promoCode: { type: String },
    shipping: { type: Number, default: 0, min: 0 },
    shippingMethodId: { type: String },
    shippingMethodName: { type: String },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NZD' },
    shippingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      zip: String,
      country: { type: String, default: 'NZ' },
      phone: String,
    },
    stripePaymentIntentId: { type: String, required: true, unique: true, index: true },
    stripeClientSecret: { type: String },
    status: {
      type: String,
      enum: ['pending', 'paid', 'converted', 'expired', 'failed'],
      default: 'pending',
      index: true,
    },
    referralCode: { type: String },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    lastAccessedAt: { type: Date, default: Date.now },
    convertedOrderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    convertedAt: { type: Date },
  },
  { timestamps: true },
);

PendingOrderSchema.index({ userId: 1, status: 1 });
PendingOrderSchema.index({ stripePaymentIntentId: 1 });

export const PendingOrder = mongoose.model<IPendingOrderDocument>('PendingOrder', PendingOrderSchema);

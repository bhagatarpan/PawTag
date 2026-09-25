/**
 * @module DigitalEntitlement Model
 * @description MongoDB model for digital product entitlements in PawTag.
 *
 * An entitlement tracks which user has purchased which digital product
 * and whether they still have access.
 *
 * Key fields:
 * - accessExpiresAt: When access expires (null = permanent)
 * - downloadCount: Number of times the user has downloaded the content
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IDigitalEntitlementDocument extends Document {
  /** User who purchased the digital product */
  userId: mongoose.Types.ObjectId;

  /** Digital product reference */
  digitalProductId: mongoose.Types.ObjectId;

  /** Order reference (for traceability) */
  orderId?: mongoose.Types.ObjectId;

  /** When access was granted */
  grantedAt: Date;

  /** When access expires (null = permanent) */
  accessExpiresAt?: Date;

  /** Number of downloads used */
  downloadCount: number;

  /** Maximum downloads allowed (0 = unlimited) */
  downloadLimit: number;

  /** Whether this entitlement is active */
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const DigitalEntitlementSchema = new Schema<IDigitalEntitlementDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    digitalProductId: { type: Schema.Types.ObjectId, ref: 'DigitalProduct', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    grantedAt: { type: Date, default: Date.now },
    accessExpiresAt: { type: Date },
    downloadCount: { type: Number, default: 0, min: 0 },
    downloadLimit: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// Compound index for efficient lookup of user's entitlements
DigitalEntitlementSchema.index({ userId: 1, digitalProductId: 1 });
DigitalEntitlementSchema.index({ userId: 1, isActive: 1 });

export const DigitalEntitlement = mongoose.model<IDigitalEntitlementDocument>('DigitalEntitlement', DigitalEntitlementSchema);

/**
 * @module ShippingMethod Model
 * @description MongoDB model for shipping methods.
 *
 * Defines available shipping options with rates and zones.
 * PawTag primarily uses flat-rate or free shipping within NZ.
 *
 * @example
 * ```typescript
 * const method = await ShippingMethod.create({
 *   name: 'Standard NZ Shipping',
 *   rate: 0,
 *   rateType: 'free',
 *   estimatedDays: '3-5 business days',
 * });
 * ```
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IShippingMethodDocument extends Document {
  name: string;
  description?: string;
  rate: number;
  rateType: 'free' | 'flat_rate' | 'weight_based' | 'price_based';
  minOrderAmount?: number;
  maxOrderAmount?: number;
  minWeight?: number;
  maxWeight?: number;
  zones: string[];
  estimatedDays?: string;
  carrier?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const ShippingMethodSchema = new Schema<IShippingMethodDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    rate: { type: Number, default: 0, min: 0 },
    rateType: { type: String, enum: ['free', 'flat_rate', 'weight_based', 'price_based'], default: 'free' },
    minOrderAmount: { type: Number, min: 0 },
    maxOrderAmount: { type: Number, min: 0 },
    minWeight: { type: Number, min: 0 },
    maxWeight: { type: Number, min: 0 },
    zones: [{ type: String }],
    estimatedDays: { type: String },
    carrier: { type: String },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

ShippingMethodSchema.index({ isActive: 1, sortOrder: 1 });

export const ShippingMethod = mongoose.model<IShippingMethodDocument>('ShippingMethod', ShippingMethodSchema);

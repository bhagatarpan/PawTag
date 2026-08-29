/**
 * @module Brand Model
 * @description MongoDB model for product brands.
 *
 * Brands represent the manufacturer or supplier of products.
 * PawTag may sell products from multiple brands (e.g., PawTag own brand, partner brands).
 *
 * @example
 * ```typescript
 * const brand = await Brand.create({ name: 'PawTag', slug: 'pawtag' });
 * ```
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IBrandDocument extends Document {
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  isActive: boolean;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const BrandSchema = new Schema<IBrandDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String },
    logo: { type: String },
    website: { type: String },
    isActive: { type: Boolean, default: true, index: true },
    productCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

BrandSchema.index({ slug: 1 }, { unique: true });
BrandSchema.index({ isActive: 1 });

export const Brand = mongoose.model<IBrandDocument>('Brand', BrandSchema);

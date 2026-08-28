/**
 * @module Collection Model
 * @description MongoDB model for product collections.
 *
 * Collections group products for marketing purposes (e.g., "Summer Sale", "New Arrivals").
 * Unlike categories, collections are flat (no hierarchy) and products can belong to multiple collections.
 *
 * @example
 * ```typescript
 * const collection = await Collection.create({ name: 'Summer Sale', slug: 'summer-sale' });
 * ```
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ICollectionDocument extends Document {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CollectionSchema = new Schema<ICollectionDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String },
    image: { type: String },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    productCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

CollectionSchema.index({ slug: 1 }, { unique: true });
CollectionSchema.index({ isActive: 1, sortOrder: 1 });

export const Collection = mongoose.model<ICollectionDocument>('Collection', CollectionSchema);

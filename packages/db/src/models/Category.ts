/**
 * @module Category Model
 * @description MongoDB model for product categories.
 *
 * Supports hierarchical categories with parent-child relationships.
 * Categories are used for product organisation, filtering, and navigation.
 *
 * @example
 * ```typescript
 * const category = await Category.create({ name: 'Pet Tags', slug: 'pet-tags' });
 * const subcategory = await Category.create({ name: 'QR Tags', slug: 'qr-tags', parentId: category._id });
 * ```
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ICategoryDocument extends Document {
  name: string;
  slug: string;
  description?: string;
  parentId?: mongoose.Types.ObjectId;
  image?: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategoryDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', index: true },
    image: { type: String },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    productCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ parentId: 1, sortOrder: 1 });
CategorySchema.index({ isActive: 1, sortOrder: 1 });

export const Category = mongoose.model<ICategoryDocument>('Category', CategorySchema);

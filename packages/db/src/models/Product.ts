import mongoose, { Schema, Document } from 'mongoose';

export interface IProductDocument extends Document {
  name: string;
  description: string;
  shortDescription?: string;
  price: number;
  currency: string;
  images: string[];
  category: string;
  tags: string[];
  isActive: boolean;
  stock: number;
  sku: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'in';
  };
}

const ProductSchema = new Schema<IProductDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    shortDescription: { type: String },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NZD' },
    images: [{ type: String }],
    category: { type: String, required: true, index: true },
    tags: [{ type: String }],
    isActive: { type: Boolean, default: true, index: true },
    stock: { type: Number, default: 0, min: 0 },
    sku: { type: String, required: true, unique: true },
    weight: { type: Number },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: { type: String, enum: ['cm', 'in'] },
    },
  },
  { timestamps: true },
);

ProductSchema.index({ category: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ name: 'text', description: 'text' });

export const Product = mongoose.model<IProductDocument>('Product', ProductSchema);

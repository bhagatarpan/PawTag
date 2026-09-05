/**
 * @module Product Model
 * @description MongoDB model for PawTag products.
 *
 * This is the authoritative source of truth for the product catalog.
 * Products are managed via the PawTag admin portal.
 *
 * Key fields:
 * - price: Base price in NZD (major units, not cents)
 * - compareAtPrice: Original price before sale (for display)
 * - salePrice: Current sale price (takes precedence over price)
 * - stock: Available inventory quantity
 * - reserved: Quantity reserved by pending checkouts
 * - lowStockThreshold: When stock falls below this, trigger alerts
 * - stockPolicy: 'deny' prevents checkout when out of stock, 'allow' permits backorders
 *
 * Pricing priority: salePrice > price. compareAtPrice is display-only.
 *
 * @example
 * ```typescript
 * const product = await Product.findOne({ sku: 'PT-SCAN', isActive: true });
 * const effectivePrice = product.salePrice ?? product.price;
 * const available = product.stock - product.reserved;
 * ```
 */

import mongoose, { Schema, Document } from 'mongoose';

/**
 * Product variant (embedded subdocument).
 * Used when a product has multiple options (e.g., color, size).
 * For PawTag's simple catalog, most products have 0 variants.
 */
export interface IProductVariant {
  /** Variant display name (e.g., 'Blue', 'Large') */
  name: string;

  /** Stock Keeping Unit — unique identifier for this variant */
  sku: string;

  /** Variant price in NZD (overrides product base price) */
  price: number;

  /** Sale price for this variant (overrides variant price) */
  salePrice?: number;

  /** Available stock for this variant */
  stock: number;

  /** Reserved stock for this variant */
  reserved: number;

  /** Variant image URL */
  image?: string;

  /** Variant attributes (e.g., { color: 'blue', size: 'large' }) */
  attributes: Record<string, string>;
}
  
/** Product feature highlight for display in shop and product detail */
 export interface IFeatureHighlight {
    /** Icon name from Lucide icon set */
    icon: string;
    /** Description text */
    description: string;
 }

 /**
  * Product document interface.
  * Extends Mongoose Document for type-safe queries.
  */
 export interface IProductDocument extends Document {
   // ─── Basic Info ──────────────────────────────────────
   /** Product display name */
   name: string;
   /** URL-friendly product identifier */
   slug: string;

  /** Full product description (supports HTML/Markdown) */
  description: string;

  /** Short description for cards and previews */
  shortDescription?: string;

  // ─── Pricing ─────────────────────────────────────────────
  /** Base price in NZD (major units, e.g., 19.99 not 1999) */
  price: number;

  /** Sale price — when set, takes precedence over base price */
  salePrice?: number;

  /** Original price before sale (display only, for "was $XX" UI) */
  compareAtPrice?: number;

  /** Currency code (ISO 4217) */
  currency: string;

  // ─── Media ───────────────────────────────────────────────
  /** Product image URLs (first image is primary) */
  images: string[];

  // ─── Organisation ────────────────────────────────────────
  /** Product category for filtering and display */
  category: string;

  /** Tags for search and filtering */
  tags: string[];

  // ─── Status ──────────────────────────────────────────────
  /** Whether product is visible and purchasable */
  isActive: boolean;

  /** Whether product appears in the shop */
  isPublished: boolean;

  // ─── Inventory ───────────────────────────────────────────
  /** Total quantity on hand */
  stock: number;

  /** Quantity reserved by pending checkouts */
  reserved: number;

  /** When stock falls below this, trigger low-stock alerts */
  lowStockThreshold: number;

  /** Stock policy: 'deny' prevents checkout when OOS, 'allow' permits backorders */
  stockPolicy: 'deny' | 'allow';

  // ─── Product Identity ────────────────────────────────────
  /** Stock Keeping Unit — unique product identifier */
  sku: string;

  /** Product weight in grams (for shipping calculation) */
  weight?: number;

  /** Product dimensions (for shipping calculation) */
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'in';
  };

  // ─── Variants ────────────────────────────────────────────
  /** Product variants (if product has multiple options) */
  variants: IProductVariant[];

  // ─── Customisation ───────────────────────────────────────
  /** Whether product supports customisation */
  customizable: boolean;

  /** Additional price for customisation */
  customizationPrice: number;

  // ─── Shipping ────────────────────────────────────────────
   /** Additional shipping cost (0 = standard shipping rules apply) */
   shippingCost: number;
   /** Shipping description (e.g., 'Free NZ-wide shipping') */
   shippingDescription: string;

   // ─── Warranty ────────────────────────────────────────────
  /** Warranty period in months */
  warrantyMonths: number;

  // ─── Subscription ────────────────────────────────────────
  /** Whether this product includes a subscription */
  isSubscription: boolean;

  /** Whether this product is a physical tag */
  isTagProduct: boolean;

/** Subscription configuration (if isSubscription is true) */
   subscriptionConfig?: {
     type: 'annual' | 'monthly';
     freePeriodMonths: number;
     gracePeriodWeeks: number;
     monthlyPrice?: number;
     stripePriceId?: string;
     features: string[];
   };

   /** Product feature highlights for display in shop and product detail */
   featureHighlights?: IFeatureHighlight[];

   // ─── Display ─────────────────────────────────────────────
  /** Sort order for shop display (lower = first) */
  sortOrder: number;

  /** Product badge text (e.g., 'Most Popular', 'New') */
  badge?: string;

  // ─── Timestamps (auto-generated by Mongoose) ─────────────
  createdAt: Date;
  updatedAt: Date;
}

const ProductVariantSchema = new Schema<IProductVariant>({
  name: { type: String, required: true },
  sku: { type: String, required: true },
  price: { type: Number, min: 0 },
  salePrice: { type: Number, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  reserved: { type: Number, default: 0, min: 0 },
  image: { type: String },
  attributes: { type: Map, of: String },
}, { _id: false });

const ProductSchema = new Schema<IProductDocument>(
   {
     // ─── Basic Info ──────────────────────────────────────
     name: { type: String, required: true, trim: true },
     description: { type: String, required: true },
     shortDescription: { type: String },
     /** URL-friendly product identifier */
     slug: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // ─── Pricing ─────────────────────────────────────────
    price: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    currency: { type: String, default: 'NZD' },

    // ─── Media ───────────────────────────────────────────
    images: [{ type: String }],

    // ─── Organisation ────────────────────────────────────
    category: { type: String, required: true, index: true },
    tags: [{ type: String }],

    // ─── Status ──────────────────────────────────────────
    isActive: { type: Boolean, default: true, index: true },
    isPublished: { type: Boolean, default: true, index: true },

    // ─── Inventory ───────────────────────────────────────
    stock: { type: Number, default: 0, min: 0 },
    reserved: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 10, min: 0 },
    stockPolicy: { type: String, enum: ['deny', 'allow'], default: 'deny' },

    // ─── Product Identity ────────────────────────────────
    sku: { type: String, required: true, unique: true },
    weight: { type: Number, min: 0 },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      unit: { type: String, enum: ['cm', 'in'] },
    },

    // ─── Variants ────────────────────────────────────────
    variants: [ProductVariantSchema],

    // ─── Customisation ───────────────────────────────────
    customizable: { type: Boolean, default: false },
    customizationPrice: { type: Number, default: 0, min: 0 },

     // ─── Shipping ────────────────────────────────────────
     shippingCost: { type: Number, default: 0, min: 0 },
     shippingDescription: { type: String, default: 'Free NZ-wide shipping' },

     // ─── Warranty ────────────────────────────────────────
    warrantyMonths: { type: Number, default: 12, min: 0 },

// ─── Subscription ────────────────────────────────────
     isSubscription: { type: Boolean, default: false, index: true },
     isTagProduct: { type: Boolean, default: false, index: true },
     subscriptionConfig: {
       type: { type: String, enum: ['annual', 'monthly'] },
       freePeriodMonths: { type: Number, default: 12 },
       gracePeriodWeeks: { type: Number, default: 4 },
       monthlyPrice: { type: Number },
       stripePriceId: { type: String },
       features: [{ type: String }],
     },

     // ─── Feature Highlights ───────────────────────────────────
     /** Product feature highlights for display in shop and product detail */
     featureHighlights: [{
       /** Icon name from Lucide icon set */
       icon: { type: String, required: true },
       /** Description text */
       description: { type: String, required: true },
     }],

     // ─── Display ─────────────────────────────────────────
    sortOrder: { type: Number, default: 0, index: true },
    badge: { type: String },
  },
  { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────
ProductSchema.index({ category: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ isPublished: 1 });
ProductSchema.index({ sortOrder: 1 });
ProductSchema.index({ name: 'text', description: 'text' }); 
ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ isTagProduct: 1 });
ProductSchema.index({ isSubscription: 1 });

export const Product = mongoose.model<IProductDocument>('Product', ProductSchema);

/**
 * @module DigitalProduct Model
 * @description MongoDB model for digital products in PawTag.
 *
 * Digital products are one-time purchases that provide access to digital content.
 * They do not require shipping and have no subscription/renewal.
 *
 * Key fields:
 * - fileUrl: URL to the digital content (stored in R2/local storage)
 * - accessType: 'permanent' | 'time_limited' | 'subscription'
 * - downloadLimit: Maximum number of downloads (0 = unlimited)
 * - accessDurationDays: For time_limited access, how many days of access
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IDigitalProductDocument extends Document {
  /** Product reference (links to Product model) */
  productId: mongoose.Types.ObjectId;

  /** URL to the digital content file */
  fileUrl: string;

  /** Type of access granted */
  accessType: 'permanent' | 'time_limited' | 'subscription';

  /** For time_limited access: number of days of access */
  accessDurationDays?: number;

  /** Maximum downloads per purchase (0 = unlimited) */
  downloadLimit: number;

  /** File size in bytes (for display) */
  fileSize?: number;

  /** MIME type of the file */
  mimeType?: string;

  /** Instructions for accessing the digital content */
  accessInstructions?: string;

  /** Whether the digital product is active */
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const DigitalProductSchema = new Schema<IDigitalProductDocument>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
    fileUrl: { type: String, required: true },
    accessType: { type: String, enum: ['permanent', 'time_limited', 'subscription'], default: 'permanent' },
    accessDurationDays: { type: Number, min: 0 },
    downloadLimit: { type: Number, default: 0, min: 0 },
    fileSize: { type: Number, min: 0 },
    mimeType: { type: String },
    accessInstructions: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

DigitalProductSchema.index({ productId: 1 });

export const DigitalProduct = mongoose.model<IDigitalProductDocument>('DigitalProduct', DigitalProductSchema);

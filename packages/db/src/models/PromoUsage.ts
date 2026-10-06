import mongoose, { Schema, Document } from 'mongoose';

/**
 * Durable record of promo usage commits per order.
 * Unique {code, orderId} prevents double-increment on checkout retries.
 */
export interface IPromoUsageDocument extends Document {
  code: string;
  orderId: mongoose.Types.ObjectId;
  orderNumber?: string;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const PromoUsageSchema = new Schema<IPromoUsageDocument>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    orderNumber: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

PromoUsageSchema.index({ code: 1, orderId: 1 }, { unique: true });

export const PromoUsage = mongoose.model<IPromoUsageDocument>('PromoUsage', PromoUsageSchema);

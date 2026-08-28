/**
 * @module Return Model
 * @description MongoDB model for order returns.
 *
 * Tracks return requests and their processing status.
 * Supports full and partial returns with reasons.
 *
 * @example
 * ```typescript
 * const returnRequest = await Return.create({
 *   orderId: order._id,
 *   reason: 'Product damaged',
 *   items: [{ orderItemId: item._id, quantity: 1, reason: 'Damaged in transit' }],
 * });
 * ```
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IReturnItem {
  orderItemId: mongoose.Types.ObjectId;
  productName: string;
  quantity: number;
  reason?: string;
}

export interface IReturnDocument extends Document {
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  userId: mongoose.Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected' | 'received' | 'refunded';
  reason: string;
  items: IReturnItem[];
  refundAmount?: number;
  refundId?: string;
  notes?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  receivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReturnItemSchema = new Schema<IReturnItem>({
  orderItemId: { type: Schema.Types.ObjectId, required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  reason: { type: String },
}, { _id: false });

const ReturnSchema = new Schema<IReturnDocument>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'received', 'refunded'], default: 'pending', index: true },
    reason: { type: String, required: true },
    items: [ReturnItemSchema],
    refundAmount: { type: Number, min: 0 },
    refundId: { type: String },
    notes: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    receivedAt: { type: Date },
  },
  { timestamps: true },
);

ReturnSchema.index({ status: 1, createdAt: -1 });
ReturnSchema.index({ orderId: 1 });

export const Return = mongoose.model<IReturnDocument>('Return', ReturnSchema);

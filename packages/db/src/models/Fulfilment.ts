/**
 * @module Fulfilment Model
 * @description MongoDB model for order fulfilment.
 *
 * Tracks the fulfilment workflow for orders:
 * pending → picking → packing → fulfilled
 *
 * Each fulfilment can contain multiple items from an order.
 *
 * @example
 * ```typescript
 * const fulfilment = await Fulfilment.create({
 *   orderId: order._id,
 *   status: 'pending',
 *   items: [{ orderItemId: item._id, quantity: 1 }],
 * });
 * ```
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IFulfilmentItem {
  orderItemId: mongoose.Types.ObjectId;
  productName: string;
  quantity: number;
  pickedQuantity: number;
  packedQuantity: number;
}

export interface IFulfilmentDocument extends Document {
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  status: 'pending' | 'picking' | 'packing' | 'fulfilled';
  items: IFulfilmentItem[];
  notes?: string;
  assignedTo?: mongoose.Types.ObjectId;
  fulfilledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FulfilmentItemSchema = new Schema<IFulfilmentItem>({
  orderItemId: { type: Schema.Types.ObjectId, required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  pickedQuantity: { type: Number, default: 0, min: 0 },
  packedQuantity: { type: Number, default: 0, min: 0 },
}, { _id: false });

const FulfilmentSchema = new Schema<IFulfilmentDocument>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, required: true },
    status: { type: String, enum: ['pending', 'picking', 'packing', 'fulfilled'], default: 'pending', index: true },
    items: [FulfilmentItemSchema],
    notes: { type: String },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    fulfilledAt: { type: Date },
  },
  { timestamps: true },
);

FulfilmentSchema.index({ status: 1, createdAt: -1 });
FulfilmentSchema.index({ orderId: 1 });

export const Fulfilment = mongoose.model<IFulfilmentDocument>('Fulfilment', FulfilmentSchema);

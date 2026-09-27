/**
 * @module Fulfilment Model
 * @description MongoDB model for order fulfilment.
 *
 * Tracks the fulfilment workflow for orders:
 * pending → picking → packing → fulfilled
 *
 * Each fulfilment can contain multiple items from an order,
 * and each item can have its own tag assignment.
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

export type FulfilmentStatus = 'pending' | 'picking' | 'packing' | 'fulfilled';

export interface IFulfilmentItem {
  orderItemId: mongoose.Types.ObjectId;
  productName: string;
  quantity: number;
  pickedQuantity: number;
  packedQuantity: number;
}

export interface ITagAssignment {
  tagId: string;
  productId: mongoose.Types.ObjectId;
  orderItemId: mongoose.Types.ObjectId;
  nfcWritten: boolean;
  assignedAt: Date;
  assignedBy: mongoose.Types.ObjectId;
  confirmedAt?: Date;
  confirmedBy?: mongoose.Types.ObjectId;
}

export interface IFulfilmentDocument extends Document {
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  status: FulfilmentStatus;
  items: IFulfilmentItem[];
  notes?: string;
  assignedTo?: mongoose.Types.ObjectId;
  tagAssignments: ITagAssignment[];
  fulfilledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TagAssignmentSchema = new Schema<ITagAssignment>({
  tagId: { type: String, required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  orderItemId: { type: Schema.Types.ObjectId, required: true },
  nfcWritten: { type: Boolean, default: false },
  assignedAt: { type: Date, required: true },
  assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  confirmedAt: { type: Date },
  confirmedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

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
    tagAssignments: [TagAssignmentSchema],
    fulfilledAt: { type: Date },
  },
  { timestamps: true },
);

FulfilmentSchema.index({ status: 1, createdAt: -1 });
FulfilmentSchema.index({ orderId: 1 });

export const Fulfilment = mongoose.model<IFulfilmentDocument>('Fulfilment', FulfilmentSchema);

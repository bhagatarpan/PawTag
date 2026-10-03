/**
 * @module Return Model
 * @description MongoDB model for order returns.
 *
 * Tracks return requests, warehouse receipt, tracking, and linkage to
 * Stripe refunds. Money movement is performed by the return-refund
 * service — never by a bare status flip alone.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IReturnItem {
  orderItemId: mongoose.Types.ObjectId;
  productName: string;
  quantity: number;
  reason?: string;
  unitPrice?: number;
  customizationTotal?: number;
  refundedQuantity?: number;
}

export interface IReturnActivity {
  type: string;
  message: string;
  timestamp: Date;
  actor?: string;
  actorType?: 'customer' | 'admin' | 'system';
  metadata?: Record<string, unknown>;
}

export interface IReturnDocument extends Document {
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  userId: mongoose.Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected' | 'received' | 'refunded' | 'refund_failed';
  reason: string;
  items: IReturnItem[];
  refundAmount?: number;
  refundId?: string;
  refundStatus?: 'pending' | 'succeeded' | 'failed';
  refundArn?: string;
  refundExpectedArrival?: Date;
  refundProcessedAt?: Date;
  refundFailureReason?: string;
  refundWithoutReturn?: boolean;
  refundExceptionReason?: string;
  notes?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  receivedAt?: Date;
  returnShipProvider?: string;
  returnTrackingNumber?: string;
  returnTrackingUrl?: string;
  returnTrackingSubmittedAt?: Date;
  returnTrackingSubmittedBy?: mongoose.Types.ObjectId;
  returnTrackingSource?: 'customer' | 'admin';
  requestedByType?: 'customer' | 'admin';
  requestedByEmail?: string;
  requestedByName?: string;
  requestedByPhone?: string;
  activity?: IReturnActivity[];
  createdAt: Date;
  updatedAt: Date;
}

const ReturnItemSchema = new Schema<IReturnItem>({
  orderItemId: { type: Schema.Types.ObjectId, required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  reason: { type: String },
  unitPrice: { type: Number, min: 0 },
  customizationTotal: { type: Number, min: 0, default: 0 },
  refundedQuantity: { type: Number, min: 0, default: 0 },
}, { _id: false });

const ReturnActivitySchema = new Schema<IReturnActivity>({
  type: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, required: true, default: Date.now },
  actor: { type: String },
  actorType: { type: String, enum: ['customer', 'admin', 'system'] },
  metadata: { type: Schema.Types.Mixed },
}, { _id: false });

const ReturnSchema = new Schema<IReturnDocument>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'received', 'refunded', 'refund_failed'],
      default: 'pending',
      index: true,
    },
    reason: { type: String, required: true },
    items: [ReturnItemSchema],
    refundAmount: { type: Number, min: 0 },
    refundId: { type: String, index: true },
    refundStatus: { type: String, enum: ['pending', 'succeeded', 'failed'] },
    refundArn: { type: String },
    refundExpectedArrival: { type: Date },
    refundProcessedAt: { type: Date },
    refundFailureReason: { type: String },
    refundWithoutReturn: { type: Boolean, default: false },
    refundExceptionReason: { type: String },
    notes: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    receivedAt: { type: Date },
    returnShipProvider: { type: String },
    returnTrackingNumber: { type: String },
    returnTrackingUrl: { type: String },
    returnTrackingSubmittedAt: { type: Date },
    returnTrackingSubmittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    returnTrackingSource: { type: String, enum: ['customer', 'admin'] },
    requestedByType: { type: String, enum: ['customer', 'admin'] },
    requestedByEmail: { type: String },
    requestedByName: { type: String },
    requestedByPhone: { type: String },
    activity: [ReturnActivitySchema],
  },
  { timestamps: true }
);

ReturnSchema.index({ status: 1, createdAt: -1 });
ReturnSchema.index({ orderId: 1 });
ReturnSchema.index({ userId: 1, status: 1 });

export const Return = mongoose.model<IReturnDocument>('Return', ReturnSchema);

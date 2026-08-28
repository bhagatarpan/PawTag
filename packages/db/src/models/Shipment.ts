/**
 * @module Shipment Model
 * @description MongoDB model for order shipments.
 *
 * Tracks individual shipments created for orders. An order can have
 * multiple shipments (partial fulfilment). Each shipment links to a
 * carrier and tracks the full lifecycle from label creation to delivery.
 *
 * Shipment lifecycle:
 *   label_created → picked_up → in_transit → out_for_delivery → delivered
 *   (or: failed, returned, exception, delayed)
 *
 * @example
 * ```typescript
 * const shipment = await Shipment.create({
 *   orderId: order._id,
 *   orderNumber: order.orderNumber,
 *   carrier: 'NZ Post',
 *   trackingNumber: 'NZ123456789AB',
 *   status: 'label_created',
 *   items: [{ orderItemId: item._id, productName: 'QR Tag', quantity: 1 }],
 * });
 * ```
 */

import mongoose, { Schema, Document } from 'mongoose';

export type ShipmentStatus =
  | 'label_created'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'returned'
  | 'exception'
  | 'delayed';

export interface IShipmentItem {
  orderItemId: mongoose.Types.ObjectId;
  productName: string;
  quantity: number;
}

export interface ITrackingEvent {
  timestamp: Date;
  status: string;
  description: string;
  location?: string;
}

export interface IShipmentDocument extends Document {
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  fulfilmentId?: mongoose.Types.ObjectId;

  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  labelUrl?: string;

  status: ShipmentStatus;

  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };

  items: IShipmentItem[];

  estimatedDelivery?: Date;
  actualDelivery?: Date;

  trackingEvents: ITrackingEvent[];

  notes?: string;

  shippedAt?: Date;
  deliveredAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const ShipmentItemSchema = new Schema<IShipmentItem>({
  orderItemId: { type: Schema.Types.ObjectId, required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const TrackingEventSchema = new Schema<ITrackingEvent>({
  timestamp: { type: Date, required: true },
  status: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String },
}, { _id: false });

const ShipmentSchema = new Schema<IShipmentDocument>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, required: true },
    fulfilmentId: { type: Schema.Types.ObjectId, ref: 'Fulfilment', sparse: true },

    carrier: { type: String, required: true },
    trackingNumber: { type: String, required: true, index: true },
    trackingUrl: { type: String },
    labelUrl: { type: String },

    status: {
      type: String,
      enum: ['label_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'exception', 'delayed'],
      default: 'label_created',
      index: true,
    },

    shippingAddress: {
      line1: { type: String, required: true },
      line2: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zip: { type: String, required: true },
      country: { type: String, default: 'NZ' },
    },

    items: [ShipmentItemSchema],

    estimatedDelivery: { type: Date },
    actualDelivery: { type: Date },

    trackingEvents: [TrackingEventSchema],

    notes: { type: String },

    shippedAt: { type: Date },
    deliveredAt: { type: Date },
  },
  { timestamps: true },
);

ShipmentSchema.index({ orderId: 1 });
ShipmentSchema.index({ status: 1, createdAt: -1 });
ShipmentSchema.index({ carrier: 1, status: 1 });
ShipmentSchema.index({ trackingNumber: 1 }, { unique: true });

export const Shipment = mongoose.model<IShipmentDocument>('Shipment', ShipmentSchema);

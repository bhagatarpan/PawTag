import mongoose, { Schema, Document } from 'mongoose';

export type OrderStatus = 'pending' | 'pending_payment' | 'paid' | 'packing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export interface IOrderDocument extends Document {
  orderNumber: string;
  userId: mongoose.Types.ObjectId;
  items: Array<{
    productId: mongoose.Types.ObjectId;
    productName: string;
    variantName?: string;
    petName?: string;
    tagId?: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    customizationTotal?: number;
  }>;
  subtotal?: number;
  shippingCost?: number;
  tax?: number;
  discount?: {
    percent: number;
    amount: number;
    reason: string;
  };
  status: OrderStatus;
  payment: {
    method: 'card' | 'paypal' | 'bank_transfer';
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    transactionId?: string;
    stripePaymentIntentId?: string;
    cardBrand?: string;
    cardLast4?: string;
    amount: number;
    currency: string;
    paidAt?: Date;
  };
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  billingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  trackingNumber?: string;
  carrier?: string;
  shippingLabelUrl?: string;
  notes?: string;
  referredByCode?: string;
  createdBy?: string;
  createdByType?: string;
  createdByPortal?: 'customer-web' | 'customer-mobile' | 'admin-web' | 'system';
  createdByDescription?: string;
  createdByEmail?: string;
  cancellationReason?: string;
  cancellationNotes?: string;
  cancelledBy?: string;
  cancelledByType?: string;
  cancelledByPortal?: 'customer-web' | 'customer-mobile' | 'admin-web' | 'system';
  cancelledByDescription?: string;
  cancelledAt?: Date;
  refundReason?: string;
  refundId?: string;
  refundArn?: string;
  refundStatus?: 'pending' | 'succeeded' | 'failed' | 'canceled';
  refundExpectedArrival?: Date;
  refundSettledAt?: Date;
  refundLastSyncedAt?: Date;
  refundFailureReason?: string;
  refundAttemptCount?: number;
  refundedBy?: string;
  refundedByType?: string;
  refundedByPortal?: 'customer-web' | 'customer-mobile' | 'admin-web' | 'system';
  refundedByDescription?: string;
  refundedAt?: Date;
  deliveredAt?: Date;
  deletedAt?: Date;
  activity: Array<{
    type: string;
    message: string;
    timestamp: Date;
    actor: 'system' | 'admin' | 'customer';
    metadata?: Record<string, any>;
  }>;
}

const OrderSchema = new Schema<IOrderDocument>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        productName: { type: String, required: true },
        variantName: { type: String },
        petName: { type: String },
        tagId: { type: String },
        sku: { type: String },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true },
        totalPrice: { type: Number, required: true },
        customizationTotal: { type: Number, default: 0 },
      },
    ],
    subtotal: { type: Number },
    shippingCost: { type: Number },
    tax: { type: Number },
    discount: {
      percent: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
      reason: { type: String },
    },
    status: {
      type: String,
      enum: ['pending', 'pending_payment', 'paid', 'packing', 'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'pending',
      index: true,
    },
    payment: {
      method: { type: String, enum: ['card', 'paypal', 'bank_transfer'] },
      status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'] },
      transactionId: String,
      stripePaymentIntentId: String,
      cardBrand: String,
      cardLast4: String,
      amount: { type: Number, required: true },
      currency: { type: String, default: 'NZD' },
      paidAt: Date,
    },
    shippingAddress: {
      line1: { type: String, required: true },
      line2: String,
      city: { type: String, required: true },
      state: { type: String, default: '' },
      zip: { type: String, required: true },
      country: { type: String, default: 'NZ' },
    },
    billingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      zip: String,
      country: String,
    },
    trackingNumber: String,
    carrier: String,
    shippingLabelUrl: String,
    notes: String,
    referredByCode: { type: String },
    createdBy: { type: String, index: true },
    createdByType: { type: String, index: true },
    createdByPortal: {
      type: String,
      enum: ['customer-web', 'customer-mobile', 'admin-web', 'system'],
    },
    createdByDescription: { type: String },
    createdByEmail: { type: String },
    cancellationReason: { type: String },
    cancellationNotes: { type: String },
    cancelledBy: { type: String, index: true },
    cancelledByType: { type: String, index: true },
    cancelledByPortal: {
      type: String,
      enum: ['customer-web', 'customer-mobile', 'admin-web', 'system'],
    },
    cancelledByDescription: { type: String },
    cancelledAt: { type: Date, index: true },
    refundReason: { type: String },
    refundId: { type: String, index: true },
    refundArn: { type: String },
    refundStatus: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'canceled'],
      index: true,
    },
    refundExpectedArrival: { type: Date },
    refundSettledAt: { type: Date },
    refundLastSyncedAt: { type: Date },
    refundFailureReason: { type: String },
    refundAttemptCount: { type: Number, default: 0 },
    refundedBy: { type: String, index: true },
    refundedByType: { type: String, index: true },
    refundedByPortal: {
      type: String,
      enum: ['customer-web', 'customer-mobile', 'admin-web', 'system'],
    },
    refundedByDescription: { type: String },
    refundedAt: { type: Date, index: true },
    deliveredAt: { type: Date },
    deletedAt: { type: Date, default: null },
    activity: [
      {
        type: { type: String, required: true },
        message: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        actor: { type: String, enum: ['system', 'admin', 'customer'], default: 'system' },
        metadata: { type: Schema.Types.Mixed },
      },
    ],
  },
  { timestamps: true },
);

OrderSchema.index({ userId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ deletedAt: 1 });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

export const Order = mongoose.model<IOrderDocument>('Order', OrderSchema);

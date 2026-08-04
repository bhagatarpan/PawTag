import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscriptionDocument extends Document {
  userId: mongoose.Types.ObjectId;
  tagId: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;

  planId?: mongoose.Types.ObjectId;
  planName: string;
  planType: 'annual' | 'monthly' | 'free';

  status: 'active' | 'expired' | 'grace_period' | 'cancelled' | 'pending_payment';

  price: number;
  currency: string;

  startDate: Date;
  freePeriodEndsAt?: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  gracePeriodEndsAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;

  autoRenew: boolean;
  renewalMethod: 'annual' | 'monthly';

  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  lastPaymentDate?: Date;
  lastPaymentAmount?: number;
  nextPaymentDate?: Date;

  lastScannedAt?: Date;
  totalScans: number;

  reminderStates: {
    reminder30dSent?: boolean;
    reminder7dSent?: boolean;
    reminder1dSent?: boolean;
    graceWeeklySentCount: number;
    lastGraceReminderAt?: Date;
  };

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const SubscriptionSchema = new Schema<ISubscriptionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tagId: { type: Schema.Types.ObjectId, ref: 'Tag', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },

    planId: { type: Schema.Types.ObjectId, ref: 'Product' },
    planName: { type: String, required: true },
    planType: { type: String, enum: ['annual', 'monthly', 'free'], required: true },

    status: {
      type: String,
      enum: ['active', 'expired', 'grace_period', 'cancelled', 'pending_payment'],
      default: 'active',
      index: true,
    },

    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NZD' },

    startDate: { type: Date, required: true, index: true },
    freePeriodEndsAt: { type: Date },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true, index: true },
    gracePeriodEndsAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },

    autoRenew: { type: Boolean, default: true },
    renewalMethod: { type: String, enum: ['annual', 'monthly'], default: 'annual' },

    stripeSubscriptionId: { type: String },
    stripeCustomerId: { type: String },
    lastPaymentDate: { type: Date },
    lastPaymentAmount: { type: Number },
    nextPaymentDate: { type: Date },

    lastScannedAt: { type: Date },
    totalScans: { type: Number, default: 0 },

    reminderStates: {
      reminder30dSent: { type: Boolean, default: false },
      reminder7dSent: { type: Boolean, default: false },
      reminder1dSent: { type: Boolean, default: false },
      graceWeeklySentCount: { type: Number, default: 0 },
      lastGraceReminderAt: { type: Date },
    },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

SubscriptionSchema.index({ userId: 1, tagId: 1 });
SubscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
SubscriptionSchema.index({ status: 1, gracePeriodEndsAt: 1 });
SubscriptionSchema.index({ stripeSubscriptionId: 1 });
SubscriptionSchema.index({ userId: 1, status: 1, currentPeriodEnd: -1 });
SubscriptionSchema.index({ status: 1, currentPeriodEnd: 1, autoRenew: 1, deletedAt: 1 });

export const Subscription = mongoose.model<ISubscriptionDocument>('Subscription', SubscriptionSchema);

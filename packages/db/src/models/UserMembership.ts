import mongoose, { Schema, Document } from 'mongoose';

export interface IUserMembershipDocument extends Document {
  userId: mongoose.Types.ObjectId;
  tierId: mongoose.Types.ObjectId;
  status: 'active' | 'cancelled' | 'expired' | 'pending_payment';
  billingCycle: 'annual';
  price: number;
  currency: string;
  startDate: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  paymentMethodId?: string;
  cardBrand?: string;
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  autoRenew: boolean;
  extendedTagIds: mongoose.Types.ObjectId[];
  adminExtensionGraceUsed: boolean;
  lastAdminExtensionAt?: Date;
  adminExtensionCount: number;
  invoiceId?: mongoose.Types.ObjectId;
  // Deferred downgrade fields
  pendingTierId?: mongoose.Types.ObjectId;
  pendingTierEffectiveAt?: Date;
  downgradeRequestedAt?: Date;
  downgradeTermsAcceptedAt?: Date;
  downgradeTermsVersion?: string;
  downgradeReason?: string;
  downgradeCancelledAt?: Date;
  // Dunning state
  dunningStatus?: 'active' | 'past_due' | 'expired';
  dunningRetryCount?: number;
  dunningLastAttemptAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserMembershipSchema = new Schema<IUserMembershipDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tierId: { type: Schema.Types.ObjectId, ref: 'MembershipTier', required: true },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired', 'pending_payment'],
      default: 'pending_payment',
      index: true,
    },
    billingCycle: { type: String, enum: ['annual'], default: 'annual' },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NZD' },
    startDate: { type: Date, required: true },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true, index: true },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String, index: true },
    paymentMethodId: { type: String },
    cardBrand: { type: String },
    cardLast4: { type: String },
    cardExpMonth: { type: Number },
    cardExpYear: { type: Number },
    autoRenew: { type: Boolean, default: true },
    extendedTagIds: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
    adminExtensionGraceUsed: { type: Boolean, default: false },
    lastAdminExtensionAt: { type: Date },
    adminExtensionCount: { type: Number, default: 0 },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    // Deferred downgrade
    pendingTierId: { type: Schema.Types.ObjectId, ref: 'MembershipTier', default: null },
    pendingTierEffectiveAt: { type: Date, default: null },
    downgradeRequestedAt: { type: Date, default: null },
    downgradeTermsAcceptedAt: { type: Date, default: null },
    downgradeTermsVersion: { type: String, default: null },
    downgradeReason: { type: String, default: null },
    downgradeCancelledAt: { type: Date, default: null },
    // Dunning
    dunningStatus: {
      type: String,
      enum: ['active', 'past_due', 'expired'],
      default: 'active',
    },
    dunningRetryCount: { type: Number, default: 0 },
    dunningLastAttemptAt: { type: Date },
  },
  { timestamps: true }
);

UserMembershipSchema.index({ userId: 1, status: 1 });
UserMembershipSchema.index({ status: 1, currentPeriodEnd: 1 });
UserMembershipSchema.index({ stripeSubscriptionId: 1 });
UserMembershipSchema.index({ pendingTierEffectiveAt: 1, status: 1 });

export const UserMembership = mongoose.model<IUserMembershipDocument>(
  'UserMembership',
  UserMembershipSchema
);

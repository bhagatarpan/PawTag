import mongoose, { Schema, Document } from 'mongoose';

export type DonationFrequency = 'one_time' | 'monthly';
export type DonationStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'partially_refunded'
  | 'refunded';

export interface IDonationDocument extends Document {
  supporterUserId: mongoose.Types.ObjectId;
  emailSnapshot: string;
  nameSnapshot: string;
  /** Integer minor units (NZD cents) */
  amountCents: number;
  currency: string;
  frequency: DonationFrequency;
  status: DonationStatus;
  stripeCustomerId?: string;
  stripePaymentIntentId?: string;
  stripeSubscriptionId?: string;
  registrationContext: 'DONATION';
  idempotencyKey?: string;
  marketingConsent: boolean;
  receiptId?: mongoose.Types.ObjectId;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DonationSchema = new Schema<IDonationDocument>(
  {
    supporterUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    emailSnapshot: { type: String, required: true },
    nameSnapshot: { type: String, default: '' },
    amountCents: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'NZD', uppercase: true },
    frequency: { type: String, enum: ['one_time', 'monthly'], default: 'one_time' },
    status: {
      type: String,
      enum: ['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'partially_refunded', 'refunded'],
      default: 'pending',
      index: true,
    },
    stripeCustomerId: { type: String },
    stripePaymentIntentId: { type: String, index: true },
    stripeSubscriptionId: { type: String, index: true },
    registrationContext: { type: String, default: 'DONATION' },
    idempotencyKey: { type: String },
    marketingConsent: { type: Boolean, default: false },
    receiptId: { type: Schema.Types.ObjectId, ref: 'DonationReceipt' },
    failureReason: { type: String },
  },
  { timestamps: true },
);

DonationSchema.index({ stripePaymentIntentId: 1 });
DonationSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
DonationSchema.index({ supporterUserId: 1, createdAt: -1 });

export const Donation = mongoose.model<IDonationDocument>('Donation', DonationSchema);

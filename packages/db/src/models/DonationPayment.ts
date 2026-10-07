import mongoose, { Schema, Document } from 'mongoose';

export type DonationPaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

export interface IDonationPaymentDocument extends Document {
  donationId: mongoose.Types.ObjectId;
  amountCents: number;
  currency: string;
  status: DonationPaymentStatus;
  stripePaymentIntentId?: string;
  stripeInvoiceId?: string;
  paidAt?: Date;
  receiptId?: mongoose.Types.ObjectId;
  webhookEventId?: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DonationPaymentSchema = new Schema<IDonationPaymentDocument>(
  {
    donationId: { type: Schema.Types.ObjectId, ref: 'Donation', required: true, index: true },
    amountCents: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'NZD' },
    status: {
      type: String,
      enum: ['pending', 'processing', 'succeeded', 'failed', 'refunded'],
      default: 'pending',
    },
    stripePaymentIntentId: { type: String, index: true },
    stripeInvoiceId: { type: String, index: true },
    paidAt: { type: Date },
    receiptId: { type: Schema.Types.ObjectId, ref: 'DonationReceipt' },
    webhookEventId: { type: String },
    failureReason: { type: String },
  },
  { timestamps: true },
);

DonationPaymentSchema.index({ stripePaymentIntentId: 1, status: 1 });
DonationPaymentSchema.index({ stripeInvoiceId: 1 }, { unique: true, partialFilterExpression: { stripeInvoiceId: { $type: 'string' } } });

export const DonationPayment = mongoose.model<IDonationPaymentDocument>('DonationPayment', DonationPaymentSchema);

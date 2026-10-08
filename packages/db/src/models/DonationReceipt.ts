import mongoose, { Schema, Document } from 'mongoose';

export type DonationReceiptStatus = 'issued' | 'void' | 'replaced';

export interface IDonationReceiptDocument extends Document {
  receiptNumber: string;
  donationId: mongoose.Types.ObjectId;
  paymentId?: mongoose.Types.ObjectId;
  amountCents: number;
  currency: string;
  donorNameSnapshot: string;
  organisationName: string;
  irdNumber?: string;
  charitiesNumber?: string;
  taxClassification: string;
  statement: string;
  signatory?: string;
  status: DonationReceiptStatus;
  relatedReceiptId?: mongoose.Types.ObjectId;
  pdfUrl?: string;
  /** Secure access token hash for emailed download links (invoice-style) */
  accessTokenHash?: string;
  accessExpiresAt?: Date;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DonationReceiptSchema = new Schema<IDonationReceiptDocument>(
  {
    receiptNumber: { type: String, required: true, unique: true },
    donationId: { type: Schema.Types.ObjectId, ref: 'Donation', required: true, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'DonationPayment' },
    amountCents: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'NZD' },
    donorNameSnapshot: { type: String, default: '' },
    organisationName: { type: String, required: true },
    irdNumber: { type: String },
    charitiesNumber: { type: String },
    taxClassification: { type: String, default: 'neutral' },
    statement: { type: String, required: true },
    signatory: { type: String },
    status: { type: String, enum: ['issued', 'void', 'replaced'], default: 'issued' },
    relatedReceiptId: { type: Schema.Types.ObjectId, ref: 'DonationReceipt' },
    pdfUrl: { type: String },
    accessTokenHash: { type: String, index: true },
    accessExpiresAt: { type: Date },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

DonationReceiptSchema.index({ donationId: 1, status: 1 });
DonationReceiptSchema.index({ receiptNumber: 1 }, { unique: true });

export const DonationReceipt = mongoose.model<IDonationReceiptDocument>('DonationReceipt', DonationReceiptSchema);

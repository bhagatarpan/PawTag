import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoiceAccessTokenDocument extends Document {
  invoiceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  verifiedAt?: Date;
  otpHash?: string;
  otpExpiresAt?: Date;
  otpAttempts: number;
  ipAddress?: string;
  userAgent?: string;
  /**
   * True when this access token was issued by an admin/CSR view action.
   * The invoice viewer renders the ADMIN channel document (includes
   * Stripe payment IDs for troubleshooting) when set; customer-channel
   * tokens never expose provider identifiers. Durable server-side flag —
   * never trusted from a client query param.
   */
  issuedToAdmin?: boolean;
}

const InvoiceAccessTokenSchema = new Schema<IInvoiceAccessTokenDocument>(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    verifiedAt: { type: Date, default: null },
    otpHash: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    otpAttempts: { type: Number, default: 0, min: 0 },
    ipAddress: { type: String },
    userAgent: { type: String },
    issuedToAdmin: { type: Boolean, default: false },
  },
  { timestamps: true },
);

InvoiceAccessTokenSchema.index({ invoiceId: 1, userId: 1 });
InvoiceAccessTokenSchema.index({ tokenHash: 1 });
InvoiceAccessTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const InvoiceAccessToken = mongoose.model<IInvoiceAccessTokenDocument>(
  'InvoiceAccessToken',
  InvoiceAccessTokenSchema,
);

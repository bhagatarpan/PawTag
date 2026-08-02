import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoiceDocument extends Document {
  subscriptionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  invoiceNumber: string;

  amount: number;
  currency: string;

  status: 'paid' | 'pending' | 'failed' | 'refunded';

  stripeInvoiceId?: string;
  stripePaymentIntentId?: string;
  paymentMethod?: string;

  billingPeriod: {
    start: Date;
    end: Date;
  };

  paidAt?: Date;
  dueDate: Date;

  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoiceDocument>(
  {
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NZD' },

    status: {
      type: String,
      enum: ['paid', 'pending', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },

    stripeInvoiceId: { type: String },
    stripePaymentIntentId: { type: String },
    paymentMethod: { type: String },

    billingPeriod: {
      start: { type: Date, required: true },
      end: { type: Date, required: true },
    },

    paidAt: { type: Date },
    dueDate: { type: Date, required: true },
  },
  { timestamps: true },
);

InvoiceSchema.index({ userId: 1, status: 1 });
InvoiceSchema.index({ invoiceNumber: 1 }, { unique: true });

export const Invoice = mongoose.model<IInvoiceDocument>('Invoice', InvoiceSchema);

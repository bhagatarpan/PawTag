/**
 * @module PaymentTransaction Model
 * @description MongoDB model for payment transaction history.
 *
 * Tracks every payment attempt, success, and failure for an order.
 * Used for:
 * - Payment audit trail (who paid what, when, how)
 * - Reconciliation (Stripe ↔ PawTag order matching)
 * - Refund tracking (which transaction was refunded)
 * - Failed payment analysis
 *
 * Each order can have multiple payment transactions (e.g., retried payments,
 * partial refunds against specific transactions).
 *
 * @example
 * ```typescript
 * const txn = await PaymentTransaction.create({
 *   orderId: order._id,
 *   orderNumber: order.orderNumber,
 *   type: 'payment',
 *   amount: 59.99,
 *   currency: 'NZD',
 *   status: 'succeeded',
 *   provider: 'stripe',
 *   providerTransactionId: 'pi_xxx',
 * });
 * ```
 */

import mongoose, { Schema, Document } from 'mongoose';

export type TransactionType = 'payment' | 'refund' | 'capture' | 'authorization';
export type TransactionStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded';

export interface IPaymentTransactionDocument extends Document {
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;

  type: TransactionType;
  status: TransactionStatus;

  amount: number;
  currency: string;

  /** Payment provider identifier (e.g., 'stripe') */
  provider: string;

  /** Provider-specific transaction ID (e.g., Stripe's pi_xxx, re_xxx) */
  providerTransactionId?: string;

  /** Provider-specific payment method reference */
  providerPaymentMethodId?: string;

  /** Error code from provider (if failed) */
  errorCode?: string;

  /** Error message from provider (if failed) */
  errorMessage?: string;

  /** Additional provider metadata */
  metadata?: Record<string, unknown>;

  /** Who initiated this transaction */
  initiatedBy: 'customer' | 'admin' | 'system' | 'webhook';

  /** Notes (e.g., admin refund reason) */
  notes?: string;

  /** Provider-side status (e.g., Stripe's refund status: 'pending', 'succeeded', 'failed', 'canceled') */
  providerStatus?: string;

  /** Acquirer Reference Number (bank reference for refunds) */
  arn?: string;

  /** Expected date when funds reach the merchant account */
  expectedArrival?: Date;

  /** When Stripe confirmed the refund settled */
  refundedAt?: Date;

  /** Last successful reconciliation timestamp */
  lastSyncedAt?: Date;

  /** Failure reason if Stripe reported the refund failed */
  failureReason?: string;

  /** Number of retry attempts (0 = first attempt, max 1 auto-retry) */
  attemptCount?: number;

  createdAt: Date;
  updatedAt: Date;
}

const PaymentTransactionSchema = new Schema<IPaymentTransactionDocument>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, required: true },

    type: {
      type: String,
      enum: ['payment', 'refund', 'capture', 'authorization'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'cancelled', 'refunded'],
      required: true,
      index: true,
    },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NZD' },

    provider: { type: String, required: true },
    providerTransactionId: { type: String, index: true },
    providerPaymentMethodId: { type: String },

    errorCode: { type: String },
    errorMessage: { type: String },

    metadata: { type: Schema.Types.Mixed },

    initiatedBy: {
      type: String,
      enum: ['customer', 'admin', 'system', 'webhook'],
      required: true,
    },

    notes: { type: String },

    providerStatus: { type: String, index: true },
    arn: { type: String, index: true },
    expectedArrival: { type: Date },
    refundedAt: { type: Date },
    lastSyncedAt: { type: Date },
    failureReason: { type: String },
    attemptCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

PaymentTransactionSchema.index({ orderId: 1, createdAt: -1 });
PaymentTransactionSchema.index({ providerTransactionId: 1 });
PaymentTransactionSchema.index({ status: 1, createdAt: -1 });
PaymentTransactionSchema.index({ provider: 1, status: 1 });

export const PaymentTransaction = mongoose.model<IPaymentTransactionDocument>(
  'PaymentTransaction',
  PaymentTransactionSchema,
);

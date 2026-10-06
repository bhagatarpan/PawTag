import mongoose, { Schema, Document } from 'mongoose';

export type PawRewardsReservationStatus = 'reserved' | 'committed' | 'released' | 'expired';

export interface IPawRewardsReservationDocument extends Document {
  userId: mongoose.Types.ObjectId;
  /** Stable checkout / PendingOrder identifier */
  checkoutId: string;
  amount: number;
  status: PawRewardsReservationStatus;
  orderId?: mongoose.Types.ObjectId;
  expiresAt: Date;
  committedAt?: Date;
  releasedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Durable PawRewards checkout reservation ledger.
 * Used to make reserve/commit/release idempotent under retries.
 */
const PawRewardsReservationSchema = new Schema<IPawRewardsReservationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    checkoutId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['reserved', 'committed', 'released', 'expired'],
      default: 'reserved',
      index: true,
    },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    expiresAt: { type: Date, required: true, index: true },
    committedAt: { type: Date },
    releasedAt: { type: Date },
  },
  { timestamps: true },
);

PawRewardsReservationSchema.index({ checkoutId: 1, userId: 1 }, { unique: true });
PawRewardsReservationSchema.index({ status: 1, expiresAt: 1 });

export const PawRewardsReservation = mongoose.model<IPawRewardsReservationDocument>(
  'PawRewardsReservation',
  PawRewardsReservationSchema,
);

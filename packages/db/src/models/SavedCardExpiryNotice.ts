import mongoose, { Schema, Document } from 'mongoose';

export type SavedCardExpiryNoticeStatus = 'pending' | 'sent' | 'failed';

export interface ISavedCardExpiryNoticeDocument extends Document {
  userId: mongoose.Types.ObjectId;
  stripeCustomerId: string;
  paymentMethodId: string;
  expMonth: number;
  expYear: number;
  cardBrand?: string;
  cardLast4?: string;
  status: SavedCardExpiryNoticeStatus;
  attempts: number;
  lastAttemptAt?: Date;
  sentAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tracks saved-card expiry notifications.
 *
 * The unique {userId, paymentMethodId, expMonth, expYear} key is the natural
 * idempotency unit: ONE notification per card per expiration period. When a
 * card's expiry is updated (e.g. Stripe Account Updater), expMonth/expYear
 * change and the next period is tracked separately.
 */
const SavedCardExpiryNoticeSchema = new Schema<ISavedCardExpiryNoticeDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stripeCustomerId: { type: String, required: true },
    paymentMethodId: { type: String, required: true },
    expMonth: { type: Number, required: true, min: 1, max: 12 },
    expYear: { type: Number, required: true },
    cardBrand: { type: String },
    cardLast4: { type: String },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    attempts: { type: Number, default: 0, min: 0 },
    lastAttemptAt: { type: Date },
    sentAt: { type: Date },
    lastError: { type: String },
  },
  { timestamps: true },
);

// One notice per card per expiration period — the send-once guarantee.
SavedCardExpiryNoticeSchema.index(
  { userId: 1, paymentMethodId: 1, expMonth: 1, expYear: 1 },
  { unique: true },
);

export const SavedCardExpiryNotice = mongoose.model<ISavedCardExpiryNoticeDocument>(
  'SavedCardExpiryNotice',
  SavedCardExpiryNoticeSchema,
);

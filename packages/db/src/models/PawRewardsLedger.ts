import mongoose, { Schema, Document } from 'mongoose';

export interface IPawRewardsLedgerDocument extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  type: 'allocation' | 'earning' | 'redemption' | 'expiration';
  description: string;
  createdAt: Date;
}

const PawRewardsLedgerSchema = new Schema<IPawRewardsLedgerDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    type: { 
      type: String, 
      enum: ['allocation', 'earning', 'redemption', 'expiration'], 
      required: true, 
      index: true 
    },
    description: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Indexes for efficient queries
PawRewardsLedgerSchema.index({ userId: 1, type: 1, createdAt: -1 });
PawRewardsLedgerSchema.index({ userId: 1, createdAt: -1 });

export const PawRewardsLedger = mongoose.model<IPawRewardsLedgerDocument>(
  'PawRewardsLedger',
  PawRewardsLedgerSchema
);

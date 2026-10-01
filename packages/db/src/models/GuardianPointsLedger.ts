import mongoose, { Schema, Document } from 'mongoose';

/**
 * Guardian Points Ledger metadata shape.
 *
 * For points earned going forward, metadata includes:
 * - basePoints: points before multiplier was applied
 * - multiplier: the tier multiplier at earn time (e.g. 1, 2, 3)
 * - bonusPoints: points earned from the multiplier (basePoints × (multiplier - 1))
 *
 * For clawback entries, metadata includes:
 * - reason: 'membership_downgrade_clawback'
 * - originalPoints: balance before clawback
 * - oldMultiplier: multiplier before downgrade
 * - newMultiplier: multiplier after downgrade
 */
export interface IGuardianPointsLedgerMetadata {
  basePoints?: number;
  multiplier?: number;
  bonusPoints?: number;
  reason?: string;
  originalPoints?: number;
  oldMultiplier?: number;
  newMultiplier?: number;
  [key: string]: any;
}

export interface IGuardianPointsLedgerDocument extends Document {
  userId: mongoose.Types.ObjectId;
  points: number;
  activity: string;
  referenceId: string;
  metadata: IGuardianPointsLedgerMetadata;
  createdAt: Date;
}

const GuardianPointsLedgerSchema = new Schema<IGuardianPointsLedgerDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    points: { type: Number, required: true },
    activity: { type: String, required: true, index: true },
    referenceId: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Indexes for efficient queries
GuardianPointsLedgerSchema.index({ userId: 1, activity: 1, createdAt: -1 });
GuardianPointsLedgerSchema.index({ userId: 1, createdAt: -1 });
GuardianPointsLedgerSchema.index({ activity: 1, createdAt: -1 });

export const GuardianPointsLedger = mongoose.model<IGuardianPointsLedgerDocument>(
  'GuardianPointsLedger',
  GuardianPointsLedgerSchema
);

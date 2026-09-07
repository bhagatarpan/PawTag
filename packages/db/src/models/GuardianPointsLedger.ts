import mongoose, { Schema, Document } from 'mongoose';

export interface IGuardianPointsLedgerDocument extends Document {
  userId: mongoose.Types.ObjectId;
  points: number;
  activity: string;
  referenceId: string;
  metadata: Record<string, any>;
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

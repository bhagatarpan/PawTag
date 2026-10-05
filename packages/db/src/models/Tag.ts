import mongoose, { Schema, Document } from 'mongoose';

export interface ITagDocument extends Document {
  tagId: string;
  tagType: 'qr' | 'nfc';
  petId?: mongoose.Types.ObjectId;
  ownerId?: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  nfcEnabled: boolean;
  replacesTagId?: mongoose.Types.ObjectId;
  replacedByTagId?: mongoose.Types.ObjectId;
  status: 'active' | 'inactive' | 'lost' | 'limited' | 'expired' | 'terminated' | 'replaced' | 'deleted' | 'returned';
  qrCodeUrl?: string;
  nfcUrl?: string;
  lastScannedAt?: Date;
  lastScanLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    source: 'gps' | 'qr_scan' | 'nfc_tap' | 'manual';
  };
  subscriptionStatus: 'active' | 'inactive' | 'grace_period' | 'expired' | 'none';
  subscriptionId?: mongoose.Types.ObjectId;
  activatedAt?: Date;
  activePeriodEndsAt?: Date;
  warrantyEndsAt?: Date;
  membershipStartsAt?: Date;
  reminderStates?: {
    activePeriod30DaySent?: boolean;
    activePeriod7DaySent?: boolean;
    activePeriodLastDaySent?: boolean;
  };
  unlinkedAt?: Date;
  unlinkReason?: string;
  unlinkedBy?: mongoose.Types.ObjectId;
  unlinkedByName?: string;
  /** Returned to PawTag (goods received). Ownership cleared. */
  returnedAt?: Date;
  returnId?: mongoose.Types.ObjectId;
  returnedOwnerId?: mongoose.Types.ObjectId;
  deletedAt?: Date;
}

const TagSchema = new Schema<ITagDocument>(
  {
    tagId: { type: String, required: true, unique: true, index: true },
    tagType: { type: String, enum: ['qr', 'nfc'], default: 'qr', index: true },
    petId: { type: Schema.Types.ObjectId, ref: 'Pet', index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    nfcEnabled: { type: Boolean, default: false },
    replacesTagId: { type: Schema.Types.ObjectId, ref: 'Tag' },
    replacedByTagId: { type: Schema.Types.ObjectId, ref: 'Tag' },
    status: { type: String, enum: ['active', 'inactive', 'lost', 'limited', 'expired', 'terminated', 'replaced', 'deleted', 'returned'], default: 'inactive' },
    qrCodeUrl: { type: String },
    nfcUrl: { type: String },
    lastScannedAt: { type: Date },
    lastScanLocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      source: { type: String, enum: ['gps', 'qr_scan', 'nfc_tap', 'manual'] },
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'inactive', 'grace_period', 'expired', 'none'],
      default: 'none',
    },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    activatedAt: { type: Date },
    activePeriodEndsAt: { type: Date },
    warrantyEndsAt: { type: Date },
    membershipStartsAt: { type: Date },
    reminderStates: {
      activePeriod30DaySent: { type: Boolean, default: false },
      activePeriod7DaySent: { type: Boolean, default: false },
      activePeriodLastDaySent: { type: Boolean, default: false },
    },
    unlinkedAt: { type: Date },
    unlinkReason: { type: String },
    unlinkedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    unlinkedByName: { type: String },
    returnedAt: { type: Date },
    returnId: { type: Schema.Types.ObjectId, ref: 'Return' },
    returnedOwnerId: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

TagSchema.index({ ownerId: 1 });
TagSchema.index({ petId: 1 });
TagSchema.index({ deletedAt: 1 });
TagSchema.index({ petId: 1, deletedAt: 1 });
TagSchema.index({ ownerId: 1, deletedAt: 1 });

export const Tag = mongoose.model<ITagDocument>('Tag', TagSchema);

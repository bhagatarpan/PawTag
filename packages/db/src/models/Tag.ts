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
  status: 'active' | 'inactive' | 'lost';
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
    status: { type: String, enum: ['active', 'inactive', 'lost'], default: 'inactive' },
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

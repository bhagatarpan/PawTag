import mongoose, { Schema, Document } from 'mongoose';

export interface IFinderScanDocument extends Document {
  tagId: mongoose.Types.ObjectId;
  petId: mongoose.Types.ObjectId;
  scannedBy?: string;
  deviceInfo: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  action: 'viewed' | 'notified_owner' | 'shared_location';
  notifiedAt?: Date;
  contactAttempted: boolean;
}

const FinderScanSchema = new Schema<IFinderScanDocument>(
  {
    tagId: { type: Schema.Types.ObjectId, ref: 'Tag', required: true, index: true },
    petId: { type: Schema.Types.ObjectId, ref: 'Pet', required: true, index: true },
    scannedBy: { type: String },
    deviceInfo: { type: String, required: true },
    location: {
      latitude: Number,
      longitude: Number,
    },
    action: {
      type: String,
      enum: ['viewed', 'notified_owner', 'shared_location'],
      default: 'viewed',
    },
    notifiedAt: { type: Date },
    contactAttempted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

FinderScanSchema.index({ tagId: 1, createdAt: -1 });
FinderScanSchema.index({ petId: 1 });

export const FinderScan = mongoose.model<IFinderScanDocument>('FinderScan', FinderScanSchema);

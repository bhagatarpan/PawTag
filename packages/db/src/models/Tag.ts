import mongoose, { Schema, Document } from 'mongoose';

export interface ITagDocument extends Document {
  tagId: string;
  petId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  status: 'active' | 'inactive' | 'lost';
  qrCodeUrl?: string;
  lastScannedAt?: Date;
  lastScanLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    source: 'gps' | 'qr_scan' | 'manual';
  };
}

const TagSchema = new Schema<ITagDocument>(
  {
    tagId: { type: String, required: true, unique: true, index: true },
    petId: { type: Schema.Types.ObjectId, ref: 'Pet', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['active', 'inactive', 'lost'], default: 'active' },
    qrCodeUrl: { type: String },
    lastScannedAt: { type: Date },
    lastScanLocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      source: { type: String, enum: ['gps', 'qr_scan', 'manual'] },
    },
  },
  { timestamps: true },
);

TagSchema.index({ ownerId: 1 });
TagSchema.index({ petId: 1 });

export const Tag = mongoose.model<ITagDocument>('Tag', TagSchema);

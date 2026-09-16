import mongoose, { Schema, Document } from 'mongoose';

export interface IFinderScanDocument extends Document {
  tagId: mongoose.Types.ObjectId;
  petId: mongoose.Types.ObjectId;
  scannedBy?: string;
  deviceInfo: string;
  // Parsed device info (from User-Agent)
  deviceBrowser?: string;
  deviceOS?: string;
  deviceType?: string;
  // IP-based geolocation (approximate, no consent needed)
  ipLocation?: {
    city?: string;
    region?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  // GPS location (only when finder explicitly shares)
  gpsLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  // Legacy field (kept for backward compatibility)
  location?: {
    latitude: number;
    longitude: number;
  };
  action: 'viewed' | 'notified_owner' | 'shared_location';
  notifiedAt?: Date;
  contactAttempted: boolean;
  finderPhone?: string;
  finderEmail?: string;
  finderName?: string;
  consent?: {
    locationConsent: 'granted' | 'denied' | 'skipped' | 'unavailable';
    consentedAt?: Date;
    consentVersion?: string;
    ipAddress?: string;
  };
}

const FinderScanSchema = new Schema<IFinderScanDocument>(
  {
    tagId: { type: Schema.Types.ObjectId, ref: 'Tag', required: true, index: true },
    petId: { type: Schema.Types.ObjectId, ref: 'Pet', required: true, index: true },
    scannedBy: { type: String },
    deviceInfo: { type: String, required: true },
    // Parsed device info (from User-Agent)
    deviceBrowser: { type: String },
    deviceOS: { type: String },
    deviceType: { type: String, enum: ['desktop', 'mobile', 'tablet'] },
    // IP-based geolocation (approximate, no consent needed)
    ipLocation: {
      city: { type: String },
      region: { type: String },
      country: { type: String },
      latitude: { type: Number },
      longitude: { type: Number },
    },
    // GPS location (only when finder explicitly shares)
    gpsLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      accuracy: { type: Number },
    },
    // Legacy field (kept for backward compatibility)
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
    finderPhone: { type: String },
    finderEmail: { type: String },
    finderName: { type: String },
    consent: {
      locationConsent: { type: String, enum: ['granted', 'denied', 'skipped', 'unavailable'] },
      consentedAt: { type: Date },
      consentVersion: { type: String },
      ipAddress: { type: String },
    },
  },
  { timestamps: true },
);

FinderScanSchema.index({ tagId: 1, createdAt: -1 });
FinderScanSchema.index({ petId: 1 });
FinderScanSchema.index({ petId: 1, action: 1, notifiedAt: -1 });
FinderScanSchema.index({ createdAt: -1 });
// New indexes for analytics
FinderScanSchema.index({ deviceType: 1 });
FinderScanSchema.index({ deviceBrowser: 1 });
FinderScanSchema.index({ 'ipLocation.country': 1 });
FinderScanSchema.index({ action: 1, createdAt: -1 });

export const FinderScan = mongoose.model<IFinderScanDocument>('FinderScan', FinderScanSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface ILocationEventDocument extends Document {
  tagId: mongoose.Types.ObjectId;
  petId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  timestamp: Date;
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    source: 'gps' | 'qr_scan' | 'manual';
  };
  finderId?: string;
  notes?: string;
}

const LocationEventSchema = new Schema<ILocationEventDocument>(
  {
    tagId: { type: Schema.Types.ObjectId, ref: 'Tag', required: true, index: true },
    petId: { type: Schema.Types.ObjectId, ref: 'Pet', required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    timestamp: { type: Date, default: Date.now },
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      accuracy: Number,
      source: { type: String, enum: ['gps', 'qr_scan', 'manual'], required: true },
    },
    finderId: { type: String },
    notes: { type: String },
  },
  { timestamps: true },
);

LocationEventSchema.index({ tagId: 1, timestamp: -1 });
LocationEventSchema.index({ petId: 1 });
LocationEventSchema.index({ ownerId: 1 });

export const LocationEvent = mongoose.model<ILocationEventDocument>(
  'LocationEvent',
  LocationEventSchema,
);

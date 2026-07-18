import mongoose, { Schema, Document } from 'mongoose';

export interface IPetDocument extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  species: string;
  breed: string;
  gender: 'male' | 'female' | 'unknown';
  dateOfBirth?: Date;
  weight?: number;
  color: string;
  photoUrl?: string;
  medicalAlerts?: string;
  microchipId?: string;
  status: 'safe' | 'lost' | 'found';
  isNeutered: boolean;
  notes?: string;
}

const PetSchema = new Schema<IPetDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    species: { type: String, required: true, trim: true },
    breed: { type: String, required: true, trim: true },
    gender: { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' },
    dateOfBirth: { type: Date },
    weight: { type: Number },
    color: { type: String, required: true, trim: true },
    photoUrl: { type: String },
    medicalAlerts: { type: String },
    microchipId: { type: String },
    status: { type: String, enum: ['safe', 'lost', 'found'], default: 'safe' },
    isNeutered: { type: Boolean, default: false },
    notes: { type: String },
  },
  { timestamps: true },
);

PetSchema.index({ ownerId: 1 });
PetSchema.index({ status: 1 });

export const Pet = mongoose.model<IPetDocument>('Pet', PetSchema);

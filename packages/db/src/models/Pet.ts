import mongoose, { Schema, Document } from 'mongoose';

export interface IPetDocument extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  petType: string;          // Dog, Cat, Rabbit, Hamster, Guinea Pig, Bird
  species: string;          // kept for backward compat — defaults to petType
  breed: string;
  gender: 'male' | 'female' | 'unknown';
  dateOfBirth?: Date;
  weight?: number;
  color: string;
  pattern?: string;
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
    petType: {
      type: String,
      required: true,
      enum: ['Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird'],
    },
    species: { type: String, required: true, trim: true },
    breed: { type: String, required: true, trim: true },
    gender: { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' },
    dateOfBirth: { type: Date },
    weight: { type: Number },
    color: { type: String, required: true, trim: true },
    pattern: { type: String, trim: true },
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
PetSchema.index({ petType: 1 });

export const Pet = mongoose.model<IPetDocument>('Pet', PetSchema);

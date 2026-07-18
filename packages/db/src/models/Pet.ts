import mongoose, { Schema, Document } from 'mongoose';

export interface IPetPhoto {
  url: string;
  caption?: string;
  isMain: boolean;
  addedAt: Date;
}

export interface IPetDocument extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  petType: string;          // Dog, Cat, Rabbit, Hamster, Guinea Pig, Bird
  species: string;          // kept for backward compat — defaults to petType
  breed: string;
  secondaryBreed?: string;  // when breed is "Mixed Breed"
  gender: 'male' | 'female' | 'unknown';
  dateOfBirth?: Date;
  weight?: number;
  color: string;
  pattern?: string;
  photos: IPetPhoto[];      // up to 5 photos
  photoUrl?: string;        // kept for backward compat (legacy single photo)
  medicalAlerts?: string;
  microchipId?: string;
  status: 'safe' | 'lost' | 'found';
  isNeutered: boolean;
  notes?: string;
}

const PetPhotoSchema = new Schema<IPetPhoto>(
  {
    url: { type: String, required: true },
    caption: { type: String },
    isMain: { type: Boolean, default: false },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

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
    secondaryBreed: { type: String, trim: true },
    gender: { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' },
    dateOfBirth: { type: Date },
    weight: { type: Number },
    color: { type: String, required: true, trim: true },
    pattern: { type: String, trim: true },
    photos: { type: [PetPhotoSchema], default: [], validate: { validator: (v: IPetPhoto[]) => v.length <= 5, message: 'A pet can have at most 5 photos' } },
    photoUrl: { type: String },  // legacy field for backward compat
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

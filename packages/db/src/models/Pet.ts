import mongoose, { Schema, Document } from 'mongoose';

export interface IPetPhoto {
  url: string;
  caption?: string;
  isMain: boolean;
  addedAt: Date;
}

export interface IPetDocument extends Document {
  petId: string;
  ownerId: mongoose.Types.ObjectId;
  name: string;
  petType: string;
  species: string;
  breed: string;
  secondaryBreed?: string;
  gender: 'male' | 'female' | 'unknown';
  dateOfBirth?: Date;
  age?: number;
  weight?: number;
  color: string;
  pattern?: string;
  favouriteFood?: string;
  photos: IPetPhoto[];
  photoUrl?: string;
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
    petId: { type: String, unique: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    petType: {
      type: String,
      required: true,
      enum: ['Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird'],
    },
    species: { type: String, required: true, trim: true },
    breed: { type: String, required: true, trim: true },
    secondaryBreed: { type: String, trim: true, default: 'Unknown' },
    gender: { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' },
    dateOfBirth: { type: Date },
    age: { type: Number, min: 0, max: 30 },
    weight: { type: Number },
    color: { type: String, required: true, trim: true },
    pattern: { type: String, trim: true },
    favouriteFood: { type: String, trim: true },
    photos: { type: [PetPhotoSchema], default: [], validate: { validator: (v: IPetPhoto[]) => v.length <= 5, message: 'A pet can have at most 5 photos' } },
    photoUrl: { type: String },
    medicalAlerts: { type: String },
    microchipId: { type: String },
    status: { type: String, enum: ['safe', 'lost', 'found'], default: 'safe' },
    isNeutered: { type: Boolean, default: false },
    notes: { type: String },
  },
  { timestamps: true },
);

PetSchema.pre('save', function (next) {
  if (this.breed === 'Mixed Breed' && !this.secondaryBreed) {
    this.secondaryBreed = 'Unknown';
  }
  if (this.dateOfBirth) {
    const now = new Date();
    const birth = new Date(this.dateOfBirth);
    let computedAge = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      computedAge--;
    }
    this.age = Math.max(0, computedAge);
  }
  next();
});

PetSchema.index({ ownerId: 1 });
PetSchema.index({ status: 1 });
PetSchema.index({ petType: 1 });
PetSchema.index({ petId: 1 }, { unique: true });

export const Pet = mongoose.model<IPetDocument>('Pet', PetSchema);

// --- Pet ID Generation ---
// Called from route handlers, not from hooks, to avoid Mongoose async hook issues.
// Format: XX-NNNNNNXYZ
export async function generatePetId(name: string, gender: string, breed: string, color: string): Promise<string> {
  const prefix = name.substring(0, 2).toUpperCase();
  const genderCode = (gender === 'female' ? 'F' : gender === 'male' ? 'M' : 'U').toUpperCase();
  const breedCode = breed.charAt(0).toUpperCase();
  const colorCode = color.charAt(0).toUpperCase();
  const suffix = `${genderCode}${breedCode}${colorCode}`;

  for (let attempt = 0; attempt < 10; attempt++) {
    const digits = Math.floor(100000 + Math.random() * 900000).toString();
    const candidate = `${prefix}-${digits}${suffix}`;
    const exists = await Pet.findOne({ petId: candidate }).lean();
    if (!exists) return candidate;
  }
  const ts = Date.now().toString().slice(-6);
  return `${prefix}-${ts}${suffix}`;
}

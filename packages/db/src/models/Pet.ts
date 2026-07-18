import mongoose, { Schema, Document } from 'mongoose';

// --- Sub-models ---

export interface IPetPhoto {
  url: string;
  caption?: string;
  isMain: boolean;
  addedAt: Date;
}

export interface IVaccination {
  vaccine: string;
  vaccineType: 'core' | 'non-core' | 'other';
  dateGiven: Date;
  nextDueDate?: Date;
  vetClinic?: string;
  batchLotNumber?: string;
  veterinarian?: string;
  notes?: string;
}

export interface IMicrochip {
  chipNumber: string;
  brand?: string;
  implantDate?: Date;
  implantLocation?: string;
  implantedBy?: string;
  notes?: string;
}

export interface IMedication {
  name: string;
  dosage?: string;
  frequency?: string;
  startDate?: Date;
  endDate?: Date;
  prescribedBy?: string;
  reason?: string;
  notes?: string;
}

export interface IAllergy {
  allergen: string;
  severity: 'mild' | 'moderate' | 'severe';
  reaction?: string;
  diagnosedBy?: string;
  notes?: string;
}

export interface IVetDetail {
  clinicName: string;
  address?: string;
  phone?: string;
  email?: string;
  veterinarian?: string;
  isPrimary: boolean;
  notes?: string;
}

export interface ISurgery {
  procedure: string;
  date: Date;
  performedBy?: string;
  clinic?: string;
  reason?: string;
  recoveryNotes?: string;
  notes?: string;
}

export interface IWeightRecord {
  weight: number;
  date: Date;
  notes?: string;
}

export interface IHealthCondition {
  condition: string;
  severity: 'mild' | 'moderate' | 'severe' | 'chronic';
  diagnosedDate?: Date;
  diagnosedBy?: string;
  treatment?: string;
  notes?: string;
}

export interface IDesexing {
  isDesexed: boolean;
  date?: Date;
  performedBy?: string;
  clinic?: string;
  notes?: string;
}

// --- Main Document ---

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
  status: 'safe' | 'lost' | 'found' | 'deceased' | 'stolen' | 'transferred' | 'donated' | 'sold';
  isNeutered: boolean;
  notes?: string;
  lostCount: number;
  foundByFinderAt?: Date;
  deletedAt?: Date;
  // Health records
  vaccinations: IVaccination[];
  microchips: IMicrochip[];
  medications: IMedication[];
  allergies: IAllergy[];
  vetDetails: IVetDetail[];
  surgeries: ISurgery[];
  weightHistory: IWeightRecord[];
  healthConditions: IHealthCondition[];
  desexing: IDesexing;
}

// --- Schemas ---

const PetPhotoSchema = new Schema<IPetPhoto>(
  {
    url: { type: String, required: true },
    caption: { type: String },
    isMain: { type: Boolean, default: false },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const VaccinationSchema = new Schema<IVaccination>(
  {
    vaccine: { type: String, required: true },
    vaccineType: { type: String, enum: ['core', 'non-core', 'other'], default: 'core' },
    dateGiven: { type: Date, required: true },
    nextDueDate: { type: Date },
    vetClinic: { type: String },
    batchLotNumber: { type: String },
    veterinarian: { type: String },
    notes: { type: String },
  },
  { _id: false },
);

const MicrochipSchema = new Schema<IMicrochip>(
  {
    chipNumber: { type: String, required: true },
    brand: { type: String },
    implantDate: { type: Date },
    implantLocation: { type: String },
    implantedBy: { type: String },
    notes: { type: String },
  },
  { _id: false },
);

const MedicationSchema = new Schema<IMedication>(
  {
    name: { type: String, required: true },
    dosage: { type: String },
    frequency: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    prescribedBy: { type: String },
    reason: { type: String },
    notes: { type: String },
  },
  { _id: false },
);

const AllergySchema = new Schema<IAllergy>(
  {
    allergen: { type: String, required: true },
    severity: { type: String, enum: ['mild', 'moderate', 'severe'], default: 'mild' },
    reaction: { type: String },
    diagnosedBy: { type: String },
    notes: { type: String },
  },
  { _id: false },
);

const VetDetailSchema = new Schema<IVetDetail>(
  {
    clinicName: { type: String, required: true },
    address: { type: String },
    phone: { type: String },
    email: { type: String },
    veterinarian: { type: String },
    isPrimary: { type: Boolean, default: false },
    notes: { type: String },
  },
  { _id: false },
);

const SurgerySchema = new Schema<ISurgery>(
  {
    procedure: { type: String, required: true },
    date: { type: Date, required: true },
    performedBy: { type: String },
    clinic: { type: String },
    reason: { type: String },
    recoveryNotes: { type: String },
    notes: { type: String },
  },
  { _id: false },
);

const WeightRecordSchema = new Schema<IWeightRecord>(
  {
    weight: { type: Number, required: true },
    date: { type: Date, required: true },
    notes: { type: String },
  },
  { _id: false },
);

const HealthConditionSchema = new Schema<IHealthCondition>(
  {
    condition: { type: String, required: true },
    severity: { type: String, enum: ['mild', 'moderate', 'severe', 'chronic'], default: 'mild' },
    diagnosedDate: { type: Date },
    diagnosedBy: { type: String },
    treatment: { type: String },
    notes: { type: String },
  },
  { _id: false },
);

const DesexingSchema = new Schema<IDesexing>(
  {
    isDesexed: { type: Boolean, default: false },
    date: { type: Date },
    performedBy: { type: String },
    clinic: { type: String },
    notes: { type: String },
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
    status: { type: String, enum: ['safe', 'lost', 'found', 'deceased', 'stolen', 'transferred', 'donated', 'sold'], default: 'safe' },
    isNeutered: { type: Boolean, default: false },
    notes: { type: String },
    lostCount: { type: Number, default: 0, min: 0 },
    foundByFinderAt: { type: Date },
    deletedAt: { type: Date, default: null },
    // Health records
    vaccinations: { type: [VaccinationSchema], default: [] },
    microchips: { type: [MicrochipSchema], default: [] },
    medications: { type: [MedicationSchema], default: [] },
    allergies: { type: [AllergySchema], default: [] },
    vetDetails: { type: [VetDetailSchema], default: [] },
    surgeries: { type: [SurgerySchema], default: [] },
    weightHistory: { type: [WeightRecordSchema], default: [] },
    healthConditions: { type: [HealthConditionSchema], default: [] },
    desexing: { type: DesexingSchema, default: () => ({ isDesexed: false }) },
  },
  { timestamps: true },
);

PetSchema.pre('save', function (next) {
  if (this.breed === 'Mixed Breed' && !this.secondaryBreed) {
    this.secondaryBreed = 'Unknown';
  }
  next();
});

PetSchema.index({ ownerId: 1 });
PetSchema.index({ status: 1 });
PetSchema.index({ petType: 1 });
PetSchema.index({ petId: 1 }, { unique: true });
PetSchema.index({ deletedAt: 1 });

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

import mongoose, { Schema, Document } from 'mongoose';

export interface ICmsPetReferenceDocument extends Document {
  type: 'pet_type' | 'breed' | 'color' | 'pattern' | 'gender' | 'vaccine';
  petSpecies?: string;
  label: string;
  value: string;
  order: number;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  deletedAt?: Date;
}

const CmsPetReferenceSchema = new Schema<ICmsPetReferenceDocument>(
  {
    type: { type: String, required: true, enum: ['pet_type', 'breed', 'color', 'pattern', 'gender', 'vaccine'], index: true },
    petSpecies: { type: String, index: true },
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true, lowercase: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

CmsPetReferenceSchema.index({ type: 1, petSpecies: 1, value: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
CmsPetReferenceSchema.index({ deletedAt: 1 });

export const CmsPetReference = mongoose.model<ICmsPetReferenceDocument>('CmsPetReference', CmsPetReferenceSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IEscalationRecord extends Document {
  petId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  tagId: mongoose.Types.ObjectId;
  finderScanId: mongoose.Types.ObjectId;
  status: 'pending' | 'owner_responded' | 'escalated' | 'forwarded' | 'resolved';
  stage: 'owner_notified' | 'emergency_contact_notified' | 'pawtag_team_notified';
  foundAt: Date;
  ownerNotifiedAt: Date;
  escalationDeadline: Date;
  escalatedAt?: Date;
  forwardedAt?: Date;
  resolvedAt?: Date;
  resolvedBy?: 'owner' | 'emergency_contact' | 'admin';
  finderName?: string;
  finderPhone?: string;
  finderEmail?: string;
  finderMessage?: string;
  scanLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  emergencyContactNotifiedAt?: Date;
  emergencyContactNotificationType?: 'email' | 'sms' | 'in_app';
  emergencyContactEscalatedAt?: Date;
  pawtagTeamNotifiedAt?: Date;
  pawtagTeamNotificationType?: 'email' | 'in_app';
  notes?: string;
}

const EscalationRecordSchema = new Schema<IEscalationRecord>(
  {
    petId: { type: Schema.Types.ObjectId, ref: 'Pet', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tagId: { type: Schema.Types.ObjectId, ref: 'Tag', required: true },
    finderScanId: { type: Schema.Types.ObjectId, ref: 'FinderScan', required: true },
    status: { type: String, enum: ['pending', 'owner_responded', 'escalated', 'forwarded', 'resolved'], default: 'pending' },
    stage: { type: String, enum: ['owner_notified', 'emergency_contact_notified', 'pawtag_team_notified'], default: 'owner_notified' },
    foundAt: { type: Date, required: true },
    ownerNotifiedAt: { type: Date, required: true },
    escalationDeadline: { type: Date, required: true },
    escalatedAt: { type: Date },
    forwardedAt: { type: Date },
    resolvedAt: { type: Date },
    resolvedBy: { type: String, enum: ['owner', 'emergency_contact', 'admin'] },
    finderName: { type: String },
    finderPhone: { type: String },
    finderEmail: { type: String },
    finderMessage: { type: String },
    scanLocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
    },
    emergencyContactNotifiedAt: { type: Date },
    emergencyContactNotificationType: { type: String, enum: ['email', 'sms', 'in_app'] },
    emergencyContactEscalatedAt: { type: Date },
    pawtagTeamNotifiedAt: { type: Date },
    pawtagTeamNotificationType: { type: String, enum: ['email', 'in_app'] },
    notes: { type: String },
  },
  { timestamps: true }
);

EscalationRecordSchema.index({ ownerId: 1, status: 1 });
EscalationRecordSchema.index({ petId: 1, status: 1 });
EscalationRecordSchema.index({ escalationDeadline: 1, status: 1 });

const EscalationRecord = mongoose.models.EscalationRecord || mongoose.model<IEscalationRecord>(
  'EscalationRecord',
  EscalationRecordSchema
);

export default EscalationRecord;

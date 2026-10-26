import mongoose, { Schema, Document } from 'mongoose';

/**
 * Customer-facing lost-and-found timeline for a pet.
 *
 * One durable, append-only record per event (scan, finder submission, consent,
 * notification attempt, Lost Mode activation, reunion). Deliberately separate
 * from AuditEvent (admin/ops audit) and Notification (interrupt-style inbox):
 * this is the owner's readable history. Approximate vs precise location is
 * carried explicitly (`precision`) so coarse data is never presented as GPS.
 */
export type PetHistoryEventType =
  | 'scan_received'
  | 'owner_prompted'
  | 'owner_prompt_dismissed'
  | 'finder_notified'
  | 'finder_location_shared'
  | 'finder_location_declined'
  | 'notification_attempted'
  | 'lost_activated'
  | 'reunion_confirmed';

export type PetHistoryActor = 'owner' | 'finder' | 'system';
/** Never present coarse data as exact GPS. */
export type PetHistoryPrecision = 'none' | 'approximate' | 'precise';

export interface IPetHistoryEventDocument extends Document {
  petId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  type: PetHistoryEventType;
  at: Date;
  actor: PetHistoryActor;
  precision?: PetHistoryPrecision;
  metadata?: Record<string, unknown>;
}

const PetHistoryEventSchema = new Schema<IPetHistoryEventDocument>(
  {
    petId: { type: Schema.Types.ObjectId, ref: 'Pet', required: true },
    // Denormalised owner for cheap scoping; the pet relationship stays authoritative.
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'scan_received',
        'owner_prompted',
        'owner_prompt_dismissed',
        'finder_notified',
        'finder_location_shared',
        'finder_location_declined',
        'notification_attempted',
        'lost_activated',
        'reunion_confirmed',
      ],
      required: true,
    },
    at: { type: Date, required: true, default: () => new Date() },
    actor: { type: String, enum: ['owner', 'finder', 'system'], required: true },
    precision: { type: String, enum: ['none', 'approximate', 'precise'] },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: false },
);

PetHistoryEventSchema.index({ petId: 1, at: -1 });

export const PetHistoryEvent = mongoose.model<IPetHistoryEventDocument>(
  'PetHistoryEvent',
  PetHistoryEventSchema,
);

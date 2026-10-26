import { PetHistoryEvent } from '@pawtag/db';
import type { PetHistoryEventType, PetHistoryActor, PetHistoryPrecision } from '@pawtag/db';
import logger from './logger';

export interface PetHistoryInput {
  petId: string;
  ownerId: string;
  type: PetHistoryEventType;
  actor: PetHistoryActor;
  precision?: PetHistoryPrecision;
  metadata?: Record<string, unknown>;
}

/**
 * Append one event to the owner-facing pet history timeline.
 *
 * Never throws: history must not break the operation it describes — a finder
 * contacting an owner must never fail because a timeline row failed, and the
 * authoritative pet status change is already persisted before this is called.
 * Failures are logged at error level so the gap is visible to operations.
 */
export async function recordPetHistory(input: PetHistoryInput): Promise<void> {
  try {
    await PetHistoryEvent.create({
      petId: input.petId,
      ownerId: input.ownerId,
      type: input.type,
      actor: input.actor,
      at: new Date(),
      precision: input.precision,
      metadata: input.metadata,
    });
  } catch (err) {
    logger.error({ err, ...input }, '[pet-history] Failed to record pet history event');
  }
}

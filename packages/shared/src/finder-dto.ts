/**
 * @module Finder DTOs
 * @description Public data transfer objects for the Finder application.
 *
 * The Finder is used by anonymous strangers who find lost pets.
 * Only information required to recover the animal should be exposed.
 *
 * These DTOs define the exact shape of public Finder responses.
 * Internal fields like microchip details, vaccination records,
 * veterinary clinic metadata, private notes, and full owner contact
 * information are intentionally excluded.
 */

/**
 * Public pet information visible to finders.
 *
 * Only includes fields necessary for pet identification and recovery.
 * Sensitive fields (medical records, microchip details, owner contact)
 * are excluded unless the owner has explicitly shared them.
 */
export interface FinderPetView {
  /** Pet display name */
  name: string;
  /** Pet species (dog, cat, etc.) */
  species: string;
  /** Primary breed */
  breed: string;
  /** Pet color for identification */
  color: string;
  /** Pet pattern (solid, spotted, etc.) */
  pattern?: string;
  /** Pet gender */
  gender?: string;
  /** Primary photo URL */
  photoUrl?: string;
  /** Additional photos (up to a reasonable limit) */
  photos?: Array<{ url: string; caption?: string; isMain: boolean }>;
  /**
   * Emergency medical alert summary.
   * Only included if the owner has explicitly chosen to share this.
   * Examples: "Diabetic - needs insulin", "Allergic to X"
   */
  medicalAlerts?: string;
  /** Lost/found/safe status */
  status: string;
}

/**
 * Public tag information visible to finders.
 */
export interface FinderTagView {
  /** Tag identifier (QR code value) */
  tagId: string;
  /** Tag status (active, inactive, expired) */
  tagStatus: string;
}

/**
 * Public owner contact information visible to finders.
 * Only includes what the owner has approved for public display.
 */
export interface FinderOwnerView {
  /** Owner display name (if approved for public display) */
  ownerName: string | null;
  /** Approximate owner location (city/area only, not full address) */
  ownerLocation: string | null;
  /** Owner phone (if approved for public display) */
  ownerPhone: string | null;
}

/**
 * Complete public Finder response for a scanned tag.
 */
export interface FinderDataView {
  /** Whether the tag is active for finder use */
  tagActive: boolean;
  /** Pet information (null if tag is inactive) */
  pet: FinderPetView | null;
  /** Tag information */
  tag: FinderTagView;
  /** Owner contact information (may be masked for safe pets) */
  owner: FinderOwnerView;
  /** Whether owner info is masked because pet is safe */
  safePetMasking: boolean;
}

/**
 * Map an internal Pet document to the public FinderPetView DTO.
 *
 * This is the single source of truth for which fields are public.
 * Do not add fields here without considering privacy implications.
 */
export function toFinderPetView(pet: {
  name?: string;
  species?: string;
  breed?: string;
  color?: string;
  pattern?: string;
  gender?: string;
  photoUrl?: string;
  photos?: Array<{ url: string; caption?: string; isMain: boolean }>;
  medicalAlerts?: string;
  status?: string;
}): FinderPetView {
  return {
    name: pet.name || 'Unknown',
    species: pet.species || 'unknown',
    breed: pet.breed || 'Unknown',
    color: pet.color || 'Unknown',
    pattern: pet.pattern,
    gender: pet.gender,
    photoUrl: pet.photoUrl,
    photos: pet.photos,
    medicalAlerts: pet.medicalAlerts || undefined,
    status: pet.status || 'unknown',
  };
}

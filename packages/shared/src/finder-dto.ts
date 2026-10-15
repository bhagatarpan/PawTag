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
 * Includes fields necessary for pet identification and recovery, plus
 * non-premium care attributes (age, favourite food, medical alerts) the
 * founder has approved for all pets regardless of membership tier.
 * Sensitive fields (medical records, microchip details, birthday, owner
 * contact) remain excluded.
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
  /** Age in whole years — stored age, or computed from birthday when only the birthday is set */
  age?: number;
  /** Owner-entered favourite food; helps a finder comfort the pet */
  favouriteFood?: string;
  /** Primary photo URL */
  photoUrl?: string;
  /** Additional photos (up to a reasonable limit) */
  photos?: Array<{ url: string; caption?: string; isMain: boolean }>;
  /**
   * Emergency medical alert summary.
   * Non-premium: shown for all pets. Gated separately by the finder
   * route when the owner's entitlement disables it.
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
 * Whole years between a birthday and today. Returns undefined for missing
 * or unparseable dates. The birthday itself is never exposed — only the
 * coarse year count.
 */
function ageFromBirthday(dateOfBirth: Date | string | undefined): number | undefined {
  if (!dateOfBirth) return undefined;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return undefined;
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) years -= 1;
  return years >= 0 ? years : undefined;
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
  age?: number;
  dateOfBirth?: Date | string;
  favouriteFood?: string;
  photoUrl?: string;
  photos?: Array<{ url: string; caption?: string; isMain: boolean }>;
  medicalAlerts?: string;
  status?: string;
}): FinderPetView {
  // Owners may enter an age directly or only a birthday — accept either.
  const age = typeof pet.age === 'number' && pet.age >= 0 ? pet.age : ageFromBirthday(pet.dateOfBirth);

  return {
    name: pet.name || 'Unknown',
    species: pet.species || 'unknown',
    breed: pet.breed || 'Unknown',
    color: pet.color || 'Unknown',
    pattern: pet.pattern,
    gender: pet.gender,
    age,
    favouriteFood: pet.favouriteFood || undefined,
    photoUrl: pet.photoUrl,
    photos: pet.photos,
    medicalAlerts: pet.medicalAlerts || undefined,
    status: pet.status || 'unknown',
  };
}

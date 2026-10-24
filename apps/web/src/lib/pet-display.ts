import type { BadgeVariant } from '@pawtag/ui';

/**
 * Shared pet presentation helpers — one source for status labels/variants
 * and relative-time/age formatting used by MyPets, PetCard, PetDetail and
 * LostMode (avoids the three-copies drift this redesign found).
 */

const STATUS_LABELS: Record<string, string> = {
  safe: 'Safe',
  lost: 'Lost',
  found: 'Found',
  deceased: 'Deceased',
  stolen: 'Stolen',
  transferred: 'Transferred',
  donated: 'Donated',
  sold: 'Sold',
};

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  safe: 'success',
  lost: 'danger',
  found: 'warning',
  deceased: 'neutral',
  stolen: 'danger',
  transferred: 'info',
  donated: 'primary',
  sold: 'warning',
};

export function petStatusBadgeLabel(status: string): string {
  return STATUS_LABELS[status] || STATUS_LABELS.safe;
}

export function petStatusBadgeVariant(status: string): BadgeVariant {
  return STATUS_VARIANTS[status] || 'neutral';
}

export function petAgeLabel(pet: { age?: number | null; dateOfBirth?: string | null }): string {
  if (pet.age != null) return `${pet.age} yr${pet.age !== 1 ? 's' : ''}`;
  if (pet.dateOfBirth) {
    const diff = Date.now() - new Date(pet.dateOfBirth).getTime();
    const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
    if (years > 0) return `${years} yr${years !== 1 ? 's' : ''}`;
    const months = Math.floor(diff / (30.44 * 24 * 60 * 60 * 1000));
    return `${months} mo`;
  }
  return '';
}

/** Main photo for a pet, or null when the pet has no usable image. */
export function petMainPhoto(pet: {
  photos?: Array<{ url: string; isMain?: boolean }>;
  mainPhoto?: string;
  photoUrl?: string;
}): string | null {
  if (pet.photos && pet.photos.length > 0) {
    const main = pet.photos.find((p) => p.isMain);
    return (main || pet.photos[0]).url;
  }
  return pet.mainPhoto || pet.photoUrl || null;
}

export function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

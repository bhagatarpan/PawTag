/**
 * External maps link for a shared location (founder packet 2026-10-28):
 * the owner taps through to their own maps app — no embedded map, no new
 * dependency, and the finder is never involved in the rendering.
 * Returns null for missing/invalid coords so approximate (IP-locality)
 * events can never masquerade as a precise spot.
 */
export function mapsUrl(
  latitude?: number | null,
  longitude?: number | null,
): string | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

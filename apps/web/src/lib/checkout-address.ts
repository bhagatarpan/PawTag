/**
 * Format a saved address for display on checkout address cards.
 * Each card must show the address's own lines — not the currently selected form.
 */
export interface SavedAddressLike {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export function formatSavedAddressLines(addr: SavedAddressLike): { lineA: string; lineB: string } {
  const lineA = [addr.line1, addr.line2].filter(Boolean).join(', ');
  const lineB = [addr.city, addr.zip].filter(Boolean).join(' ');
  return { lineA, lineB };
}

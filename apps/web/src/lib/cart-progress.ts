import { roundToCents } from '@pawtag/shared';

export interface FreeShippingProgress {
  /** Effective threshold in dollars (server-resolved entitlement). */
  threshold: number;
  /** Amount left to spend; 0 when unlocked. */
  remaining: number;
  /** Progress 0–100 for the display bar. */
  percent: number;
  unlocked: boolean;
}

/**
 * Display-only progress toward the member free-shipping threshold.
 * Returns null when there is no effective threshold (guests/non-members) —
 * the UI must never invent a threshold the server does not apply.
 * Money math uses shared integer-cent rounding; this drives DISPLAY only —
 * authoritative free-shipping application stays in server cart/checkout totals.
 */
export function freeShippingProgress(
  subtotal: number,
  threshold: number | null | undefined,
): FreeShippingProgress | null {
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold <= 0) return null;

  // roundToCents keeps dollars but guarantees exact cent precision.
  const safeSubtotal = roundToCents(Number.isFinite(subtotal) && subtotal > 0 ? subtotal : 0);
  const thresholdDollars = roundToCents(threshold);
  const remainingDollars = Math.max(0, roundToCents(thresholdDollars - safeSubtotal));
  const percent =
    thresholdDollars === 0
      ? 0
      : Math.min(100, Math.max(0, Math.round((safeSubtotal / thresholdDollars) * 100)));

  return {
    threshold: thresholdDollars,
    remaining: remainingDollars,
    percent,
    unlocked: remainingDollars === 0,
  };
}

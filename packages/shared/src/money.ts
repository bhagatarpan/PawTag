/**
 * @module PawTag Money Utilities
 * @description Single source of truth for monetary arithmetic, rounding, and
 * currency-aware Stripe amount conversion.
 *
 * All money values in PawTag are stored as float dollars (e.g. 19.99).
 * Stripe expects integer minor units (e.g. 1999 cents for NZD).
 *
 * Rules:
 * - Do NOT round intermediate calculations — only round at persistence or
 *   Stripe-boundary boundaries to avoid cumulative errors.
 * - Use `roundToCents` before persisting any monetary value to the database.
 * - Use `toStripeAmount` (not raw `toCents`) when sending amounts to Stripe,
 *   so zero-decimal currencies are handled correctly.
 * - Use `addMoney`/`subtractMoney`/`multiplyMoney` for arithmetic that must
 *   not accumulate floating-point dust.
 */

// ─── Stripe zero-decimal currencies ───────────────────────────────
// These currencies have no minor unit — Stripe expects the full amount.
// Source: https://docs.stripe.com/currencies#zero-decimal
const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
  'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

/** Number of decimal places for a currency's minor unit (2 for NZD, 0 for JPY). */
export function getCurrencyDecimals(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency?.toLowerCase()) ? 0 : 2;
}

// ─── Core conversions ─────────────────────────────────────────────

/**
 * Convert dollars to integer cents (minor units).
 * Rounds half-up to nearest cent. For zero-decimal currencies, returns the
 * amount as-is (rounded to integer).
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convert integer cents back to dollars.
 * Result may contain float dust (e.g. 2034 / 100 = 20.34); use `roundToCents`
 * before persisting.
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Round a dollar amount to exactly 2 decimal places (nearest cent).
 * Use before persisting any monetary value to the database.
 */
export function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Convert a dollar amount to Stripe's expected minor-unit integer,
 * respecting currency-specific decimal places.
 *
 * NZD → multiply by 100 and round (e.g. 20.34 → 2034).
 * JPY → round to integer (e.g. 500.6 → 501).
 */
export function toStripeAmount(amount: number, currency: string): number {
  const decimals = getCurrencyDecimals(currency);
  return Math.round(amount * Math.pow(10, decimals));
}

/**
 * Convert Stripe minor-unit integer back to dollars,
 * respecting currency-specific decimal places.
 */
export function fromStripeAmount(minorUnits: number, currency: string): number {
  const decimals = getCurrencyDecimals(currency);
  return minorUnits / Math.pow(10, decimals);
}

// ─── Safe arithmetic (operates in cents internally) ───────────────

/**
 * Add monetary amounts with cent-level precision.
 * Sums in integer cents to avoid floating-point accumulation.
 */
export function addMoney(...values: number[]): number {
  const totalCents = values.reduce((sum, v) => sum + toCents(v), 0);
  return fromCents(totalCents);
}

/**
 * Subtract monetary amounts with cent-level precision.
 */
export function subtractMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * Multiply a monetary amount by a factor, rounding to the nearest cent.
 */
export function multiplyMoney(amount: number, factor: number): number {
  return roundToCents(amount * factor);
}

/**
 * Clamp a monetary amount to a non-negative value.
 */
export function clampMoneyNonNegative(amount: number): number {
  return amount < 0 ? 0 : roundToCents(amount);
}

// ─── Allocation (splitting money across line items) ───────────────

/**
 * Allocate a total amount across weighted parts without losing or gaining cents.
 * Uses the largest-remainder method: each part gets floor(share), then remaining
 * cents are distributed one-per-part to the largest fractional remainders.
 *
 * The sum of the returned array always equals `totalCents` exactly.
 *
 * @param totalCents - Total to allocate, in integer cents
 * @param weights - Relative weights (e.g. line item prices or quantities)
 * @returns Allocated amounts in integer cents, one per weight
 */
export function allocateCents(totalCents: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight <= 0) {
    // No meaningful weights — give everything to the first part
    const result = new Array(weights.length).fill(0);
    result[0] = totalCents;
    return result;
  }

  // Compute exact shares and floor them
  const exactShares = weights.map((w) => (totalCents * w) / totalWeight);
  const floored = exactShares.map((s) => Math.floor(s));
  const remainder = totalCents - floored.reduce((s, f) => s + f, 0);

  // Distribute remaining cents to the largest fractional remainders
  const indicesByRemainder = exactShares
    .map((share, i) => ({ i, frac: share - Math.floor(share) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floored];
  for (let k = 0; k < remainder; k++) {
    result[indicesByRemainder[k % indicesByRemainder.length].i] += 1;
  }

  return result;
}

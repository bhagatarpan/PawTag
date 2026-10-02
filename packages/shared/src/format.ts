/**
 * Shared formatting utilities for money and dates.
 *
 * These are the single source of truth for display formatting across
 * PawTag web apps. Do not re-implement local formatDate/formatCurrency
 * helpers — import from here instead.
 *
 * Platform-neutral (no React, no DOM) so they can be used from any package.
 */

// ─── Currency ────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  NZD: 'NZ$',
  USD: '$',
  AUD: 'A$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
};

/**
 * Format an amount as a currency string.
 *
 * @param amount - numeric amount (e.g. 89)
 * @param currency - ISO 4217 code (default 'NZD')
 * @param options.decimals - show decimal places (default true)
 *
 * @example
 * formatCurrency(89)          // 'NZ$89.00'
 * formatCurrency(89, 'NZD', { decimals: false })  // 'NZ$89'
 * formatCurrency(7.53)        // 'NZ$7.53'
 */
export function formatCurrency(
  amount: number,
  currency: string = 'NZD',
  options: { decimals?: boolean } = {},
): string {
  const { decimals = true } = options;
  const symbol = currencySymbol(currency);
  return decimals ? `${symbol}${amount.toFixed(2)}` : `${symbol}${Math.round(amount)}`;
}

/**
 * Get the display symbol for a currency code.
 * Falls back to the code followed by a space for unknown currencies.
 */
export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency?.toUpperCase()] || `${currency} `;
}

// ─── Date ────────────────────────────────────────────────────

export type DateStyle = 'short' | 'medium' | 'long';

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: 'numeric', month: 'short', year: 'numeric' },
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  long: { year: 'numeric', month: 'long', day: 'numeric' },
};

/**
 * Format a date string or Date object for display (en-NZ locale).
 *
 * @param iso - ISO date string or Date object
 * @param style - 'short' | 'medium' (default) | 'long'
 *
 * @example
 * formatDate('2027-09-30')           // '30 Sep 2027'
 * formatDate('2027-09-30', 'long')   // '30 September 2027'
 */
export function formatDate(iso: string | Date, style: DateStyle = 'medium'): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return date.toLocaleDateString('en-NZ', DATE_OPTIONS[style]);
}

/**
 * Format a date with time (en-NZ locale).
 *
 * @example
 * formatDateTime('2027-09-30T10:30:00Z')  // '30 Sep 2027, 11:30 pm'
 */
export function formatDateTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return date.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ─── Refund destination ──────────────────────────────────────
// Stripe refunds always return to the original payment method.
// These helpers format that fact for customer/admin UI and email copy.

export function formatCardBrand(brand?: string | null): string {
  if (!brand) return '';
  return brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
}

export function formatCardDisplay(brand?: string | null, last4?: string | null): string | null {
  const formattedBrand = formatCardBrand(brand);
  if (formattedBrand && last4) {
    return `${formattedBrand} ••••${last4}`;
  }
  if (formattedBrand) {
    return formattedBrand;
  }
  if (last4) {
    return `••••${last4}`;
  }
  return null;
}

/** Short label for list rows / badges */
export function formatRefundDestinationShort(brand?: string | null, last4?: string | null): string | null {
  const card = formatCardDisplay(brand, last4);
  return card ? `Refund to ${card}` : null;
}

/** Full label used on order detail / admin refund surfaces */
export function formatRefundDestination(brand?: string | null, last4?: string | null): string {
  const card = formatCardDisplay(brand, last4);
  if (card) {
    return `${card} (original payment method)`;
  }
  return 'Original payment method';
}

/** Customer-facing sentence when card data is known */
export function formatRefundDestinationSentence(brand?: string | null, last4?: string | null): string {
  const card = formatCardDisplay(brand, last4);
  if (card) {
    return `Refunds go back to the original payment method — ${card}. If that card was replaced or expired, your bank usually posts the refund to your new card or bank account.`;
  }
  return 'Refunds go back to the original payment method used for this order. If that card was replaced or expired, your bank usually posts the refund to your new card or bank account.';
}

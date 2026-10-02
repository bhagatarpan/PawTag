/**
 * Refund destination helpers for shared UI components.
 *
 * Product rule: Stripe refunds always return to the original payment method.
 * These helpers format that fact for customer/admin UI. They never invent
 * a destination when card data is missing.
 *
 * Note: packages/ui does not depend on @pawtag/shared (apps do). Keep these
 * pure formatters local to UI; API uses the same helpers from @pawtag/shared.
 */

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

/** Local date helper for refund card rows (UI does not import shared format utils) */
export function formatDateTime(iso?: string | Date | null): string {
  if (!iso) return '—';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return date.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

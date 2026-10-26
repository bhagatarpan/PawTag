// ============================================================
// Customer portal donations (list + detail)
// Shared contracts for GET /api/donations/me
// ============================================================

/**
 * Human labels for donation statuses (DB enum: Donation.ts). Config here so
 * list + detail resolve copy from one place — raw enum text
 * ("succeeded"/"partially_refunded") never reaches customers.
 */
export const DONATION_STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: 'Pending',
  processing: 'Processing',
  succeeded: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  partially_refunded: 'Partially refunded',
  refunded: 'Refunded',
};

/** Frequency copy for the card pill (DB values: one_time / monthly). */
export const DONATION_FREQUENCY_LABELS: Readonly<Record<string, string>> = {
  one_time: 'One-time',
  monthly: 'Monthly',
};

/**
 * Donation status → display label. The past-due flag keeps the portal's
 * existing wording ("Payment pending") and wins over the raw status so a
 * missed recurring payment is never shown as merely "Pending". Unknown
 * future values fall back to raw text instead of blanking out.
 */
export function getDonationStatusLabel(status: string, pastDue?: boolean): string {
  if (pastDue) return 'Payment pending';
  return DONATION_STATUS_LABELS[status] || status;
}

/** Status → StatusBadge variant (single mapping for list + detail). */
export function getDonationStatusVariant(
  status: string,
  pastDue?: boolean,
): 'success' | 'danger' | 'warning' | 'info' | 'neutral' {
  if (pastDue) return 'warning';
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'failed':
      return 'danger';
    case 'pending':
    case 'processing':
      return 'warning';
    case 'cancelled':
    case 'refunded':
    case 'partially_refunded':
      return 'neutral';
    default:
      return 'info';
  }
}

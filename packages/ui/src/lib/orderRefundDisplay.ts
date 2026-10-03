/**
 * Pure order refund display helpers for UI components.
 * packages/ui does not depend on @pawtag/shared (apps do).
 * Keep these pure and local — mirror packages/shared helpers.
 */

export type OrderRefundDisplay =
  | 'none'
  | 'partial'
  | 'full_pending'
  | 'full_succeeded'
  | 'full_failed'
  | 'full_canceled';

export interface OrderRefundDisplayInput {
  status?: string | null;
  refundStatus?: string | null;
  payment?: { status?: string | null } | null;
  items?: Array<{ refundStatus?: string | null; refundedQuantity?: number | null }>;
}

/**
 * Derive refund display from order refund fields.
 * Partial refunds leave order.status as delivered/shipped/paid — use refundStatus + item state.
 */
export function getOrderRefundDisplay(order: OrderRefundDisplayInput): OrderRefundDisplay {
  if (!order) return 'none';

  const status = order.status || '';
  const refundStatus = (order.refundStatus || '').toLowerCase();
  const paymentStatus = (order.payment?.status || '').toLowerCase();
  const items = order.items || [];
  const hasPartialItem = items.some((i) => i?.refundStatus === 'partial');
  const hasAnyItemRefund = items.some(
    (i) => i?.refundStatus === 'partial' || i?.refundStatus === 'refunded' || Number(i?.refundedQuantity || 0) > 0,
  );

  if (status === 'refunded' || paymentStatus === 'refunded') {
    if (refundStatus === 'pending') return 'full_pending';
    if (refundStatus === 'failed') return 'full_failed';
    if (refundStatus === 'canceled' || refundStatus === 'cancelled') return 'full_canceled';
    return 'full_succeeded';
  }

  if (status === 'cancelled' && (refundStatus === 'pending' || refundStatus === 'succeeded' || refundStatus === 'failed')) {
    if (refundStatus === 'failed') return 'full_failed';
    if (refundStatus === 'pending') return 'full_pending';
    return 'full_succeeded';
  }

  if (hasPartialItem) return 'partial';
  if (refundStatus === 'succeeded' || refundStatus === 'pending' || refundStatus === 'failed') {
    if (status && status !== 'refunded' && status !== 'cancelled') {
      return 'partial';
    }
    if (hasAnyItemRefund) return 'partial';
  }
  if (hasAnyItemRefund && status && status !== 'refunded' && status !== 'cancelled') return 'partial';

  return 'none';
}

export function getRefundDisplayLabel(display: OrderRefundDisplay, refundStatus?: string | null): string {
  switch (display) {
    case 'partial':
      return 'Partially refunded';
    case 'full_pending':
      return 'Refund processing';
    case 'full_succeeded':
      return 'Refunded';
    case 'full_failed':
      return 'Refund failed';
    case 'full_canceled':
      return 'Refund canceled';
    default:
      return refundStatus ? `Refund ${refundStatus}` : 'Refunded';
  }
}

export function getRefundDisplayBadgeVariant(
  display: OrderRefundDisplay,
): 'success' | 'danger' | 'warning' | 'info' | 'neutral' {
  switch (display) {
    case 'full_succeeded':
      return 'success';
    case 'full_failed':
      return 'danger';
    case 'full_pending':
    case 'partial':
      return 'warning';
    case 'full_canceled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/** Format card destination label for refund UI (local — no @pawtag/shared). */
export function formatRefundDestinationLocal(
  brand?: string | null,
  last4?: string | null,
): string {
  if (!brand && !last4) return 'Original payment method';
  const formattedBrand = brand
    ? brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase()
    : '';
  if (formattedBrand && last4) return `${formattedBrand} ••••${last4} (original payment method)`;
  if (formattedBrand) return `${formattedBrand} (original payment method)`;
  return `••••${last4} (original payment method)`;
}

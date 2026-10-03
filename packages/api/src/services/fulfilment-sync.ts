/**
 * Fulfilment → Order status synchronization.
 *
 * Fulfilment and Order use different enums:
 *   Fulfilment: pending | picking | packing | fulfilled
 *   Order:      pending | pending_payment | paid | packing | shipped | delivered | ...
 *
 * NEVER compare fulfilment status names with indexOf() against the order
 * status sequence — 'fulfilled' is not an order status and returns -1,
 * which previously made fulfilled look like a backward transition.
 *
 * Always resolve via explicit mapping + order-rank comparison.
 */

import type { FulfilmentStatus, OrderStatus } from '@pawtag/db';

/** Forward transitions: fulfilment progresses → order progresses */
export const FULFILMENT_TO_ORDER_STATUS: Partial<Record<FulfilmentStatus, OrderStatus>> = {
  packing: 'packing',
  fulfilled: 'shipped',
};

/** Backward transitions: fulfilment reverts → order reverts */
export const FULFILMENT_BACKWARD_ORDER_STATUS: Partial<Record<FulfilmentStatus, OrderStatus>> = {
  picking: 'paid',
  packing: 'packing',
};

/** Order lifecycle ranks used only for forward/backward comparison. */
const ORDER_RANK: Record<string, number> = {
  pending: 0,
  pending_payment: 1,
  paid: 2,
  packing: 3,
  shipped: 4,
  delivered: 5,
};

const TERMINAL_ORDER_STATUSES = new Set<OrderStatus>(['cancelled', 'refunded']);

/**
 * Resolve the order status implied by a fulfilment status value.
 *
 * Returns undefined when the order should not change.
 */
export function resolveOrderStatusFromFulfilment(
  fulfilmentStatus: FulfilmentStatus,
  currentOrderStatus?: OrderStatus | string | null,
): OrderStatus | undefined {
  if (!currentOrderStatus) return undefined;
  if (TERMINAL_ORDER_STATUSES.has(currentOrderStatus as OrderStatus)) return undefined;

  const currentRank = ORDER_RANK[currentOrderStatus] ?? -1;
  if (currentRank < 0) return undefined;

  // Forward mapping is authoritative for advancing fulfilment progress.
  const forwardTarget = FULFILMENT_TO_ORDER_STATUS[fulfilmentStatus];
  if (forwardTarget) {
    // fulfilled is the warehouse completion signal — always map to shipped
    // when the order has not already reached shipped/delivered.
    if (
      fulfilmentStatus === 'fulfilled' &&
      currentOrderStatus !== 'shipped' &&
      currentOrderStatus !== 'delivered'
    ) {
      return 'shipped';
    }

    const forwardRank = ORDER_RANK[forwardTarget] ?? -1;
    if (forwardRank > currentRank) return forwardTarget;
    return undefined;
  }

  // Backward mapping only applies when the order is ahead of the mapped status.
  const backwardTarget = FULFILMENT_BACKWARD_ORDER_STATUS[fulfilmentStatus];
  if (backwardTarget) {
    const backwardRank = ORDER_RANK[backwardTarget] ?? -1;
    if (backwardRank < currentRank) return backwardTarget;
  }

  return undefined;
}

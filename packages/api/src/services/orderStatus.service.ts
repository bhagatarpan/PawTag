import { OrderStatus } from '@pawtag/db';

type StatusTransitionMap = Record<OrderStatus, OrderStatus[]>;

const ALLOWED_TRANSITIONS: StatusTransitionMap = {
  pending: ['pending_payment', 'paid', 'cancelled'],
  pending_payment: ['paid', 'cancelled'],
  paid: ['packing', 'cancelled', 'refunded'],
  packing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: ['refunded'],
  refunded: [],
};

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get the list of valid next statuses for a given current status.
 */
export function getValidTransitions(status: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[status] ?? [];
}

/**
 * Get the full transition map (used by the frontend to share logic).
 */
export function getTransitionMap(): StatusTransitionMap {
  return { ...ALLOWED_TRANSITIONS };
}

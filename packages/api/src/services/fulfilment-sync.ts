/**
 * Fulfilment → Order status synchronization mapping.
 *
 * When a fulfilment status changes, the corresponding Order status
 * is updated automatically. These mappings define the relationship.
 */

import type { FulfilmentStatus } from '@pawtag/db';
import type { OrderStatus } from '@pawtag/db';

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

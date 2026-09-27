/**
 * Fulfilment → Order status synchronization mapping.
 *
 * When a fulfilment status changes, the corresponding Order status
 * is updated automatically. This mapping defines the relationship.
 *
 * Only statuses that should trigger an Order update are included.
 * Fulfilment statuses like 'picking' do not map to an Order status.
 */

import type { FulfilmentStatus } from '@pawtag/db';
import type { OrderStatus } from '@pawtag/db';

export const FULFILMENT_TO_ORDER_STATUS: Partial<Record<FulfilmentStatus, OrderStatus>> = {
  packing: 'packing',
  fulfilled: 'shipped',
};

/**
 * @module Inventory Service (Legacy)
 * @description Legacy inventory service retained for backward compatibility.
 *
 * This file contains the `restoreOrderStock` function which was originally
 * used to restore stock when orders were cancelled. It is now a no-op
 * because PawTag Commerce manages inventory directly via the InventoryService
 * in `packages/api/src/commerce/services/inventory.service.ts`.
 *
 * This function is kept to avoid breaking existing admin routes that call it.
 */

import logger from '../lib/logger';

/**
 * Restore stock for cancelled/failed order items.
 *
 * This is a legacy function kept for backward compatibility.
 * PawTag Commerce manages inventory directly via the InventoryService.
 *
 * @deprecated Use inventoryService.release() or inventoryService.adjust() instead
 */
export async function restoreOrderStock(_orderItems: Array<{
  productId: any;
  quantity: number;
  variantName?: string;
}>): Promise<void> {
  logger.info({ itemCount: _orderItems?.length || 0 }, 'restoreOrderStock called (no-op — inventory managed by PawTag Commerce)');
}

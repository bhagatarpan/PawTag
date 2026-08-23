import { auditService, type AuditContext } from './audit';
import logger from '../lib/logger';

/**
 * Restore stock for all items on an order.
 * NOTE: As of the Medusa migration, inventory is managed by Medusa's inventory module.
 * This function is retained for backward compatibility but is a no-op.
 * Stock restoration should be handled by Medusa when orders are cancelled/failed.
 */
export async function restoreOrderStock(orderItems: Array<{
  productId: any;
  quantity: number;
  variantName?: string;
}>): Promise<void> {
  // No-op: Medusa owns inventory. Stock restoration is handled by Medusa's
  // inventory module when orders are cancelled or payments fail.
  logger.info({ itemCount: orderItems.length }, 'restoreOrderStock called (no-op — Medusa owns inventory)');
}

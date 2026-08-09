import { Product } from '@pawtag/db';
import { auditService, type AuditContext } from './audit';

async function auditRestoreStockEvent(
  input: Parameters<typeof auditService.log>[1],
  overrides: Partial<AuditContext> = {},
): Promise<void> {
  try {
    await auditService.log({
      actorType: 'SYSTEM',
      actorId: 'inventoryService',
      actorUsername: 'inventory-restore-service',
      sourceIp: 'system',
      userAgent: 'inventory-service',
      applicationName: 'pawtag-api',
      applicationVersion: '1.0.0',
      apiVersion: 'v1',
      environment: process.env.NODE_ENV || 'development',
      ...overrides,
    }, input);
  } catch (err) {
    console.error('[Audit] Failed to log inventory event:', err);
  }
}

/**
 * Restore stock for all items on an order.
 * Call this when an order is cancelled or payment fails.
 */
export async function restoreOrderStock(orderItems: Array<{
  productId: any;
  quantity: number;
  variantName?: string;
}>): Promise<void> {
  for (const item of orderItems) {
    const product = await Product.findById(item.productId);
    if (product) {
      if (item.variantName && product.variants?.length) {
        const variant = product.variants.find((v: any) => v.name === item.variantName);
        if (variant) variant.stock += item.quantity;
      } else {
        product.stock += item.quantity;
      }
      await product.save();

      await auditRestoreStockEvent({
        action: 'inventory_stock_restored',
        eventType: 'inventory.stock_restored',
        eventCategory: 'FINANCIAL',
        operationType: 'UPDATE',
        resourceType: 'Product',
        resourceId: item.productId?.toString?.() || item.productId,
        outcome: 'SUCCESS',
        severity: 'MEDIUM',
        metadata: {
          productId: item.productId?.toString?.() || item.productId,
          restoredQty: item.quantity,
          variantName: item.variantName || 'default',
        },
      });
    }
  }
}

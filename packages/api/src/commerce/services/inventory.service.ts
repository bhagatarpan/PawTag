/**
 * @module InventoryService
 * @description MongoDB-based inventory management for PawTag Commerce.
 *
 * Handles stock tracking, reservation during checkout, and adjustment.
 * Uses MongoDB atomic operations to prevent overselling race conditions.
 *
 * Two customers must not successfully purchase the last unit.
 * This is achieved via `findOneAndUpdate` with conditional updates.
 *
 * Usage:
 * ```typescript
 * import { inventoryService } from '../commerce/services/inventory.service';
 * const result = await inventoryService.reserve({ productId, quantity: 1, orderId });
 * if (!result.success) { throw new InsufficientStockError(result.error); }
 * ```
 */

import { Product, StockMovement, type IProductDocument } from '@pawtag/db';
import { InsufficientStockError } from '../errors';
import logger from '../../lib/logger';
import type { InventoryStatus, ReservationResult, StockMovement as StockMovementType } from '../interfaces/inventory-provider';

/**
 * Inventory service for PawTag Commerce.
 *
 * All operations use atomic MongoDB operations to prevent race conditions.
 */
export class InventoryService {
  /**
   * Get current inventory status for a product.
   *
   * @param productId - Product ID
   * @returns Inventory status
   */
  async getStatus(productId: string): Promise<InventoryStatus> {
    const product = await Product.findById(productId).lean();
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const onHand = product.stock;
    const reserved = product.reserved;
    const available = Math.max(0, onHand - reserved);
    const threshold = product.lowStockThreshold ?? 10;

    return {
      productId,
      onHand,
      reserved,
      available,
      lowStockThreshold: threshold,
      isLowStock: available <= threshold && available > 0,
      isOutOfStock: available === 0,
      stockPolicy: product.stockPolicy || 'deny',
    };
  }

  /**
   * Get inventory status for multiple products.
   *
   * @param productIds - Array of product IDs
   * @returns Map of product ID to inventory status
   */
  async getStatusBulk(productIds: string[]): Promise<Map<string, InventoryStatus>> {
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const map = new Map<string, InventoryStatus>();

    for (const product of products) {
      const available = Math.max(0, product.stock - product.reserved);
      const threshold = product.lowStockThreshold ?? 10;
      map.set(String(product._id), {
        productId: String(product._id),
        onHand: product.stock,
        reserved: product.reserved,
        available,
        lowStockThreshold: threshold,
        isLowStock: available <= threshold && available > 0,
        isOutOfStock: available === 0,
        stockPolicy: product.stockPolicy || 'deny',
      });
    }

    return map;
  }

  /**
   * Reserve stock for an order during checkout.
   *
   * Uses atomic `findOneAndUpdate` with conditional check to prevent
   * two concurrent reservations from both succeeding on the last unit.
   *
   * @param params - Reservation parameters
   * @returns Reservation result
   */
  async reserve(params: {
    productId: string;
    quantity: number;
    orderId: string;
    ttlMinutes?: number;
  }): Promise<ReservationResult> {
    const { productId, quantity, orderId } = params;

    if (quantity <= 0) {
      return { success: false, error: 'Quantity must be positive' };
    }

    // Atomic reserve: only succeed if enough stock is available
    const result = await Product.findOneAndUpdate(
      {
        _id: productId,
        stockPolicy: { $ne: 'allow' }, // Skip check for backorder products
        $expr: { $gte: [{ $subtract: ['$stock', '$reserved'] }, quantity] },
      },
      {
        $inc: { reserved: quantity },
      },
      { new: true },
    );

    if (!result) {
      // Either product not found or insufficient stock
      const product = await Product.findById(productId).lean();
      const available = product ? Math.max(0, product.stock - product.reserved) : 0;
      logger.warn({ productId, requested: quantity, available }, 'Stock reservation failed');
      return {
        success: false,
        error: `Only ${available} items available`,
      };
    }

    // Record stock movement
    await StockMovement.create({
      productId,
      type: 'reservation',
      quantity: -quantity,
      stockAfter: result.stock - result.reserved,
      referenceId: orderId,
      reason: `Reserved for order ${orderId}`,
      actor: 'system',
    });

    logger.info({ productId, quantity, orderId, available: result.stock - result.reserved }, 'Stock reserved');
    return { success: true, reservationId: `${productId}:${orderId}` };
  }

  /**
   * Release a previously made reservation.
   *
   * Called when checkout fails, expires, or is cancelled.
   *
   * @param reservationId - Reservation ID (format: productId:orderId)
   * @param quantity - Quantity to release (defaults to 1 for backward compatibility)
   */
  async release(reservationId: string, quantity: number = 1): Promise<void> {
    const [productId, orderId] = reservationId.split(':');

    if (quantity <= 0) return;

    const result = await Product.findOneAndUpdate(
      { _id: productId, reserved: { $gte: quantity } },
      { $inc: { reserved: -quantity } },
      { new: true },
    );

    if (result) {
      await StockMovement.create({
        productId,
        type: 'release',
        quantity,
        stockAfter: result.stock - result.reserved,
        referenceId: orderId,
        reason: `Reservation released for order ${orderId}`,
        actor: 'system',
      });

      logger.info({ productId, orderId, quantity, available: result.stock - result.reserved }, 'Stock reservation released');
    }
  }

  /**
   * Release all reservations for an order.
   *
   * @param orderId - Order ID
   * @param items - Order items with product IDs and quantities
   */
  async releaseForOrder(orderId: string, items: Array<{ productId: string; quantity: number }>): Promise<void> {
    for (const item of items) {
      await this.release(`${item.productId}:${orderId}`, item.quantity);
    }
  }

  /**
   * Confirm a reservation (convert to sale).
   *
   * Called when order payment is confirmed. Decrements actual stock
   * and removes the reservation.
   *
   * @param productId - Product ID
   * @param quantity - Quantity sold
   * @param orderId - Order reference
   */
  async confirmSale(productId: string, quantity: number, orderId: string): Promise<void> {
    const result = await Product.findOneAndUpdate(
      { _id: productId, stock: { $gte: quantity }, reserved: { $gte: quantity } },
      {
        $inc: { stock: -quantity, reserved: -quantity },
      },
      { new: true },
    );

    if (result) {
      await StockMovement.create({
        productId,
        type: 'sale',
        quantity: -quantity,
        stockAfter: result.stock - result.reserved,
        referenceId: orderId,
        reason: `Sale confirmed for order ${orderId}`,
        actor: 'system',
      });

      logger.info({ productId, quantity, orderId, stock: result.stock }, 'Sale confirmed');
    }
  }

  /**
   * Adjust stock level manually (admin action).
   *
   * @param params - Adjustment parameters
   */
  async adjust(params: {
    productId: string;
    quantity: number;
    reason: string;
    actor: string;
  }): Promise<void> {
    const { productId, quantity, reason, actor } = params;

    const result = await Product.findOneAndUpdate(
      { _id: productId },
      { $inc: { stock: quantity } },
      { new: true },
    );

    if (result) {
      await StockMovement.create({
        productId,
        type: 'adjustment',
        quantity,
        stockAfter: result.stock,
        reason,
        actor,
      });

      logger.info({ productId, quantity, newStock: result.stock, actor }, 'Stock adjusted');
    }
  }

  /**
   * Get stock movement history for a product.
   *
   * @param productId - Product ID
   * @param limit - Maximum records to return (default 50)
   * @returns Stock movements (most recent first)
   */
  async getMovements(productId: string, limit = 50): Promise<StockMovementType[]> {
    const movements = await StockMovement.find({ productId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return movements.map((m) => ({
      productId: String(m.productId),
      type: m.type as StockMovementType['type'],
      quantity: m.quantity,
      referenceId: m.referenceId,
      reason: m.reason,
      actor: m.actor,
    }));
  }

  /**
   * Check if a product can fulfill the requested quantity.
   *
   * @param productId - Product ID
   * @param quantity - Requested quantity
   * @returns Whether the product can fulfill the request
   */
  async canFulfill(productId: string, quantity: number): Promise<boolean> {
    const status = await this.getStatus(productId);
    if (status.stockPolicy === 'allow') return true;
    return status.available >= quantity;
  }

  /**
   * Reserve stock for multiple items atomically with compensation.
   *
   * If any reservation fails, all previously made reservations for this
   * checkout are released. This prevents partial reservation leaks.
   *
   * @param items - Array of items to reserve
   * @param checkoutId - Stable checkout identifier (PendingOrder ID)
   * @returns Reservation result
   */
  async reserveAll(
    items: Array<{ productId: string; quantity: number }>,
    checkoutId: string,
  ): Promise<{ success: boolean; error?: string; reserved: Array<{ productId: string; quantity: number }> }> {
    const reserved: Array<{ productId: string; quantity: number }> = [];

    try {
      for (const item of items) {
        const result = await this.reserve({
          productId: item.productId,
          quantity: item.quantity,
          orderId: checkoutId,
        });

        if (!result.success) {
          // Compensation: release all previously reserved items
          if (reserved.length > 0) {
            logger.warn({
              checkoutId,
              failedProduct: item.productId,
              reservedCount: reserved.length,
            }, 'Reservation failed — compensating by releasing previously reserved stock');
            await this.releaseForOrder(checkoutId, reserved);
          }
          return { success: false, error: result.error, reserved: [] };
        }

        reserved.push({ productId: item.productId, quantity: item.quantity });
      }

      return { success: true, reserved };
    } catch (err: any) {
      // Unexpected error — compensate by releasing all reserved items
      if (reserved.length > 0) {
        logger.error({ err, checkoutId }, 'Unexpected error during reservation — compensating');
        await this.releaseForOrder(checkoutId, reserved).catch(() => {});
      }
      throw err;
    }
  }
}

/** Singleton instance */
export const inventoryService = new InventoryService();

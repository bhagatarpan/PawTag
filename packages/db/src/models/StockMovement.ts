/**
 * @module StockMovement Model
 * @description MongoDB model for inventory stock movement history.
 *
 * Every stock change (sale, reservation, release, adjustment, return)
 * is recorded here for audit trail and reconciliation.
 *
 * This model supports:
 * - Stock audit trail (who changed what, when, why)
 * - Inventory reconciliation (verify physical vs recorded stock)
 * - Low stock alert context (see recent movements)
 *
 * @example
 * ```typescript
 * await StockMovement.create({
 *   productId: product._id,
 *   type: 'sale',
 *   quantity: -1,
 *   orderId: order._id,
 *   reason: 'Order PT-000001 confirmed',
 *   actor: 'system',
 * });
 * ```
 */

import mongoose, { Schema, Document } from 'mongoose';

export type MovementType = 'adjustment' | 'reservation' | 'release' | 'sale' | 'return';

export interface IStockMovementDocument extends Document {
  /** Product this movement relates to */
  productId: mongoose.Types.ObjectId;

  /** Type of stock movement */
  type: MovementType;

  /** Quantity change (negative = stock decreased, positive = stock increased) */
  quantity: number;

  /** Stock level after this movement */
  stockAfter: number;

  /** Reference to related entity (order ID, reservation ID, etc.) */
  referenceId?: string;

  /** Human-readable reason for the movement */
  reason: string;

  /** Who or what initiated the movement */
  actor: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;

  createdAt: Date;
}

const StockMovementSchema = new Schema<IStockMovementDocument>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    type: { type: String, enum: ['adjustment', 'reservation', 'release', 'sale', 'return'], required: true, index: true },
    quantity: { type: Number, required: true },
    stockAfter: { type: Number, required: true },
    referenceId: { type: String, index: true },
    reason: { type: String, required: true },
    actor: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

StockMovementSchema.index({ productId: 1, createdAt: -1 });
StockMovementSchema.index({ referenceId: 1 });

export const StockMovement = mongoose.model<IStockMovementDocument>('StockMovement', StockMovementSchema);

/**
 * @module InventoryProvider
 * @description Interface for inventory management in PawTag Commerce.
 *
 * PawTag sells physical QR/NFC tags. Inventory must be tracked to prevent
 * overselling and to support low-stock alerts.
 *
 * Design principle: PawTag owns inventory business rules (stock policies,
 * reservation logic, low-stock thresholds). The provider handles storage
 * and queries.
 *
 * For PawTag's current needs, a simple MongoDB-based inventory is sufficient.
 * This interface exists to support future integration with warehouse systems.
 */

/**
 * Current inventory status for a product/variant.
 */
export interface InventoryStatus {
  /** Product or variant identifier */
  productId: string;

  /** Total quantity on hand */
  onHand: number;

  /** Quantity reserved by pending orders */
  reserved: number;

  /** Available quantity (onHand - reserved) */
  available: number;

  /** Low stock threshold */
  lowStockThreshold: number;

  /** Whether stock is below threshold */
  isLowStock: boolean;

  /** Whether stock is zero */
  isOutOfStock: boolean;

  /** Stock policy: 'deny' prevents checkout when out of stock, 'allow' permits backorders */
  stockPolicy: 'deny' | 'allow';
}

/**
 * Result of a stock reservation attempt.
 */
export interface ReservationResult {
  /** Whether the reservation was successful */
  success: boolean;

  /** Reservation ID (for later release or confirmation) */
  reservationId?: string;

  /** Error message if reservation failed */
  error?: string;
}

/**
 * Stock movement record for audit trail.
 */
export interface StockMovement {
  /** Product identifier */
  productId: string;

  /** Movement type */
  type: 'adjustment' | 'reservation' | 'release' | 'sale' | 'return';

  /** Quantity change (positive for additions, negative for deductions) */
  quantity: number;

  /** Reference to related entity (order ID, reservation ID, etc.) */
  referenceId?: string;

  /** Reason for the movement */
  reason: string;

  /** User or system that initiated the movement */
  actor: string;
}

/**
 * Inventory provider interface.
 *
 * Implementations must handle concurrency correctly.
 * Two customers must not successfully purchase the last unit.
 */
export interface IInventoryProvider {
  /** Unique identifier (e.g., 'mongodb-inventory') */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /**
   * Get current inventory status for a product.
   *
   * @param productId - Product identifier
   * @returns Current inventory status
   */
  getStatus(productId: string): Promise<InventoryStatus>;

  /**
   * Get inventory status for multiple products.
   *
   * @param productIds - Array of product identifiers
   * @returns Map of product ID to inventory status
   */
  getStatusBulk(productIds: string[]): Promise<Map<string, InventoryStatus>>;

  /**
   * Reserve stock for an order during checkout.
   *
   * This prevents overselling by reducing available stock temporarily.
   * The reservation must be released if checkout fails or expires.
   *
   * @param params - Reservation parameters
   * @returns Reservation result
   */
  reserve(params: {
    productId: string;
    quantity: number;
    orderId: string;
    ttlMinutes?: number;
  }): Promise<ReservationResult>;

  /**
   * Release a previously made reservation.
   *
   * @param reservationId - Reservation to release
   */
  release(reservationId: string): Promise<void>;

  /**
   * Confirm a reservation (convert to sale).
   * Called when order is confirmed as paid.
   *
   * @param reservationId - Reservation to confirm
   */
  confirm(reservationId: string): Promise<void>;

  /**
   * Adjust stock level manually (admin action).
   *
   * @param params - Adjustment parameters
   */
  adjust(params: {
    productId: string;
    quantity: number;
    reason: string;
    actor: string;
  }): Promise<void>;

  /**
   * Get stock movement history for a product.
   *
   * @param productId - Product identifier
   * @param limit - Maximum number of records to return
   * @returns Stock movements (most recent first)
   */
  getMovements(productId: string, limit?: number): Promise<StockMovement[]>;

  /**
   * Check if the provider is configured and healthy.
   */
  isConfigured(): boolean;
}

/**
 * @module ShippingProvider
 * @description Interface for shipping provider adapters in PawTag Commerce.
 *
 * PawTag ships physical QR/NFC tags within New Zealand.
 * The shipping system is intentionally simple — free NZ-wide shipping
 * with optional flat-rate or weight-based rules.
 *
 * Design principle: PawTag owns shipping business rules (free shipping thresholds,
 * zone restrictions). The provider handles rate calculation and label generation.
 */

/**
 * Represents a shipping address.
 */
export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
}

/**
 * A shipping rate option presented to the customer at checkout.
 */
export interface ShippingRate {
  /** Unique rate identifier */
  id: string;

  /** Display name (e.g., 'Standard NZ Shipping') */
  name: string;

  /** Human-readable description */
  description?: string;

  /** Shipping cost in major units (0 for free shipping) */
  cost: number;

  /** Estimated delivery time (e.g., '3-5 business days') */
  estimatedDays?: string;

  /** Carrier name (e.g., 'NZ Post', 'CourierPost') */
  carrier?: string;
}

/**
 * Result of creating a shipment.
 */
export interface ShipmentResult {
  /** Whether the shipment was created successfully */
  success: boolean;

  /** Tracking number assigned by the carrier */
  trackingNumber?: string;

  /** Carrier name */
  carrier?: string;

  /** Tracking URL for the customer */
  trackingUrl?: string;

  /** Label URL if label was generated */
  labelUrl?: string;

  /** Error message if creation failed */
  error?: string;
}

/**
 * Tracking event from a carrier.
 */
export interface TrackingEvent {
  /** Event timestamp */
  timestamp: Date;

  /** Event status (e.g., 'in_transit', 'delivered') */
  status: string;

  /** Human-readable event description */
  description: string;

  /** Location where event occurred (if available) */
  location?: string;
}

/**
 * Shipping provider interface.
 *
 * Implementations must be stateless. Provider credentials come from
 * CMS settings via the commerce config service.
 */
export interface IShippingProvider {
  /** Unique identifier for this provider (e.g., 'nz-post', 'flat-rate') */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /**
   * Calculate available shipping rates for an order.
   *
   * @param params - Calculation parameters
   * @returns Available shipping rates (sorted by cost ascending)
   */
  getRates(params: {
    address: ShippingAddress;
    items: Array<{ weight?: number; quantity: number }>;
    subtotal: number;
  }): Promise<ShippingRate[]>;

  /**
   * Create a shipment and generate a tracking number.
   *
   * @param params - Shipment parameters
   * @returns Shipment result with tracking info
   */
  createShipment(params: {
    orderId: string;
    orderNumber: string;
    address: ShippingAddress;
    items: Array<{ name: string; quantity: number; weight?: number }>;
    rateId?: string;
  }): Promise<ShipmentResult>;

  /**
   * Retrieve tracking events for a shipment.
   *
   * @param trackingNumber - Carrier tracking number
   * @returns List of tracking events (most recent first)
   */
  getTrackingEvents(trackingNumber: string): Promise<TrackingEvent[]>;

  /**
   * Check if the provider is configured and healthy.
   */
  isConfigured(): boolean;
}

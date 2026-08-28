/**
 * @module Commerce Interfaces
 * @description Central export for all PawTag Commerce provider interfaces.
 *
 * These interfaces define the contract between PawTag's business logic
 * and external provider implementations. All providers must implement
 * the corresponding interface.
 *
 * Usage:
 * ```typescript
 * import type { IPaymentProvider, IShippingProvider } from '../commerce/interfaces';
 * ```
 */

export type { IPaymentProvider, PaymentIntent, PaymentIntentStatus, RefundResult, PaymentWebhookEvent } from './payment-provider';
export type { IShippingProvider, ShippingAddress, ShippingRate, ShipmentResult, TrackingEvent } from './shipping-provider';
export type { ITaxProvider, TaxCalculationResult, LineItemTax } from './tax-provider';
export type { IInventoryProvider, InventoryStatus, ReservationResult, StockMovement } from './inventory-provider';

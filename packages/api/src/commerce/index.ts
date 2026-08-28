/**
 * @module Commerce Module
 * @description Central export for the PawTag Commerce module.
 *
 * This module provides the core commerce infrastructure for PawTag:
 * - Provider interfaces (Payment, Shipping, Tax, Inventory)
 * - Configuration service (CMS-driven settings)
 * - Commerce-specific error types
 * - Commerce audit logging helpers
 *
 * Usage:
 * ```typescript
 * import { getSetting, PaymentFailedError, logPaymentEvent } from '../commerce';
 * ```
 */

// ─── Provider Interfaces ───────────────────────────────────────
export type {
  IPaymentProvider,
  PaymentIntent,
  PaymentIntentStatus,
  RefundResult,
  PaymentWebhookEvent,
} from './interfaces/payment-provider';

export type {
  IShippingProvider,
  ShippingAddress,
  ShippingRate,
  ShipmentResult,
  TrackingEvent,
} from './interfaces/shipping-provider';

export type {
  ITaxProvider,
  TaxCalculationResult,
  LineItemTax,
} from './interfaces/tax-provider';

export type {
  IInventoryProvider,
  InventoryStatus,
  ReservationResult,
  StockMovement,
} from './interfaces/inventory-provider';

// ─── Configuration ─────────────────────────────────────────────
export {
  COMMERCE_SETTINGS,
  getSetting,
  getNumberSetting,
  getBooleanSetting,
  updateSetting,
  getAllSettings,
  clearCache,
} from './config';

export type { CommerceSettingKey } from './config';

// ─── Errors ────────────────────────────────────────────────────
export {
  PaymentFailedError,
  PaymentSignatureError,
  InsufficientStockError,
  ProductUnavailableError,
  PriceMismatchError,
  DuplicateOrderError,
  CheckoutExpiredError,
  InvalidCartError,
  ShippingError,
  RefundError,
  TaxError,
} from './errors';

// ─── Audit ─────────────────────────────────────────────────────
export {
  logCommerceEvent,
  logPaymentEvent,
  logOrderEvent,
  logRefundEvent,
} from './audit';

export type { CommerceAuditCategory, CommerceAuditInput } from './audit';

/**
 * @module Commerce Services
 * @description Central export for PawTag Commerce services.
 *
 * Usage:
 * ```typescript
 * import { productService, inventoryService, pricingService, cartService } from '../commerce/services';
 * ```
 */

export { ProductService, productService } from './product.service';
export type { ProductFilter, PaginationOptions, PaginatedResult } from './product.service';

export { InventoryService, inventoryService } from './inventory.service';

export { PricingService, pricingService } from './pricing.service';
export type { PricingLineItem, LineItemPricing, PricingResult } from './pricing.service';

export { CartService, cartService } from './cart.service';
export type { AddToCartInput, UpdateCartItemInput, CartTotals } from './cart.service';

export { CheckoutService, checkoutService } from './checkout.service';
export type { CheckoutPaymentIntent, CheckoutResult } from './checkout.service';

export { ShippingService, shippingService } from './shipping.service';

export { ShipmentService, shipmentService } from './shipment.service';
export type { CreateShipmentParams, ShipmentWithTracking } from './shipment.service';

export { RefundService, refundService } from './refund.service';

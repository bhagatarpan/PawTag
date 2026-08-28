/**
 * @module Commerce Errors
 * @description Commerce-specific error types for PawTag Commerce.
 *
 * These errors extend the base AppError for consistent handling.
 * Each error maps to a specific commerce failure scenario.
 *
 * Usage:
 * ```typescript
 * throw new PaymentFailedError('Stripe rejected the card', { paymentIntentId: 'pi_xxx' });
 * throw new InsufficientStockError('Only 2 items available', { productId: 'xxx', requested: 5, available: 2 });
 * ```
 */

import { AppError, type ErrorMetadata } from '../lib/app-errors';

/**
 * Payment processing failed at the provider.
 */
export class PaymentFailedError extends AppError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message, {
      code: 'EXTERNAL_SERVICE_ERROR',
      httpStatus: 402,
      userMessage: 'Payment processing failed. Please try again or use a different payment method.',
      metadata: { ...metadata, commerceError: true, errorType: 'payment_failed' },
    });
    this.name = 'PaymentFailedError';
  }
}

/**
 * Payment signature verification failed (possible tampering).
 */
export class PaymentSignatureError extends AppError {
  constructor(message = 'Invalid payment webhook signature', metadata?: ErrorMetadata) {
    super(message, {
      code: 'AUTHENTICATION_ERROR',
      httpStatus: 401,
      isOperational: false,
      severity: 'HIGH',
      userMessage: 'Payment verification failed',
      metadata: { ...metadata, commerceError: true, errorType: 'payment_signature' },
    });
    this.name = 'PaymentSignatureError';
  }
}

/**
 * Insufficient stock for the requested quantity.
 */
export class InsufficientStockError extends AppError {
  public readonly requested: number;
  public readonly available: number;

  constructor(message: string, metadata?: ErrorMetadata & { requested?: number; available?: number }) {
    super(message, {
      code: 'BUSINESS_RULE_ERROR',
      httpStatus: 409,
      userMessage: `Sorry, only ${metadata?.available ?? 0} items available. Please reduce your quantity.`,
      metadata: { ...metadata, commerceError: true, errorType: 'insufficient_stock' },
    });
    this.name = 'InsufficientStockError';
    this.requested = metadata?.requested ?? 0;
    this.available = metadata?.available ?? 0;
  }
}

/**
 * Product is no longer available or has been deactivated.
 */
export class ProductUnavailableError extends AppError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message, {
      code: 'BUSINESS_RULE_ERROR',
      httpStatus: 410,
      userMessage: 'This product is no longer available',
      metadata: { ...metadata, commerceError: true, errorType: 'product_unavailable' },
    });
    this.name = 'ProductUnavailableError';
  }
}

/**
 * Price mismatch between client and server (possible tampering).
 */
export class PriceMismatchError extends AppError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message, {
      code: 'BUSINESS_RULE_ERROR',
      httpStatus: 422,
      isOperational: false,
      severity: 'HIGH',
      userMessage: 'The price has changed. Please refresh and try again.',
      metadata: { ...metadata, commerceError: true, errorType: 'price_mismatch' },
    });
    this.name = 'PriceMismatchError';
  }
}

/**
 * Duplicate order creation attempt (idempotency).
 */
export class DuplicateOrderError extends AppError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message, {
      code: 'CONFLICT_ERROR',
      httpStatus: 409,
      userMessage: 'This order has already been created',
      metadata: { ...metadata, commerceError: true, errorType: 'duplicate_order' },
    });
    this.name = 'DuplicateOrderError';
  }
}

/**
 * Checkout session has expired.
 */
export class CheckoutExpiredError extends AppError {
  constructor(message = 'Checkout session has expired', metadata?: ErrorMetadata) {
    super(message, {
      code: 'BUSINESS_RULE_ERROR',
      httpStatus: 410,
      userMessage: 'Your checkout session has expired. Please start again.',
      metadata: { ...metadata, commerceError: true, errorType: 'checkout_expired' },
    });
    this.name = 'CheckoutExpiredError';
  }
}

/**
 * Cart is empty or invalid for checkout.
 */
export class InvalidCartError extends AppError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message, {
      code: 'VALIDATION_ERROR',
      httpStatus: 400,
      userMessage: message,
      metadata: { ...metadata, commerceError: true, errorType: 'invalid_cart' },
    });
    this.name = 'InvalidCartError';
  }
}

/**
 * Shipping calculation failed.
 */
export class ShippingError extends AppError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message, {
      code: 'EXTERNAL_SERVICE_ERROR',
      httpStatus: 502,
      userMessage: 'Shipping calculation failed. Please try again.',
      metadata: { ...metadata, commerceError: true, errorType: 'shipping' },
    });
    this.name = 'ShippingError';
  }
}

/**
 * Refund processing failed.
 */
export class RefundError extends AppError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message, {
      code: 'EXTERNAL_SERVICE_ERROR',
      httpStatus: 502,
      userMessage: 'Refund processing failed. Please try again or contact support.',
      metadata: { ...metadata, commerceError: true, errorType: 'refund' },
    });
    this.name = 'RefundError';
  }
}

/**
 * Tax calculation failed.
 */
export class TaxError extends AppError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(message, {
      code: 'EXTERNAL_SERVICE_ERROR',
      httpStatus: 500,
      userMessage: 'Tax calculation failed. Please try again.',
      metadata: { ...metadata, commerceError: true, errorType: 'tax' },
    });
    this.name = 'TaxError';
  }
}

/**
 * @module PricingService
 * @description Server-side pricing calculations for PawTag Commerce.
 *
 * All pricing logic is centralised here. Frontend prices are NEVER trusted.
 * The server recalculates all totals from product data before creating orders.
 *
 * Pricing model:
 * - Products have a base price and optional salePrice
 * - compareAtPrice is display-only (for "was $XX" UI)
 * - Tax is calculated separately by the tax provider
 * - Shipping is calculated separately by the shipping provider
 * - Discounts are applied as percentage or fixed amount
 *
 * Usage:
 * ```typescript
 * import { pricingService } from '../commerce/services/pricing.service';
 * const total = await pricingService.calculateCartTotal(cartItems);
 * ```
 */

import { Product, type IProductDocument } from '@pawtag/db';
import { PriceMismatchError, InvalidCartError } from '../errors';
import { getNumberSetting, getBooleanSetting } from '../config';
import logger from '../../lib/logger';

/**
 * A line item in a cart or order for pricing calculation.
 */
export interface PricingLineItem {
  /** Product ID */
  productId: string;

  /** Quantity */
  quantity: number;

  /** Whether customisation is applied */
  customisation?: boolean;

  /** Price override (only for display, NOT for calculation) */
  displayPrice?: number;
}

/**
 * Pricing result for a single line item.
 */
export interface LineItemPricing {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  customisationTotal: number;
  lineTotal: number;
  isOnSale: boolean;
  compareAtPrice?: number;
}

/**
 * Complete pricing calculation result.
 */
export interface PricingResult {
  items: LineItemPricing[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
}

/**
 * Pricing service for PawTag Commerce.
 *
 * All calculations are server-side and use product data from the database.
 */
export class PricingService {
  /**
   * Calculate the effective price for a product.
   *
   * @param product - Product document
   * @returns Effective price (salePrice if set, otherwise price)
   */
  getEffectivePrice(product: IProductDocument): number {
    return product.salePrice ?? product.price;
  }

  /**
   * Calculate the effective price for a variant.
   *
   * @param product - Product document
   * @param variantIndex - Index of the variant
   * @returns Effective price
   */
  getVariantPrice(product: IProductDocument, variantIndex: number): number {
    const variant = product.variants?.[variantIndex];
    if (!variant) return this.getEffectivePrice(product);
    return variant.salePrice ?? variant.price ?? this.getEffectivePrice(product);
  }

  /**
   * Calculate line item pricing for a cart.
   *
   * Fetches product data from database and calculates prices server-side.
   * Never uses client-submitted prices.
   *
   * @param items - Cart items with product IDs and quantities
   * @returns Line item pricing details
   */
  async calculateLineItems(items: PricingLineItem[]): Promise<LineItemPricing[]> {
    if (!items.length) return [];

    // Fetch all products in one query
    const productIds = items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const results: LineItemPricing[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        logger.warn({ productId: item.productId }, 'Product not found during pricing');
        continue;
      }

      const unitPrice = this.getEffectivePrice(product);
      const customisationTotal = item.customisation ? product.customizationPrice : 0;
      const lineTotal = (unitPrice + customisationTotal) * item.quantity;

      results.push({
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        unitPrice,
        customisationTotal,
        lineTotal,
        isOnSale: product.salePrice != null && product.salePrice < product.price,
        compareAtPrice: product.compareAtPrice,
      });
    }

    return results;
  }

  /**
   * Calculate a discount amount.
   *
   * @param subtotal - Subtotal before discount
   * @param discount - Discount configuration
   * @returns Discount amount (capped at subtotal)
   */
  calculateDiscount(
    subtotal: number,
    discount: { type: 'percentage' | 'fixed'; value: number },
  ): number {
    if (discount.type === 'percentage') {
      const amount = subtotal * (discount.value / 100);
      return Math.min(amount, subtotal);
    }
    return Math.min(discount.value, subtotal);
  }

  /**
   * Validate that client-submitted prices match server prices.
   *
   * Call this before order creation to prevent price tampering.
   *
   * @param items - Cart items with client-submitted prices
   * @throws PriceMismatchError if prices don't match
   */
  async validatePrices(items: Array<{ productId: string; quantity: number; submittedPrice: number }>): Promise<void> {
    const productIds = items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new PriceMismatchError(`Product ${item.productId} not found`);
      }

      const serverPrice = this.getEffectivePrice(product);
      const tolerance = 0.01; // 1 cent tolerance for floating point
      if (Math.abs(serverPrice - item.submittedPrice) > tolerance) {
        logger.warn({
          productId: item.productId,
          clientPrice: item.submittedPrice,
          serverPrice,
        }, 'Price mismatch detected');
        throw new PriceMismatchError(
          `Price for ${product.name} has changed. Expected $${serverPrice.toFixed(2)}, got $${item.submittedPrice.toFixed(2)}`,
        );
      }
    }
  }

  /**
   * Bundle discount calculation for multiple subscription items.
   *
   * Reads discount percentages from CMS settings.
   *
   * @param itemCount - Number of subscription items
   * @returns Discount percentage (0 if no discount applies)
   */
  async getBundleDiscount(itemCount: number): Promise<number> {
    if (itemCount < 2) return 0;

    // Read bundle discount percentages from CMS settings
    const bundle2Discount = await getNumberSetting('commerce.promotions.bundle2Items');
    const bundle3Discount = await getNumberSetting('commerce.promotions.bundle3PlusItems');

    if (itemCount >= 3) return bundle3Discount;
    if (itemCount >= 2) return bundle2Discount;
    return 0;
  }
}

/** Singleton instance */
export const pricingService = new PricingService();

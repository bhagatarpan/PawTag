/**
 * @module CartService
 * @description PawTag-native shopping cart service.
 *
 * PawTag-native shopping cart.
 * All price calculations are server-side — never trust client-submitted prices.
 *
 * Features:
 * - Add/remove/update items
 * - Server-side price validation
 * - Cart totals calculation (items + shipping + tax - discount)
 * - Promo code application
 * - Cart expiry/cleanup
 * - Cart merging after login (future)
 *
 * Usage:
 * ```typescript
 * import { cartService } from '../commerce/services/cart.service';
 * const cart = await cartService.getOrCreate(userId);
 * await cartService.addItem(userId, { productId, quantity: 1 });
 * ```
 */

import { Cart, Product, PromoCode, type ICartDocument } from '@pawtag/db';
import { NotFoundError } from '../../lib/app-errors';
import { InvalidCartError, InsufficientStockError, ProductUnavailableError } from '../errors';
import { pricingService } from './pricing.service';
import { inventoryService } from './inventory.service';
import { nzGstProvider } from '../providers/simple-gst';
import { getNumberSetting, getBooleanSetting } from '../config';
import logger from '../../lib/logger';

/** Cart abandonment threshold (30 minutes) */
const ABANDONMENT_THRESHOLD_MS = 30 * 60 * 1000;

/**
 * Input for adding an item to the cart.
 */
export interface AddToCartInput {
  productId: string;
  quantity: number;
  customisation?: boolean;
  variantName?: string;
}

/**
 * Input for updating a cart item.
 */
export interface UpdateCartItemInput {
  itemId: string;
  quantity: number;
}

/**
 * Cart totals calculation result.
 */
export interface CartTotals {
  items: Array<{
    itemId: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    customisationTotal: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
}

/**
 * Cart service for PawTag Commerce.
 */
export class CartService {
  /**
   * Get or create a cart for a user.
   *
   * @param userId - User ID
   * @returns Active cart
   */
  async getOrCreate(userId: string): Promise<ICartDocument> {
    let cart = await Cart.findOne({ userId, status: 'active' });

    if (!cart) {
      const ttlDays = await getNumberSetting('commerce.cart.ttlDays');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + ttlDays);

      cart = await Cart.create({
        userId,
        items: [],
        status: 'active',
        expiresAt,
        lastAccessedAt: new Date(),
      });
      logger.info({ userId, cartId: cart._id }, 'Cart created');
    } else {
      // Update last accessed time
      cart.lastAccessedAt = new Date();
      await cart.save();
    }

    return cart;
  }

  /**
   * Add an item to the cart.
   *
   * Validates product availability and price server-side.
   * If item already exists, increments quantity.
   *
   * @param userId - User ID
   * @param input - Item to add
   * @returns Updated cart
   */
  async addItem(userId: string, input: AddToCartInput): Promise<ICartDocument> {
    const cart = await this.getOrCreate(userId);

    // Fetch product from database (server-side price validation)
    const product = await Product.findById(input.productId);
    if (!product) {
      throw new NotFoundError('Product');
    }
    if (!product.isActive) {
      throw new ProductUnavailableError(`${product.name} is no longer available`);
    }

    // Normalise customisation for consistent comparison
    const inputCust = input.customisation === true;

    // Check if item already exists in cart
    const existingItem = cart.items.find(
      (item) => String(item.productId) === input.productId && (item.customisation === true) === inputCust,
    );

    // Check max cart items limit (only for new items)
    if (!existingItem) {
      const maxItems = await getNumberSetting('commerce.cart.maxItems');
      if (cart.items.length >= maxItems) {
        throw new InvalidCartError(`Cart is full. Maximum ${maxItems} unique items allowed.`);
      }
    }

    // Check stock availability
    const canFulfill = await inventoryService.canFulfill(input.productId, input.quantity);
    if (!canFulfill && product.stockPolicy === 'deny') {
      throw new InsufficientStockError(
        `Only ${product.stock - product.reserved} units of ${product.name} available`,
        {
          productId: input.productId,
          requested: input.quantity,
          available: product.stock - product.reserved,
        },
      );
    }

    if (existingItem) {
      // Increment quantity
      existingItem.quantity += input.quantity;
      existingItem.unitPrice = product.salePrice ?? product.price;
      existingItem.customizationTotal = input.customisation ? product.customizationPrice : 0;
    } else {
      // Add new item
      cart.items.push({
        productId: product._id,
        productName: product.name,
        variantName: input.variantName,
        sku: product.sku,
        unitPrice: product.salePrice ?? product.price,
        customizationTotal: input.customisation ? product.customizationPrice : 0,
        quantity: input.quantity,
        image: product.images?.[0],
        customisation: input.customisation ?? false,
        addedAt: new Date(),
      });
    }

    cart.lastAccessedAt = new Date();
    await cart.save();

    logger.info({ userId, productId: input.productId, quantity: input.quantity }, 'Item added to cart');
    return cart;
  }

  /**
   * Update an item's quantity in the cart.
   *
   * @param userId - User ID
   * @param input - Update details
   * @returns Updated cart
   */
  async updateItem(userId: string, input: UpdateCartItemInput): Promise<ICartDocument> {
    const cart = await this.getOrCreate(userId);

    const item = cart.items.id(input.itemId);
    if (!item) {
      throw new NotFoundError('Cart item');
    }

    if (input.quantity <= 0) {
      // Remove item if quantity is 0 or negative
      cart.items.pull(item);
    } else {
      // Validate stock
      const canFulfill = await inventoryService.canFulfill(String(item.productId), input.quantity);
      if (!canFulfill) {
        const product = await Product.findById(item.productId);
        throw new InsufficientStockError(
          `Only ${product ? product.stock - product.reserved : 0} units available`,
          { productId: String(item.productId), requested: input.quantity, available: product ? product.stock - product.reserved : 0 },
        );
      }
      item.quantity = input.quantity;
    }

    cart.lastAccessedAt = new Date();
    await cart.save();
    return cart;
  }

  /**
   * Remove an item from the cart.
   *
   * @param userId - User ID
   * @param itemId - Cart item ID
   * @returns Updated cart
   */
  async removeItem(userId: string, itemId: string): Promise<ICartDocument> {
    const cart = await this.getOrCreate(userId);

    const item = cart.items.id(itemId);
    if (!item) {
      throw new NotFoundError('Cart item');
    }

    cart.items.pull(item);
    cart.lastAccessedAt = new Date();
    await cart.save();

    return cart;
  }

  /**
   * Clear all items from the cart.
   *
   * @param userId - User ID
   * @returns Empty cart
   */
  async clearCart(userId: string): Promise<ICartDocument> {
    const cart = await this.getOrCreate(userId);
    cart.items = [] as any;
    cart.promoCode = undefined;
    cart.promoDiscount = undefined;
    cart.shippingMethodId = undefined;
    cart.shippingMethodName = undefined;
    cart.shippingCost = 0;
    cart.lastAccessedAt = new Date();
    await cart.save();
    return cart;
  }

  /**
   * Apply a promo code to the cart.
   *
   * @param userId - User ID
   * @param code - Promo code
   * @returns Updated cart with discount applied
   */
  async applyPromoCode(userId: string, code: string): Promise<ICartDocument> {
    const cart = await this.getOrCreate(userId);

    // Validate promo code against database
    const promoCode = await PromoCode.findOne({ code: code.toUpperCase(), isActive: true }) as any;
    if (!promoCode) {
      throw new InvalidCartError('Promo code is invalid, either old or expired');
    }

    if (!promoCode.isValid()) {
      throw new InvalidCartError('Promo code is expired or has reached its usage limit');
    }

    // Calculate subtotal for discount calculation
    const subtotal = cart.items.reduce(
      (sum, item) => sum + (item.unitPrice + item.customizationTotal) * item.quantity,
      0,
    );

    // Check minimum order amount
    if (promoCode.minOrderAmount && subtotal < promoCode.minOrderAmount) {
      throw new InvalidCartError(`Minimum order amount of $${promoCode.minOrderAmount} required`);
    }

    // Calculate discount
    const discount = promoCode.calculateDiscount(subtotal);

    cart.promoCode = code.toUpperCase();
    cart.promoDiscount = discount;
    cart.lastAccessedAt = new Date();
    await cart.save();

    // Increment usage count (fire-and-forget)
    PromoCode.updateOne({ _id: promoCode._id }, { $inc: { usageCount: 1 } }).catch(() => {});

    return cart;
  }

  /**
   * Remove promo code from cart.
   *
   * @param userId - User ID
   * @returns Updated cart
   */
  async removePromoCode(userId: string): Promise<ICartDocument> {
    const cart = await this.getOrCreate(userId);
    cart.promoCode = undefined;
    cart.promoDiscount = undefined;
    cart.lastAccessedAt = new Date();
    await cart.save();
    return cart;
  }

  /**
   * Set shipping method on cart.
   *
   * @param userId - User ID
   * @param methodId - Shipping method ID
   * @param methodName - Display name
   * @param cost - Shipping cost
   * @returns Updated cart
   */
  async setShipping(userId: string, methodId: string, methodName: string, cost: number): Promise<ICartDocument> {
    const cart = await this.getOrCreate(userId);
    cart.shippingMethodId = methodId;
    cart.shippingMethodName = methodName;
    cart.shippingCost = cost;
    cart.lastAccessedAt = new Date();
    await cart.save();
    return cart;
  }

  /**
   * Calculate cart totals (server-side).
   *
   * Fetches current product prices from database.
   * Never uses stored prices for calculation — always validates.
   *
   * @param userId - User ID
   * @returns Calculated totals
   */
  async calculateTotals(userId: string): Promise<CartTotals> {
    const cart = await this.getOrCreate(userId);

    if (!cart.items.length) {
      return {
        items: [],
        subtotal: 0,
        discount: 0,
        shipping: 0,
        tax: 0,
        total: 0,
        currency: 'NZD',
      };
    }

    // Fetch current prices from database (never trust stored prices)
    const productIds = cart.items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const items = cart.items.map((item) => {
      const product = productMap.get(String(item.productId));
      const currentPrice = product ? (product.salePrice ?? product.price) : item.unitPrice;

      // Update stored price if product price changed
      if (product && item.unitPrice !== currentPrice) {
        item.unitPrice = currentPrice;
        item.customizationTotal = item.customisation ? (product.customizationPrice || 0) : 0;
      }

      return {
        itemId: String(item._id),
        productId: String(item.productId),
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        customisationTotal: item.customizationTotal,
        lineTotal: (item.unitPrice + item.customizationTotal) * item.quantity,
      };
    });

    // Persist any price updates
    await cart.save();

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const discount = cart.promoDiscount ?? 0;
    const shipping = cart.shippingCost ?? 0;

    // Use tax provider for accurate tax calculation
    const taxRate = await nzGstProvider.getRate();
    const taxInclusive = await nzGstProvider.isInclusive();

    // If tax-inclusive, extract tax from the price (tax is already included)
    // If tax-exclusive, add tax on top
    let tax: number;
    if (taxInclusive) {
      // Tax is included in the price — extract the tax component
      tax = (subtotal - discount + shipping) * (taxRate / (1 + taxRate));
    } else {
      // Tax is added on top of the price
      tax = (subtotal - discount + shipping) * taxRate;
    }
    const total = subtotal - discount + shipping + (taxInclusive ? 0 : tax);

    return {
      items,
      subtotal,
      discount,
      shipping,
      tax,
      total,
      currency: 'NZD',
    };
  }

  /**
   * Mark cart as converted (after order is placed).
   *
   * @param userId - User ID
   */
  async markConverted(userId: string): Promise<void> {
    await Cart.findOneAndUpdate(
      { userId, status: 'active' },
      { status: 'converted' },
    );
  }

  /**
   * Delete a cart.
   *
   * @param userId - User ID
   */
  async deleteCart(userId: string): Promise<void> {
    await Cart.deleteOne({ userId });
  }
}

/** Singleton instance */
export const cartService = new CartService();

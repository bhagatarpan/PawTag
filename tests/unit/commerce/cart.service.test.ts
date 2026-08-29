/**
 * @module CartService Tests
 * @description Unit tests for the PawTag Commerce cart service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database models
vi.mock('@pawtag/db', () => ({
  Cart: {
    findOne: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
  },
  Product: {
    findById: vi.fn(),
  },
  PromoCode: {
    findOne: vi.fn(),
  },
}));

// Mock inventory service
vi.mock('../../../packages/api/src/commerce/services/inventory.service', () => ({
  inventoryService: {
    canFulfill: vi.fn().mockResolvedValue(true),
  },
}));

// Mock tax provider
vi.mock('../../../packages/api/src/commerce/providers/simple-gst', () => ({
  nzGstProvider: {
    getRate: vi.fn().mockResolvedValue(0.15),
    isInclusive: vi.fn().mockResolvedValue(true),
  },
}));

// Mock config
vi.mock('../../../packages/api/src/commerce/config', () => ({
  getNumberSetting: vi.fn().mockResolvedValue(0),
  getBooleanSetting: vi.fn().mockResolvedValue(true),
}));

// Mock logger
vi.mock('../../../packages/api/src/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock errors
vi.mock('../../../packages/api/src/commerce/errors', () => ({
  InvalidCartError: class extends Error { constructor(msg: string) { super(msg); this.name = 'InvalidCartError'; } },
  InsufficientStockError: class extends Error { constructor(msg: string) { super(msg); this.name = 'InsufficientStockError'; } },
  ProductUnavailableError: class extends Error { constructor(msg: string) { super(msg); this.name = 'ProductUnavailableError'; } },
}));

import { Cart, Product, PromoCode } from '@pawtag/db';
import { CartService } from '../../../packages/api/src/commerce/services/cart.service';

describe('CartService', () => {
  let cartService: CartService;

  beforeEach(() => {
    vi.clearAllMocks();
    cartService = new CartService();
  });

  const mockCart = {
    _id: 'cart_123',
    userId: 'user_123',
    items: [
      {
        _id: 'item_1',
        productId: 'prod_1',
        productName: 'PawTag Scan',
        sku: 'PT-SCAN',
        unitPrice: 19.99,
        customizationTotal: 0,
        quantity: 2,
      },
    ],
    promoCode: undefined,
    promoDiscount: undefined,
    shippingCost: 0,
    shippingMethodId: undefined,
    lastAccessedAt: new Date(),
    save: vi.fn(),
  };

  const mockProduct = {
    _id: 'prod_1',
    name: 'PawTag Scan',
    sku: 'PT-SCAN',
    price: 19.99,
    salePrice: undefined,
    stock: 100,
    reserved: 5,
    stockPolicy: 'deny',
    isActive: true,
    customizationPrice: 0,
  };

  describe('getOrCreate', () => {
    it('should return existing cart', async () => {
      (Cart.findOne as any).mockResolvedValue(mockCart);
      const result = await cartService.getOrCreate('user_123');
      expect(result._id).toBe('cart_123');
    });

    it('should create new cart if none exists', async () => {
      (Cart.findOne as any).mockResolvedValue(null);
      (Cart.create as any).mockResolvedValue({ _id: 'new_cart', items: [], save: vi.fn() });
      const result = await cartService.getOrCreate('user_123');
      expect(Cart.create).toHaveBeenCalled();
    });
  });

  describe('addItem', () => {
    it('should add new item to cart', async () => {
      (Cart.findOne as any).mockResolvedValue({ ...mockCart, items: [] });
      (Product.findById as any).mockResolvedValue(mockProduct);

      const result = await cartService.addItem('user_123', {
        productId: 'prod_1',
        quantity: 1,
      });

      expect(mockCart.save).toHaveBeenCalled();
    });

    it('should increment quantity for existing item', async () => {
      (Cart.findOne as any).mockResolvedValue(mockCart);
      (Product.findById as any).mockResolvedValue(mockProduct);

      await cartService.addItem('user_123', {
        productId: 'prod_1',
        quantity: 1,
      });

      expect(mockCart.save).toHaveBeenCalled();
    });
  });

  describe('calculateTotals', () => {
    it('should calculate totals correctly', async () => {
      (Cart.findOne as any).mockResolvedValue(mockCart);

      const result = await cartService.calculateTotals('user_123');

      expect(result.subtotal).toBe(39.98); // 19.99 * 2
      expect(result.items).toHaveLength(1);
      expect(result.currency).toBe('NZD');
    });

    it('should return empty totals for empty cart', async () => {
      (Cart.findOne as any).mockResolvedValue({ ...mockCart, items: [] });

      const result = await cartService.calculateTotals('user_123');

      expect(result.subtotal).toBe(0);
      expect(result.items).toHaveLength(0);
    });
  });

  describe('clearCart', () => {
    it('should clear all items', async () => {
      (Cart.findOne as any).mockResolvedValue(mockCart);

      await cartService.clearCart('user_123');

      expect(mockCart.save).toHaveBeenCalled();
    });
  });
});

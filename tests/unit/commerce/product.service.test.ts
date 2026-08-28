/**
 * @module ProductService Tests
 * @description Unit tests for the PawTag Commerce product service.
 *
 * Tests cover:
 * - Product CRUD operations
 * - Pricing calculations
 * - Stock availability checks
 * - Filter and pagination
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database models
vi.mock('@pawtag/db', () => ({
  Product: {
    find: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
    deleteOne: vi.fn(),
  },
  StockMovement: {
    create: vi.fn(),
  },
}));

vi.mock('../../packages/api/src/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { ProductService } from '../../../packages/api/src/commerce/services/product.service';
import { Product } from '@pawtag/db';

describe('ProductService', () => {
  let svc: ProductService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new ProductService();
  });

  const mockProduct = {
    _id: 'prod_123',
    name: 'PawTag Scan',
    description: 'QR-only tag',
    price: 19.99,
    salePrice: undefined,
    compareAtPrice: 24.99,
    currency: 'NZD',
    sku: 'PT-SCAN',
    category: 'tags',
    isActive: true,
    isPublished: true,
    stock: 100,
    reserved: 5,
    lowStockThreshold: 10,
    stockPolicy: 'deny',
    isTagProduct: true,
    isSubscription: true,
    customizable: false,
    customizationPrice: 0,
    shippingCost: 0,
    warrantyMonths: 12,
    variants: [],
    images: [],
    tags: [],
    sortOrder: 0,
    save: vi.fn(),
  };

  describe('getEffectivePrice', () => {
    it('should return base price when no sale price', () => {
      const price = svc.getEffectivePrice(mockProduct as any);
      expect(price).toBe(19.99);
    });

    it('should return sale price when set', () => {
      const withSale = { ...mockProduct, salePrice: 14.99 };
      const price = svc.getEffectivePrice(withSale as any);
      expect(price).toBe(14.99);
    });
  });

  describe('isInStock', () => {
    it('should return true when stock is available', () => {
      expect(svc.isInStock(mockProduct as any, 1)).toBe(true);
    });

    it('should return false when stock is insufficient', () => {
      const lowStock = { ...mockProduct, stock: 2, reserved: 0 };
      expect(svc.isInStock(lowStock as any, 5)).toBe(false);
    });

    it('should return true when stockPolicy is allow', () => {
      const backorder = { ...mockProduct, stock: 0, reserved: 0, stockPolicy: 'allow' };
      expect(svc.isInStock(backorder as any, 10)).toBe(true);
    });
  });

  describe('getAvailableStock', () => {
    it('should calculate available stock correctly', () => {
      expect(svc.getAvailableStock(mockProduct as any)).toBe(95); // 100 - 5
    });

    it('should not return negative stock', () => {
      const overReserved = { ...mockProduct, stock: 2, reserved: 5 };
      expect(svc.getAvailableStock(overReserved as any)).toBe(0);
    });
  });

  describe('calculateLineTotal', () => {
    it('should calculate total without customisation', () => {
      const total = svc.calculateLineTotal(mockProduct as any, 2);
      expect(total).toBe(39.98); // 19.99 * 2
    });

    it('should include customisation price when applied', () => {
      const custom = { ...mockProduct, customizationPrice: 5.00 };
      const total = svc.calculateLineTotal(custom as any, 1, true);
      expect(total).toBe(24.99); // 19.99 + 5.00
    });

    it('should use sale price when set', () => {
      const withSale = { ...mockProduct, salePrice: 14.99 };
      const total = svc.calculateLineTotal(withSale as any, 3);
      expect(total).toBe(44.97); // 14.99 * 3
    });
  });

  describe('create', () => {
    it('should create a product with required fields', async () => {
      (Product.findOne as any).mockResolvedValue(null);
      (Product.create as any).mockResolvedValue(mockProduct);

      const result = await svc.create({
        name: 'PawTag Scan',
        sku: 'PT-SCAN',
        price: 19.99,
      });

      expect(result.name).toBe('PawTag Scan');
      expect(Product.create).toHaveBeenCalled();
    });

    it('should throw on duplicate SKU', async () => {
      (Product.findOne as any).mockResolvedValue(mockProduct);

      await expect(svc.create({
        name: 'Duplicate',
        sku: 'PT-SCAN',
        price: 19.99,
      })).rejects.toThrow('already exists');
    });
  });
});

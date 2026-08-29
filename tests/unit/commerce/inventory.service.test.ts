/**
 * @module InventoryService Tests
 * @description Unit tests for the PawTag Commerce inventory service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@pawtag/db', () => ({
  Product: {
    findById: vi.fn(),
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  StockMovement: {
    create: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock('../../../packages/api/src/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../packages/api/src/commerce/errors', () => ({
  InsufficientStockError: class extends Error { constructor(msg: string) { super(msg); this.name = 'InsufficientStockError'; } },
}));

import { InventoryService } from '../../../packages/api/src/commerce/services/inventory.service';
import { Product, StockMovement } from '@pawtag/db';

describe('InventoryService', () => {
  let inventoryService: InventoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    inventoryService = new InventoryService();
  });

  const mockProduct = {
    _id: 'prod_1',
    stock: 100,
    reserved: 5,
    lowStockThreshold: 10,
    stockPolicy: 'deny',
  };

  describe('getStatus', () => {
    it('should return correct inventory status', async () => {
      (Product.findById as any).mockReturnValue({ lean: () => Promise.resolve(mockProduct) });

      const status = await inventoryService.getStatus('prod_1');

      expect(status.onHand).toBe(100);
      expect(status.reserved).toBe(5);
      expect(status.available).toBe(95);
      expect(status.isLowStock).toBe(false);
      expect(status.isOutOfStock).toBe(false);
    });

    it('should detect low stock', async () => {
      const lowStockProduct = { ...mockProduct, stock: 15, reserved: 10 };
      (Product.findById as any).mockReturnValue({ lean: () => Promise.resolve(lowStockProduct) });

      const status = await inventoryService.getStatus('prod_1');

      expect(status.available).toBe(5);
      expect(status.isLowStock).toBe(true);
    });

    it('should detect out of stock', async () => {
      const oosProduct = { ...mockProduct, stock: 5, reserved: 5 };
      (Product.findById as any).mockReturnValue({ lean: () => Promise.resolve(oosProduct) });

      const status = await inventoryService.getStatus('prod_1');

      expect(status.available).toBe(0);
      expect(status.isOutOfStock).toBe(true);
    });
  });

  describe('reserve', () => {
    it('should reserve stock successfully', async () => {
      const updatedProduct = { ...mockProduct, reserved: 6 };
      (Product.findOneAndUpdate as any).mockResolvedValue(updatedProduct);

      const result = await inventoryService.reserve({
        productId: 'prod_1',
        quantity: 1,
        orderId: 'order_1',
      });

      expect(result.success).toBe(true);
      expect(StockMovement.create).toHaveBeenCalled();
    });

    it('should fail when insufficient stock', async () => {
      (Product.findOneAndUpdate as any).mockResolvedValue(null);

      const result = await inventoryService.reserve({
        productId: 'prod_1',
        quantity: 1000,
        orderId: 'order_1',
      });

      expect(result.success).toBe(false);
    });

    it('should reject zero quantity', async () => {
      const result = await inventoryService.reserve({
        productId: 'prod_1',
        quantity: 0,
        orderId: 'order_1',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('confirmSale', () => {
    it('should confirm sale and deduct stock', async () => {
      const updatedProduct = { ...mockProduct, stock: 99, reserved: 4 };
      (Product.findOneAndUpdate as any).mockResolvedValue(updatedProduct);

      await inventoryService.confirmSale('prod_1', 1, 'order_1');

      expect(Product.findOneAndUpdate).toHaveBeenCalled();
      expect(StockMovement.create).toHaveBeenCalled();
    });
  });

  describe('adjust', () => {
    it('should adjust stock level', async () => {
      const updatedProduct = { ...mockProduct, stock: 110 };
      (Product.findOneAndUpdate as any).mockResolvedValue(updatedProduct);

      await inventoryService.adjust({
        productId: 'prod_1',
        quantity: 10,
        reason: 'Stock count correction',
        actor: 'admin',
      });

      expect(Product.findOneAndUpdate).toHaveBeenCalled();
      expect(StockMovement.create).toHaveBeenCalled();
    });
  });

  describe('canFulfill', () => {
    it('should return true when stock is available', async () => {
      (Product.findById as any).mockReturnValue({ lean: () => Promise.resolve(mockProduct) });

      const result = await inventoryService.canFulfill('prod_1', 5);
      expect(result).toBe(true);
    });

    it('should return false when stock is insufficient', async () => {
      const lowStock = { ...mockProduct, stock: 2, reserved: 0 };
      (Product.findById as any).mockReturnValue({ lean: () => Promise.resolve(lowStock) });

      const result = await inventoryService.canFulfill('prod_1', 5);
      expect(result).toBe(false);
    });

    it('should return true when stockPolicy is allow', async () => {
      const backorder = { ...mockProduct, stock: 0, reserved: 0, stockPolicy: 'allow' };
      (Product.findById as any).mockReturnValue({ lean: () => Promise.resolve(backorder) });

      const result = await inventoryService.canFulfill('prod_1', 100);
      expect(result).toBe(true);
    });
  });
});

/**
 * @module ShippingService Tests
 * @description Unit tests for the PawTag Commerce shipping service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@pawtag/db', () => ({
  Cart: { findOne: vi.fn() },
  Order: { findById: vi.fn(), updateOne: vi.fn() },
  ShippingMethod: { find: vi.fn() },
}));

vi.mock('../../../packages/api/src/commerce/providers/nz-shipping', () => ({
  nzShippingProvider: {
    getRates: vi.fn().mockResolvedValue([
      { id: 'free-standard', name: 'Standard NZ Shipping', cost: 0, estimatedDays: '3-5 business days' },
    ]),
    createShipment: vi.fn().mockResolvedValue({ success: true, trackingNumber: 'NZ123456789AB', carrier: 'NZ Post' }),
    getTrackingEvents: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../commerce/errors', () => ({
  ShippingError: class extends Error { constructor(msg: string) { super(msg); this.name = 'ShippingError'; } },
}));

import { ShippingService } from '../../../packages/api/src/commerce/services/shipping.service';
import { Cart, ShippingMethod, Order } from '@pawtag/db';

describe('ShippingService', () => {
  let shippingService: ShippingService;

  beforeEach(() => {
    vi.clearAllMocks();
    shippingService = new ShippingService();
  });

  const mockAddress = {
    line1: '123 Main St',
    city: 'Auckland',
    state: 'Auckland',
    zip: '1010',
    country: 'NZ',
  };

  describe('getRates', () => {
    it('should return rates from ShippingMethod model when configured', async () => {
      const mockMethods = [
        { _id: 'method_1', name: 'Standard NZ Shipping', rate: 0, rateType: 'free', estimatedDays: '3-5 business days', carrier: 'NZ Post' },
      ];
      (ShippingMethod.find as any).mockReturnValue({
        sort: () => Promise.resolve(mockMethods),
      });

      const rates = await shippingService.getRates('user_1', mockAddress);

      expect(rates).toHaveLength(1);
      expect(rates[0].name).toBe('Standard NZ Shipping');
      expect(rates[0].cost).toBe(0);
    });

    it('should fall back to NZ shipping provider when no methods configured', async () => {
      (ShippingMethod.find as any).mockReturnValue({
        sort: () => Promise.resolve([]),
      });

      const rates = await shippingService.getRates('user_1', mockAddress);

      expect(rates).toHaveLength(1);
      expect(rates[0].name).toBe('Standard NZ Shipping');
    });
  });

  describe('selectMethod', () => {
    it('should update cart with shipping method', async () => {
      const mockCart = { shippingMethodId: undefined, shippingMethodName: undefined, shippingCost: 0, save: vi.fn() };
      (Cart.findOne as any).mockResolvedValue(mockCart);

      await shippingService.selectMethod('user_1', 'method_1', 'Standard', 0);

      expect(mockCart.save).toHaveBeenCalled();
      expect(mockCart.shippingMethodId).toBe('method_1');
      expect(mockCart.shippingMethodName).toBe('Standard');
      expect(mockCart.shippingCost).toBe(0);
    });

    it('should throw if cart not found', async () => {
      (Cart.findOne as any).mockResolvedValue(null);

      await expect(shippingService.selectMethod('user_1', 'method_1', 'Standard', 0))
        .rejects.toThrow('Cart not found');
    });
  });

  describe('createShipment', () => {
    it('should create shipment and update order', async () => {
      const mockOrder = {
        _id: 'order_1',
        orderNumber: 'PT-000001',
        status: 'packing',
        shippingAddress: { line1: '123 Main St', city: 'Auckland', state: 'Auckland', zip: '1010', country: 'NZ' },
        items: [{ productName: 'PawTag Scan', quantity: 2 }],
        trackingNumber: undefined,
        carrier: undefined,
        shippingLabelUrl: undefined,
        save: vi.fn(),
      };
      (Order.findById as any).mockResolvedValue(mockOrder);
      (Order.updateOne as any).mockResolvedValue({});

      const result = await shippingService.createShipment('order_1');

      expect(result.trackingNumber).toBe('NZ123456789AB');
      expect(result.carrier).toBe('NZ Post');
      expect(mockOrder.save).toHaveBeenCalled();
      expect(mockOrder.status).toBe('shipped');
    });

    it('should throw if order not found', async () => {
      (Order.findById as any).mockResolvedValue(null);

      await expect(shippingService.createShipment('order_1'))
        .rejects.toThrow('Order not found');
    });

    it('should throw if order cannot be shipped', async () => {
      const mockOrder = { status: 'delivered' };
      (Order.findById as any).mockResolvedValue(mockOrder);

      await expect(shippingService.createShipment('order_1'))
        .rejects.toThrow('Order cannot be shipped');
    });
  });
});

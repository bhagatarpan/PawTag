import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to create mocks that are available before vi.mock hoisting
const mocks = vi.hoisted(() => ({
  createShipment: vi.fn(),
  getTrackingEvents: vi.fn(),
  getRates: vi.fn(),
  shipmentCreate: vi.fn(),
  shipmentFind: vi.fn(),
  shipmentFindById: vi.fn(),
  shipmentCountDocuments: vi.fn(),
  shipmentUpdateOne: vi.fn(),
  shipmentFindByIdAndUpdate: vi.fn(),
  orderFindById: vi.fn(),
  orderUpdateOne: vi.fn(),
}));

vi.mock('../../packages/api/src/commerce/providers/nz-shipping', () => ({
  nzShippingProvider: {
    createShipment: mocks.createShipment,
    getTrackingEvents: mocks.getTrackingEvents,
    getRates: mocks.getRates,
    isConfigured: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('../../packages/api/src/commerce/config', () => ({
  getBooleanSetting: vi.fn().mockResolvedValue(true),
  getNumberSetting: vi.fn().mockResolvedValue(0),
  getSetting: vi.fn().mockResolvedValue(''),
}));

vi.mock('@pawtag/db', () => ({
  Shipment: {
    create: mocks.shipmentCreate,
    find: mocks.shipmentFind,
    findById: mocks.shipmentFindById,
    countDocuments: mocks.shipmentCountDocuments,
    updateOne: mocks.shipmentUpdateOne,
    findByIdAndUpdate: mocks.shipmentFindByIdAndUpdate,
  },
  Order: {
    findById: mocks.orderFindById,
    updateOne: mocks.orderUpdateOne,
  },
}));

import { shipmentService } from '../../packages/api/src/commerce/services/shipment.service';

describe('ShipmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createShipment', () => {
    it('creates a shipment for a valid order', async () => {
      mocks.orderFindById.mockResolvedValue({
        _id: 'order-123',
        orderNumber: 'PT-0001',
        status: 'paid',
        shippingAddress: { line1: '123 Test St', city: 'Auckland', state: 'AKL', zip: '1010', country: 'NZ' },
        items: [{ productId: 'prod-1', productName: 'QR Tag', quantity: 1 }],
        save: vi.fn(),
      });
      mocks.createShipment.mockResolvedValue({
        success: true,
        trackingNumber: 'NZ123456789AB',
        carrier: 'NZ Post',
        trackingUrl: 'https://www.nzpost.co.nz/tools/tracking/NZ123456789AB',
      });
      mocks.shipmentCreate.mockResolvedValue({
        _id: 'shipment-123',
        orderNumber: 'PT-0001',
        trackingNumber: 'NZ123456789AB',
      });

      const result = await shipmentService.createShipment({ orderId: 'order-123' });

      expect(result).toBeDefined();
      expect(result.trackingNumber).toBe('NZ123456789AB');
      expect(mocks.createShipment).toHaveBeenCalledWith(
        expect.objectContaining({ orderNumber: 'PT-0001' }),
      );
      expect(mocks.orderUpdateOne).toHaveBeenCalled();
    });

    it('throws error when order not found', async () => {
      mocks.orderFindById.mockResolvedValue(null);

      await expect(
        shipmentService.createShipment({ orderId: 'nonexistent' }),
      ).rejects.toThrow('Order not found');
    });

    it('throws error when order status is not shippable', async () => {
      mocks.orderFindById.mockResolvedValue({ _id: 'order-123', status: 'pending' });

      await expect(
        shipmentService.createShipment({ orderId: 'order-123' }),
      ).rejects.toThrow('Order cannot be shipped');
    });
  });

  describe('getShipment', () => {
    it('returns a shipment by ID', async () => {
      const mockShipment = { _id: 'shipment-123', trackingNumber: 'NZ123456789AB' };
      const chain = {
        populate: vi.fn(),
      };
      chain.populate.mockReturnValue(chain);
      chain.populate.mockResolvedValueOnce(undefined); // first populate returns chain
      // Override: second populate resolves to the actual shipment
      chain.populate.mockImplementation((_field: string, _select?: string) => {
        // If it's the second call, resolve with the shipment
        if (chain.populate.mock.calls.length >= 2) {
          return Promise.resolve(mockShipment) as any;
        }
        return chain;
      });
      // Simpler approach: just make both populate calls return the shipment on the last one
      const populate1 = vi.fn();
      const populate2 = vi.fn().mockResolvedValue(mockShipment);
      mocks.shipmentFindById.mockReturnValue({
        populate: populate1,
      });
      populate1.mockReturnValue({ populate: populate2 });

      const result = await shipmentService.getShipment('shipment-123');
      expect(result).toEqual(mockShipment);
    });
  });

  describe('listShipments', () => {
    it('returns paginated shipments', async () => {
      mocks.shipmentCountDocuments.mockResolvedValue(25);
      const mockQuery = {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ _id: 's1' }, { _id: 's2' }]),
      };
      mocks.shipmentFind.mockReturnValue(mockQuery);

      const result = await shipmentService.listShipments({ page: 1, limit: 10 });

      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
      expect(result.items).toHaveLength(2);
    });
  });

  describe('updateStatus', () => {
    it('updates shipment status', async () => {
      const mockShipment = { _id: 's1', orderId: 'order-1', status: 'in_transit' };
      mocks.shipmentFindById.mockResolvedValue(mockShipment);
      mocks.shipmentFindByIdAndUpdate.mockResolvedValue({ ...mockShipment, status: 'delivered' });

      const result = await shipmentService.updateStatus('s1', 'delivered');
      expect(result.status).toBe('delivered');
    });

    it('throws error when shipment not found', async () => {
      mocks.shipmentFindById.mockResolvedValue(null);

      await expect(
        shipmentService.updateStatus('nonexistent', 'delivered'),
      ).rejects.toThrow('Shipment not found');
    });
  });

  describe('pollTrackingUpdates', () => {
    it('returns zero counts when no active shipments', async () => {
      mocks.shipmentFind.mockResolvedValue([]);

      const result = await shipmentService.pollTrackingUpdates();
      expect(result.updated).toBe(0);
      expect(result.errors).toBe(0);
    });
  });
});

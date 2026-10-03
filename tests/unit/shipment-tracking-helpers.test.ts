import { describe, it, expect } from 'vitest';
import {
  isShipmentTrackingMissing,
  canCreateShipmentForOrder,
} from '../../packages/shared/src/index';

describe('shipment tracking helpers', () => {
  describe('isShipmentTrackingMissing', () => {
    it('is true for packing and shipped without tracking', () => {
      expect(isShipmentTrackingMissing('packing', undefined)).toBe(true);
      expect(isShipmentTrackingMissing('shipped', null)).toBe(true);
      expect(isShipmentTrackingMissing('shipped', '')).toBe(true);
    });

    it('is false when tracking exists or status is not packing/shipped', () => {
      expect(isShipmentTrackingMissing('shipped', 'NZ123')).toBe(false);
      expect(isShipmentTrackingMissing('packing', 'NZ123')).toBe(false);
      expect(isShipmentTrackingMissing('paid', undefined)).toBe(false);
      expect(isShipmentTrackingMissing('delivered', undefined)).toBe(false);
      expect(isShipmentTrackingMissing('cancelled', undefined)).toBe(false);
      expect(isShipmentTrackingMissing(undefined, undefined)).toBe(false);
    });
  });

  describe('canCreateShipmentForOrder', () => {
    it('allows packing and shipped without tracking', () => {
      expect(canCreateShipmentForOrder('packing', undefined)).toBe(true);
      expect(canCreateShipmentForOrder('shipped', undefined)).toBe(true);
    });

    it('rejects when tracking already exists or status cannot ship', () => {
      expect(canCreateShipmentForOrder('shipped', 'NZ123')).toBe(false);
      expect(canCreateShipmentForOrder('packing', 'NZ123')).toBe(false);
      expect(canCreateShipmentForOrder('paid', undefined)).toBe(false);
      expect(canCreateShipmentForOrder('delivered', undefined)).toBe(false);
      expect(canCreateShipmentForOrder('cancelled', undefined)).toBe(false);
    });
  });
});

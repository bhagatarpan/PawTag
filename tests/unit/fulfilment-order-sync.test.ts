import { describe, it, expect } from 'vitest';
import {
  resolveOrderStatusFromFulfilment,
  FULFILMENT_TO_ORDER_STATUS,
  FULFILMENT_BACKWARD_ORDER_STATUS,
} from '../../packages/api/src/services/fulfilment-sync';

describe('resolveOrderStatusFromFulfilment', () => {
  it('maps fulfilled → shipped when order is packing (regression: WO-000486)', () => {
    expect(resolveOrderStatusFromFulfilment('fulfilled', 'packing')).toBe('shipped');
  });

  it('maps fulfilled → shipped when order is paid', () => {
    expect(resolveOrderStatusFromFulfilment('fulfilled', 'paid')).toBe('shipped');
  });

  it('does not move order backward from shipped/delivered when fulfilled', () => {
    expect(resolveOrderStatusFromFulfilment('fulfilled', 'shipped')).toBeUndefined();
    expect(resolveOrderStatusFromFulfilment('fulfilled', 'delivered')).toBeUndefined();
  });

  it('maps packing → packing when order is paid', () => {
    expect(resolveOrderStatusFromFulfilment('packing', 'paid')).toBe('packing');
  });

  it('does not change order when packing is already packing', () => {
    expect(resolveOrderStatusFromFulfilment('packing', 'packing')).toBeUndefined();
  });

  it('maps picking → paid only when order is ahead (packing+)', () => {
    expect(resolveOrderStatusFromFulfilment('picking', 'packing')).toBe('paid');
    expect(resolveOrderStatusFromFulfilment('picking', 'shipped')).toBe('paid');
    expect(resolveOrderStatusFromFulfilment('picking', 'paid')).toBeUndefined();
  });

  it('never overwrites cancelled or refunded orders', () => {
    expect(resolveOrderStatusFromFulfilment('fulfilled', 'cancelled')).toBeUndefined();
    expect(resolveOrderStatusFromFulfilment('fulfilled', 'refunded')).toBeUndefined();
    expect(resolveOrderStatusFromFulfilment('packing', 'cancelled')).toBeUndefined();
  });

  it('returns undefined when current order status is missing', () => {
    expect(resolveOrderStatusFromFulfilment('fulfilled', undefined)).toBeUndefined();
    expect(resolveOrderStatusFromFulfilment('fulfilled', null)).toBeUndefined();
  });

  it('does not invent order status for unfulfilled pending fulfilment', () => {
    expect(resolveOrderStatusFromFulfilment('pending', 'paid')).toBeUndefined();
  });

  it('keeps explicit mappings documented and non-empty for packing/fulfilled', () => {
    expect(FULFILMENT_TO_ORDER_STATUS.packing).toBe('packing');
    expect(FULFILMENT_TO_ORDER_STATUS.fulfilled).toBe('shipped');
    expect(FULFILMENT_BACKWARD_ORDER_STATUS.picking).toBe('paid');
  });
});

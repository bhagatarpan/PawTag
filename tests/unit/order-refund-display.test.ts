import { describe, it, expect } from 'vitest';
import {
  getOrderRefundDisplay,
  getRefundDisplayLabel,
  getRefundDisplayBadgeVariant,
} from '../../packages/shared/src/index';

describe('getOrderRefundDisplay', () => {
  it('returns none for normal delivered order', () => {
    expect(getOrderRefundDisplay({ status: 'delivered' })).toBe('none');
  });

  it('returns partial when refundStatus set on delivered', () => {
    expect(getOrderRefundDisplay({ status: 'delivered', refundStatus: 'succeeded' })).toBe('partial');
  });

  it('returns partial when item refundStatus is partial', () => {
    expect(
      getOrderRefundDisplay({
        status: 'delivered',
        items: [{ refundStatus: 'partial' }],
      }),
    ).toBe('partial');
  });

  it('returns full_succeeded when status is refunded', () => {
    expect(getOrderRefundDisplay({ status: 'refunded', refundStatus: 'succeeded' })).toBe('full_succeeded');
  });

  it('returns full_failed when refund failed', () => {
    expect(getOrderRefundDisplay({ status: 'refunded', refundStatus: 'failed' })).toBe('full_failed');
  });

  it('labels and badge variants', () => {
    expect(getRefundDisplayLabel('partial')).toBe('Partially refunded');
    expect(getRefundDisplayBadgeVariant('partial')).toBe('warning');
    expect(getRefundDisplayBadgeVariant('full_succeeded')).toBe('success');
    expect(getRefundDisplayBadgeVariant('full_failed')).toBe('danger');
  });
});

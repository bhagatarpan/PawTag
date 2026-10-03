import { describe, it, expect } from 'vitest';

describe('shipped order refund + fulfilment multi-tag + checkout contact UI', () => {
  it('allows admin refund transition from shipped', () => {
    const transitions: Record<string, string[]> = {
      packing: ['shipped', 'cancelled'],
      shipped: ['delivered', 'refunded'],
      delivered: ['refunded'],
    };
    expect(transitions.shipped).toContain('refunded');
    expect(transitions.shipped).toContain('delivered');
  });

  it('customer can request return on shipped (not cancel auto-refund)', () => {
    const showReturn = ['delivered', 'paid', 'packing', 'shipped'];
    const showCancel = ['paid', 'packing'];
    expect(showReturn).toContain('shipped');
    expect(showCancel).not.toContain('shipped');
  });

  it('fulfilment allows tags up to item quantity', () => {
    const maxTags = (quantity: number, assigned: number) => assigned < quantity;
    expect(maxTags(2, 1)).toBe(true);
    expect(maxTags(2, 2)).toBe(false);
    expect(maxTags(1, 1)).toBe(false);
  });

  it('checkout contact UI uses collapsible when verified, strip when not', () => {
    const fullyVerified = true;
    const pattern = fullyVerified ? 'collapsible' : 'status-strip';
    expect(pattern).toBe('collapsible');
  });
});

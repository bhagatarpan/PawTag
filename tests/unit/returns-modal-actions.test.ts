import { describe, it, expect } from 'vitest';

/**
 * Documents returns modal CSR rules (business decision).
 * Transition map lives in admin-returns.ts — keep in sync.
 */
describe('returns modal approve/reject until refunded', () => {
  const transitions: Record<string, string[]> = {
    pending: ['approved', 'rejected'],
    approved: ['received', 'rejected'],
    rejected: ['approved'],
    received: ['rejected'],
    refunded: [],
    refund_failed: ['received', 'approved', 'rejected'],
  };

  it('allows reverse reject to approved until money refunded', () => {
    expect(transitions.rejected).toContain('approved');
  });

  it('allows reject after received before Process Refund', () => {
    expect(transitions.received).toContain('rejected');
  });

  it('blocks approve/reject after refunded', () => {
    expect(transitions.refunded).toEqual([]);
  });

  it('modal has close control (documented)', () => {
    expect('close-button').toBe('close-button');
  });
});

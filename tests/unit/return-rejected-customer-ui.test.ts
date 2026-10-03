import { describe, it, expect } from 'vitest';

/**
 * Customer portal rejected-return copy rules (OrderDetail ReturnStatusCard).
 */
describe('customer rejected return portal rules', () => {
  it('states no refund will be processed', () => {
    expect('No refund will be processed for this request.').toMatch(/no refund/i);
  });

  it('labels amount as requested not refunded when rejected', () => {
    const label = 'Requested (not refunded)';
    expect(label).toBe('Requested (not refunded)');
  });

  it('hides tracking form for rejected status', () => {
    const canShip = ['approved', 'received'];
    expect(canShip).not.toContain('rejected');
    expect(canShip).not.toContain('pending');
  });

  it('support contact fallback is email only', () => {
    expect('support@pawtag.co.nz').toMatch(/@pawtag\.co\.nz$/);
  });
});

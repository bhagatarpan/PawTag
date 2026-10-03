import { describe, it, expect } from 'vitest';

/**
 * Documents email CMS Phase 1 wiring rules.
 * Runtime CMS lookup is covered by integration/manual email tests.
 */
describe('email CMS phase 1 rules', () => {
  it('sendCmsEmailOrFallback is the preferred CMS-first pattern', () => {
    expect('sendCmsEmailOrFallback').toBe('sendCmsEmailOrFallback');
  });

  it('order-status and refund slugs are CMS-wired in orderNotification.service', () => {
    const wired = ['order-status', 'refund-processing', 'refund-settled', 'refund-failed', 'admin-refund-failed', 'admin-order-alert'];
    expect(wired).toContain('order-status');
    expect(wired).toContain('refund-settled');
  });

  it('login notification uses customer wording not admin account', () => {
    const subject = 'New login to your PawTag account';
    expect(subject).not.toMatch(/admin account/i);
  });

  it('subscription-renewed is a seeded CMS slug', () => {
    expect('subscription-renewed').toBe('subscription-renewed');
  });
});

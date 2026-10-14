import { describe, it, expect } from 'vitest';
import { safeReturnUrl } from '../../apps/web/src/lib/return-url';

/**
 * The return-URL value is written by workflow links and consumed by
 * login/verification — it must never become an open redirect if the
 * stored value is ever poisoned.
 */
describe('safeReturnUrl (open-redirect guard)', () => {
  it('accepts same-origin relative paths', () => {
    expect(safeReturnUrl('/cart')).toBe('/cart');
    expect(safeReturnUrl('/account/orders?x=1')).toBe('/account/orders?x=1');
    expect(safeReturnUrl('/checkout')).toBe('/checkout');
    expect(safeReturnUrl(' /cart ')).toBe('/cart');
  });

  it('blocks protocol-relative URLs', () => {
    expect(safeReturnUrl('//evil.com')).toBeNull();
    expect(safeReturnUrl('//evil.com/path')).toBeNull();
  });

  it('blocks absolute and non-http schemes', () => {
    expect(safeReturnUrl('https://evil.com')).toBeNull();
    expect(safeReturnUrl('http://evil.com')).toBeNull();
    expect(safeReturnUrl('javascript:alert(1)')).toBeNull();
    expect(safeReturnUrl('data:text/html,x')).toBeNull();
  });

  it('treats empty and missing values as absent', () => {
    expect(safeReturnUrl('')).toBeNull();
    expect(safeReturnUrl('   ')).toBeNull();
    expect(safeReturnUrl(null)).toBeNull();
    expect(safeReturnUrl(undefined)).toBeNull();
  });
});

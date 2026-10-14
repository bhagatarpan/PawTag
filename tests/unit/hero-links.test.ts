import { describe, it, expect } from 'vitest';
import { resolveHeroLink } from '../../apps/web/src/components/hero/hero-links';

/**
 * CMS-authored CTA URLs are untrusted input rendered to visitors —
 * only same-site paths and http(s) URLs may become links.
 */
describe('resolveHeroLink (CMS CTA safety)', () => {
  it('accepts same-site relative paths', () => {
    expect(resolveHeroLink('/shop')).toEqual({ kind: 'internal', to: '/shop' });
    expect(resolveHeroLink('  /about  ')).toEqual({ kind: 'internal', to: '/about' });
  });

  it('accepts http(s) absolute URLs as external', () => {
    expect(resolveHeroLink('https://example.com/x')).toEqual({ kind: 'external', href: 'https://example.com/x' });
    expect(resolveHeroLink('http://example.com')).toEqual({ kind: 'external', href: 'http://example.com' });
  });

  it('rejects unsafe schemes and protocol-relative URLs', () => {
    expect(resolveHeroLink('javascript:alert(1)')).toEqual({ kind: 'none' });
    expect(resolveHeroLink('data:text/html,x')).toEqual({ kind: 'none' });
    expect(resolveHeroLink('//evil.com')).toEqual({ kind: 'none' });
    expect(resolveHeroLink('ftp://x')).toEqual({ kind: 'none' });
  });

  it('falls back safely for empty/missing/junk values when a fallback is given', () => {
    expect(resolveHeroLink(undefined, '/shop')).toEqual({ kind: 'fallback', to: '/shop' });
    expect(resolveHeroLink('', '/shop')).toEqual({ kind: 'fallback', to: '/shop' });
    expect(resolveHeroLink('   ', '/shop')).toEqual({ kind: 'fallback', to: '/shop' });
    expect(resolveHeroLink('not a url', '/shop')).toEqual({ kind: 'fallback', to: '/shop' });
  });

  it('drops links entirely when no fallback is allowed', () => {
    expect(resolveHeroLink(undefined)).toEqual({ kind: 'none' });
    expect(resolveHeroLink('javascript:alert(1)')).toEqual({ kind: 'none' });
  });
});

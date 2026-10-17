import { describe, it, expect } from 'vitest';
import {
  isSafeCmsSectionUrl,
  validatePageSectionUrls,
} from '../../packages/api/src/lib/cms-section-urls';

describe('isSafeCmsSectionUrl', () => {
  it('accepts site paths and http(s) URLs', () => {
    expect(isSafeCmsSectionUrl('')).toBe(true);
    expect(isSafeCmsSectionUrl('/shop')).toBe(true);
    expect(isSafeCmsSectionUrl('/account/orders/123')).toBe(true);
    expect(isSafeCmsSectionUrl('https://example.com/hero.png')).toBe(true);
    expect(isSafeCmsSectionUrl('http://example.com')).toBe(true);
    expect(isSafeCmsSectionUrl('HTTPS://EXAMPLE.COM/x')).toBe(true);
    expect(isSafeCmsSectionUrl('  /shop  ')).toBe(true);
  });

  it('rejects javascript:, data:, and other executable schemes', () => {
    expect(isSafeCmsSectionUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeCmsSectionUrl('JavaScript:alert(1)')).toBe(false);
    expect(isSafeCmsSectionUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeCmsSectionUrl('vbscript:msgbox')).toBe(false);
    expect(isSafeCmsSectionUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects protocol-relative and backslash-led URLs', () => {
    expect(isSafeCmsSectionUrl('//evil.com/phish')).toBe(false);
    expect(isSafeCmsSectionUrl('/\\evil.com/phish')).toBe(false);
    expect(isSafeCmsSectionUrl(' ///evil.com')).toBe(false);
  });
});

describe('validatePageSectionUrls', () => {
  it('returns null for valid section content', () => {
    const sections = [
      {
        sectionId: 'hero-banner',
        type: 'hero',
        content: {
          heading: 'Pet Recovery',
          buttonText: 'Shop PawTag Now',
          buttonUrl: '/shop',
          backgroundUrl: '/api/uploads/cms/general/hero.png',
        },
      },
    ];
    expect(validatePageSectionUrls(sections)).toBeNull();
  });

  it('flags unsafe top-level content URL fields (regression: javascript: href)', () => {
    const sections = [
      { sectionId: 'hero-banner', type: 'hero', content: { buttonUrl: 'javascript:alert(1)' } },
    ];
    expect(validatePageSectionUrls(sections)).toBe('buttonUrl');
  });

  it('flags unsafe nested URLs inside array items', () => {
    const sections = [
      {
        sectionId: 'pricing',
        type: 'pricing',
        content: {
          plans: [
            { name: 'Gold', ctaUrl: '/subscribe' },
            { name: 'Evil', ctaUrl: 'javascript:alert(1)' },
          ],
        },
      },
    ];
    expect(validatePageSectionUrls(sections)).toBe('ctaUrl');
  });

  it('ignores fields without a Url suffix', () => {
    const sections = [
      { sectionId: 'html', type: 'custom-html', content: { html: '<a href="/x">x</a>', link: '/fine' } },
    ];
    expect(validatePageSectionUrls(sections)).toBeNull();
  });

  it('returns null for non-array input (left to schema validation)', () => {
    expect(validatePageSectionUrls(undefined)).toBeNull();
    expect(validatePageSectionUrls(null)).toBeNull();
    expect(validatePageSectionUrls({ content: {} })).toBeNull();
    expect(validatePageSectionUrls('nope')).toBeNull();
  });
});

/**
 * Pure CTA link resolution for hero slides.
 *
 * CMS-authored URLs are untrusted input. Only same-site relative paths
 * (`/shop`) and http(s) absolute URLs are accepted. Anything else —
 * `javascript:`, `data:`, protocol-relative `//host`, junk — resolves to a
 * safe fallback destination (primary CTA) or is dropped (secondary CTA).
 * We never silently redirect invalid links to the homepage.
 */

export type ResolvedHeroLink =
  | { kind: 'internal'; to: string }
  | { kind: 'external'; href: string }
  | { kind: 'fallback'; to: string }
  | { kind: 'none' };

export function resolveHeroLink(raw: unknown, fallbackTo?: string): ResolvedHeroLink {
  const fallback: ResolvedHeroLink = fallbackTo ? { kind: 'fallback', to: fallbackTo } : { kind: 'none' };

  if (typeof raw !== 'string') return fallback;
  const url = raw.trim();
  if (!url) return fallback;

  if (url.startsWith('/')) {
    // Protocol-relative (`//evil.com`) is not a same-site path.
    if (url.startsWith('//')) return fallback;
    return { kind: 'internal', to: url };
  }

  if (/^https?:\/\//i.test(url)) return { kind: 'external', href: url };

  return fallback;
}

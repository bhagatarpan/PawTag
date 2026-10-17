/**
 * Page section content (CmsPage.sections[].content) is persisted as-is and
 * later rendered to visitors, so URL-like fields must not carry
 * javascript:/data: schemes or protocol-relative //host URLs.
 *
 * Same rule as cmsSafeUrl for homepage sections (middleware/schemas.ts),
 * applied generically to any `*Url` key at any nesting depth — top-level
 * content fields and array items alike (e.g. pricing-plan ctaUrl).
 */

const MAX_SECTION_URL_DEPTH = 4;

export function isSafeCmsSectionUrl(value: string): boolean {
  const url = value.trim();
  if (url === '') return true;
  // Backslash-led paths are rejected too: browsers normalise "/\host" to "//host".
  if (url.startsWith('/')) return !url.startsWith('//') && !url.startsWith('/\\');
  return /^https?:\/\//i.test(url);
}

function findUnsafeSectionUrlField(value: unknown, depth: number): string | null {
  if (depth > MAX_SECTION_URL_DEPTH) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const unsafe = findUnsafeSectionUrlField(item, depth + 1);
      if (unsafe) return unsafe;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key.endsWith('Url') && typeof child === 'string') {
      if (!isSafeCmsSectionUrl(child)) return key;
      continue;
    }
    const unsafe = findUnsafeSectionUrlField(child, depth + 1);
    if (unsafe) return unsafe;
  }
  return null;
}

/**
 * Validate every `*Url` field across all sections.
 * Returns the offending field name, or null when all are safe.
 */
export function validatePageSectionUrls(sections: unknown): string | null {
  if (!Array.isArray(sections)) return null;
  for (const section of sections) {
    const unsafe = findUnsafeSectionUrlField(section, 0);
    if (unsafe) return unsafe;
  }
  return null;
}

// ============================================================
// CMS page hero — image position + zoom
//
// Shared by the admin Puck builder preview and the customer web
// render so both apply identical CSS for the same section content.
// Values align with the homepage hero focal-point vocabulary
// (see heroSlideContentSchema in packages/api).
// ============================================================

export const CMS_HERO_POSITIONS = [
  'center', 'top', 'bottom', 'left', 'right',
  'left-top', 'right-top', 'left-bottom', 'right-bottom',
] as const;

export type CmsHeroPosition = (typeof CMS_HERO_POSITIONS)[number];

export const CMS_HERO_POSITION_LABELS: Record<CmsHeroPosition, string> = {
  center: 'Center',
  top: 'Top',
  bottom: 'Bottom',
  left: 'Left',
  right: 'Right',
  'left-top': 'Top left',
  'right-top': 'Top right',
  'left-bottom': 'Bottom left',
  'right-bottom': 'Bottom right',
};

const HERO_POSITION_CSS: Record<CmsHeroPosition, string> = {
  center: 'center',
  top: 'top center',
  bottom: 'bottom center',
  left: 'center left',
  right: 'center right',
  'left-top': 'left top',
  'right-top': 'right top',
  'left-bottom': 'left bottom',
  'right-bottom': 'right bottom',
};

export const CMS_HERO_ZOOM_MIN = 50;
export const CMS_HERO_ZOOM_MAX = 200;
export const CMS_HERO_ZOOM_DEFAULT = 100;

export function isCmsHeroPosition(value: unknown): value is CmsHeroPosition {
  return typeof value === 'string' && (CMS_HERO_POSITIONS as readonly string[]).includes(value);
}

/** Clamp untrusted section content into the supported zoom range. */
export function normalizeCmsHeroZoom(value: unknown): number {
  // JSON content edited by hand can carry null/empty — treat as "unset".
  if (value === null || value === undefined || value === '') return CMS_HERO_ZOOM_DEFAULT;
  const zoom = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(zoom)) return CMS_HERO_ZOOM_DEFAULT;
  return Math.min(CMS_HERO_ZOOM_MAX, Math.max(CMS_HERO_ZOOM_MIN, Math.round(zoom)));
}

/** CSS `background-position` for a hero position; unknown values fall back to center. */
export function cmsHeroBackgroundPosition(position?: unknown): string {
  return isCmsHeroPosition(position) ? HERO_POSITION_CSS[position] : 'center';
}

/**
 * CSS `background-size`. 100 (the default) keeps the classic `cover` behavior
 * so pages saved before zoom existed render unchanged; larger values crop
 * tighter, smaller values shrink the image and reveal the section gradient.
 */
export function cmsHeroBackgroundSize(zoom?: unknown): string {
  const normalized = normalizeCmsHeroZoom(zoom);
  return normalized === CMS_HERO_ZOOM_DEFAULT ? 'cover' : `${normalized}% auto`;
}

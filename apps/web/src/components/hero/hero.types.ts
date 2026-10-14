/**
 * Homepage hero slider — shared types and design constants.
 * All visual values follow /docs/DESIGN.md (PawTag teal system).
 */

export interface HeroCta {
  label: string;
  href: string;
}

export type HeroFocalPoint =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'left-top'
  | 'right-top'
  | 'left-bottom'
  | 'right-bottom';

/** object-position class per focal point (static Tailwind classes only). */
export const HERO_FOCAL_CLASSES: Record<HeroFocalPoint, string> = {
  center: 'object-center',
  top: 'object-top',
  bottom: 'object-bottom',
  left: 'object-left',
  right: 'object-right',
  'left-top': 'object-left-top',
  'right-top': 'object-right-top',
  'left-bottom': 'object-left-bottom',
  'right-bottom': 'object-right-bottom',
};

export function isHeroFocalPoint(value: unknown): value is HeroFocalPoint {
  return typeof value === 'string' && value in HERO_FOCAL_CLASSES;
}

export interface HeroSlideModel {
  /** Stable React key: CMS document id or `default-N`. */
  id: string;
  eyebrow: string;
  headline: string;
  sub: string;
  primaryCta: HeroCta;
  /** Omitted when empty/invalid in the source data. */
  secondaryCta: HeroCta | null;
  desktopImageUrl: string;
  /** Optional purpose-cropped mobile image; falls back to the desktop image. */
  mobileImageUrl: string;
  /** Empty string = decorative image. */
  imageAlt: string;
  focalPoint: HeroFocalPoint;
}

/** Autoplay default: 7 seconds per slide (packet requirement). */
export const HERO_AUTOPLAY_MS = 7000;

/** Minimum swipe travel in px before a slide change is considered. */
export const HERO_SWIPE_THRESHOLD_PX = 50;

/**
 * Hero media fallback gradient (used until photography is uploaded, and on
 * image load failure). Single source of truth for the brand teal ramp:
 *   from primary-600  #0d9488  →  to primary-800  #115e59
 * Tailwind compiles this to
 *   linear-gradient(to bottom right, #0d9488 var(--tw-gradient-from-position), #115e59 var(--tw-gradient-to-position))
 * — the gradient position variables must not be overridden.
 * Documented in /docs/DESIGN.md → Homepage Hero.
 */
export const HERO_FALLBACK_GRADIENT_CLASS = 'bg-gradient-to-br from-primary-600 to-primary-800';

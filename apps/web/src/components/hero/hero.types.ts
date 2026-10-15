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

/**
 * Desktop (≥768px) counterpart of HERO_FOCAL_CLASSES. Kept as complete
 * static literals so Tailwind's content scanner generates every variant —
 * template-interpolated `md:${cls}` strings would be dropped.
 */
export const HERO_FOCAL_DESKTOP_CLASSES: Record<HeroFocalPoint, string> = {
  center: 'md:object-center',
  top: 'md:object-top',
  bottom: 'md:object-bottom',
  left: 'md:object-left',
  right: 'md:object-right',
  'left-top': 'md:object-left-top',
  'right-top': 'md:object-right-top',
  'left-bottom': 'md:object-left-bottom',
  'right-bottom': 'md:object-right-bottom',
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
  /** Optional purpose-cropped mobile image; the desktop image is used below 768px otherwise. */
  mobileImageUrl: string;
  /** Empty string = decorative image. */
  imageAlt: string;
  /** Focal point for the desktop image. */
  focalPoint: HeroFocalPoint;
  /**
   * Focal point for the mobile crop. Falls back to `focalPoint` when the
   * CMS record predates the separate mobile control.
   */
  mobileFocalPoint: HeroFocalPoint;
}

/** Autoplay default: 7 seconds per slide (packet requirement). */
export const HERO_AUTOPLAY_MS = 7000;

/** Minimum swipe travel in px before a slide change is considered. */
export const HERO_SWIPE_THRESHOLD_PX = 50;

/**
 * Full-bleed hero fallback canvas (used until photography is uploaded, and
 * on image load failure). Deep teal → charcoal → muted teal ramp: dark
 * enough for white overlay text at every breakpoint, so the cinematic
 * composition holds with or without photographs.
 * Documented in /docs/DESIGN.md → Homepage Hero.
 */
export const HERO_FALLBACK_GRADIENT_CLASS =
  'bg-gradient-to-br from-primary-900 via-gray-900 to-primary-800';

/**
 * Readability scrim layered over photography. Mobile: bottom-weighted
 * (content anchors low, pet stays visible up top). Desktop (≥768px):
 * left-weighted so the subject on the right remains clear.
 * Uses the brand charcoal #071f22 from /docs/DESIGN.md.
 */
export const HERO_SCRIM_CLASS =
  'bg-gradient-to-b from-[#071f22]/45 via-[#071f22]/60 to-[#071f22]/95 md:bg-gradient-to-r md:from-[#071f22]/90 md:via-[#071f22]/55 md:to-[#071f22]/5';

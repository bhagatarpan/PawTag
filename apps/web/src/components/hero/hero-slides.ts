import type { HomepageSection } from '../../hooks/useCms';
import {
  isHeroFocalPoint,
  type HeroCta,
  type HeroFocalPoint,
  type HeroSlideModel,
} from './hero.types';

/**
 * The three approved core-product stories, used when the CMS returns no
 * active hero slides. No statistics, testimonials, or prices — ever.
 * Image URLs are intentionally empty until the owner uploads photography;
 * the media component renders a branded fallback meanwhile.
 */
export const DEFAULT_HERO_SLIDES: HeroSlideModel[] = [
  {
    id: 'default-1',
    eyebrow: 'PET SAFETY, SIMPLIFIED',
    headline: "They can't tell someone where they live. Their tag can.",
    sub: 'Give your pet a simple way to be identified and help someone reach you if they wander.',
    primaryCta: { label: 'Shop PawTag', href: '/shop' },
    secondaryCta: { label: 'How PawTag Works', href: '/about' },
    desktopImageUrl: '',
    mobileImageUrl: '',
    imageAlt: '',
    focalPoint: 'center',
  },
  {
    id: 'default-2',
    eyebrow: 'SMART IDENTIFICATION',
    headline: 'One scan can make all the difference.',
    sub: 'Someone finds your pet, scans the tag with their phone, and can get in touch. No app required for the finder.',
    primaryCta: { label: 'See How It Works', href: '/about' },
    secondaryCta: { label: 'Explore PawTag', href: '/shop' },
    desktopImageUrl: '',
    mobileImageUrl: '',
    imageAlt: '',
    focalPoint: 'center',
  },
  {
    id: 'default-3',
    eyebrow: 'MORE THAN A NAME TAG',
    headline: 'Their important details, always close.',
    sub: 'Create a pet profile and manage the information a finder can see when they scan your PawTag.',
    primaryCta: { label: 'Discover Pet Profiles', href: '/pet-recovery' },
    secondaryCta: { label: 'Get Started', href: '/shop' },
    desktopImageUrl: '',
    mobileImageUrl: '',
    imageAlt: '',
    focalPoint: 'center',
  },
];

const SAFE_PRIMARY_FALLBACK = '/shop';

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cta(label: unknown, href: unknown): HeroCta | null {
  const cleanLabel = asTrimmedString(label);
  const cleanHref = asTrimmedString(href);
  if (!cleanLabel || !cleanHref) return null;
  return { label: cleanLabel, href: cleanHref };
}

/**
 * Normalize CMS `hero_slide` documents into renderable slides.
 *
 * Legacy records (pre-redesign) remain renderable: `tag` → eyebrow,
 * `imageUrl` → desktop image, `ctaText`/`ctaUrl` → primary CTA.
 * Unknown/legacy visual fields (bg, visualType, stats, flowSteps) are
 * deliberately ignored — the new design is photography-led.
 */
export function normalizeHeroSections(sections: HomepageSection[]): HeroSlideModel[] {
  return sections.map((section, index) => {
    const content = (section.content || {}) as Record<string, unknown>;

    const primary =
      cta(content.ctaText, content.ctaUrl) ??
      cta(section.title, SAFE_PRIMARY_FALLBACK) ?? { label: 'Learn More', href: SAFE_PRIMARY_FALLBACK };

    const secondary = cta(content.secondaryCtaText, content.secondaryCtaUrl);

    const focal = content.imageFocalPoint;
    const focalPoint: HeroFocalPoint = isHeroFocalPoint(focal) ? focal : 'center';

    return {
      id: section._id || `slide-${index + 1}`,
      eyebrow: asTrimmedString(content.eyebrow) || asTrimmedString(content.tag) || section.title,
      headline: asTrimmedString(content.headline) || section.title,
      sub: asTrimmedString(content.sub) || asTrimmedString(section.subtitle),
      primaryCta: {
        label: primary.label,
        // Invalid/unsafe primary links fall back to a real destination.
        href: primary.href,
      },
      secondaryCta: secondary,
      desktopImageUrl: asTrimmedString(content.desktopImageUrl) || asTrimmedString(content.imageUrl),
      mobileImageUrl: asTrimmedString(content.mobileImageUrl),
      imageAlt: asTrimmedString(content.imageAlt),
      focalPoint,
    };
  });
}

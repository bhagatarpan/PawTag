import { describe, it, expect } from 'vitest';
import {
  DEFAULT_HERO_SLIDES,
  normalizeHeroSections,
} from '../../apps/web/src/components/hero/hero-slides';
import type { HomepageSection } from '../../apps/web/src/hooks/useCms';

function section(content: Record<string, unknown>, overrides: Partial<HomepageSection> = {}): HomepageSection {
  return {
    _id: 'doc-1',
    sectionType: 'hero_slide',
    title: 'Slide',
    content,
    order: 0,
    isActive: true,
    ...overrides,
  };
}

describe('normalizeHeroSections', () => {
  it('maps new-format CMS content', () => {
    const [slide] = normalizeHeroSections([
      section(
        {
          eyebrow: 'PET SAFETY, SIMPLIFIED',
          headline: 'Headline here',
          sub: 'Supporting text',
          ctaText: 'Shop PawTag',
          ctaUrl: '/shop',
          secondaryCtaText: 'How PawTag Works',
          secondaryCtaUrl: '/about',
          desktopImageUrl: '/api/uploads/desktop.jpg',
          mobileImageUrl: '/api/uploads/mobile.jpg',
          imageAlt: 'A dog',
          imageFocalPoint: 'right',
          duration: 9,
        },
        { _id: 'abc' },
      ),
    ]);

    expect(slide).toMatchObject({
      id: 'abc',
      eyebrow: 'PET SAFETY, SIMPLIFIED',
      headline: 'Headline here',
      sub: 'Supporting text',
      primaryCta: { label: 'Shop PawTag', href: '/shop' },
      secondaryCta: { label: 'How PawTag Works', href: '/about' },
      desktopImageUrl: '/api/uploads/desktop.jpg',
      mobileImageUrl: '/api/uploads/mobile.jpg',
      imageAlt: 'A dog',
      focalPoint: 'right',
      mobileFocalPoint: 'right', // falls back to the desktop focal when absent
    });
  });

  it('maps a separate mobile focal point and falls back to the desktop focal when absent', () => {
    const [withMobile] = normalizeHeroSections([
      section({ headline: 'H', imageFocalPoint: 'right', imageMobileFocalPoint: 'top' }),
    ]);
    expect(withMobile.focalPoint).toBe('right');
    expect(withMobile.mobileFocalPoint).toBe('top');

    // Legacy record: no mobile focal → desktop focal applies everywhere
    const [legacy] = normalizeHeroSections([section({ headline: 'H', imageFocalPoint: 'bottom' })]);
    expect(legacy.mobileFocalPoint).toBe('bottom');

    // Invalid mobile focal → desktop focal applies
    const [invalid] = normalizeHeroSections([
      section({ headline: 'H', imageFocalPoint: 'left', imageMobileFocalPoint: 'nowhere' }),
    ]);
    expect(invalid.mobileFocalPoint).toBe('left');
  });

  it('maps legacy CMS content (tag/imageUrl/cta fields) without crashing', () => {
    const [slide] = normalizeHeroSections([
      section({
        tag: 'Emotional',
        headline: 'Legacy headline',
        sub: 'Legacy sub',
        ctaText: 'Protect Your Pet',
        ctaUrl: '/shop',
        bg: 'from-primary-700 via-primary-600 to-primary-800',
        visualType: 'paw',
        stats: [{ number: '14K+', label: 'Pets' }],
        flowSteps: [],
        imageUrl: '/api/uploads/legacy.jpg',
        imageAlt: '',
      }),
    ]);

    expect(slide.eyebrow).toBe('Emotional'); // tag → eyebrow
    expect(slide.desktopImageUrl).toBe('/api/uploads/legacy.jpg'); // imageUrl → desktop
    expect(slide.primaryCta).toEqual({ label: 'Protect Your Pet', href: '/shop' });
    expect(slide.secondaryCta).toBeNull();
    expect(slide.focalPoint).toBe('center'); // invalid/missing focal → center
  });

  it('survives sparse content and falls back to the section title', () => {
    const [slide] = normalizeHeroSections([section({}, { title: 'Only Title' })]);
    expect(slide.headline).toBe('Only Title');
    expect(slide.eyebrow).toBe('Only Title');
    expect(slide.sub).toBe('');
  });

  it('ignores an invalid focal point', () => {
    const [slide] = normalizeHeroSections([section({ headline: 'H', imageFocalPoint: 'somewhere' })]);
    expect(slide.focalPoint).toBe('center');
  });
});

describe('DEFAULT_HERO_SLIDES', () => {
  it('contains exactly the three approved stories with valid routes', () => {
    expect(DEFAULT_HERO_SLIDES).toHaveLength(3);
    for (const slide of DEFAULT_HERO_SLIDES) {
      expect(slide.headline.length).toBeGreaterThan(0);
      expect(slide.primaryCta.href.startsWith('/')).toBe(true);
      // No fake statistics or testimonials in approved defaults
      expect(JSON.stringify(slide)).not.toMatch(/14K|98%|Sarah|Reunited Today|\$/);
    }
  });
});

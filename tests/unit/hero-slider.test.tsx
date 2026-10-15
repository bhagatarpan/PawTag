// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { HomepageSection } from '../../apps/web/src/hooks/useCms';

const { mockSections } = vi.hoisted(() => ({
  mockSections: { current: [] as HomepageSection[], loading: false },
}));

vi.mock('../../apps/web/src/hooks/useCms', () => ({
  useHomepageSections: () => ({
    sections: mockSections.current,
    loading: mockSections.loading,
    error: null,
  }),
}));

import HeroSlider from '../../apps/web/src/components/hero/HeroSlider';

function cmsSlide(content: Record<string, unknown>, order = 0, id = `doc-${order}`): HomepageSection {
  return { _id: id, sectionType: 'hero_slide', title: content.headline || `Slide ${order}`, content, order, isActive: true };
}

function renderSlider() {
  return render(
    <MemoryRouter>
      <HeroSlider />
    </MemoryRouter>,
  );
}

/**
 * Slide wrappers carry aria-hidden when inactive, so role-based queries only
 * ever see the active slide — query the DOM directly for stack assertions.
 */
function slidesOf(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[aria-roledescription="slide"]'));
}

function activeSlideIndex(container: HTMLElement): number {
  return slidesOf(container).findIndex((slide) => slide.getAttribute('aria-hidden') === 'false');
}

function stubMatchMedia(reduceMotion: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduce') ? reduceMotion : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe('HeroSlider', () => {
  beforeEach(() => {
    mockSections.current = [];
    mockSections.loading = false;
    stubMatchMedia(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the three approved default slides when the CMS returns nothing', () => {
    const { container } = renderSlider();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/PawTag/);
    expect(screen.getByRole('region', { name: 'Highlights' })).toBeTruthy();
    expect(slidesOf(container)).toHaveLength(3);
    expect(activeSlideIndex(container)).toBe(0);
    expect(screen.getByText("They can't tell someone where they live. Their tag can.")).toBeTruthy();
    expect(screen.getByRole('link', { name: /Shop PawTag/ }).getAttribute('href')).toBe('/shop');
    expect(screen.getByRole('link', { name: /How PawTag Works/ }).getAttribute('href')).toBe('/about');
  });

  it('renders CMS slides and maps legacy fields (tag → eyebrow, imageUrl → media)', () => {
    mockSections.current = [
      cmsSlide({
        tag: 'Emotional',
        headline: 'Legacy headline lives on',
        sub: 'Legacy sub',
        ctaText: 'Protect Your Pet',
        ctaUrl: '/shop',
        imageUrl: '/api/uploads/legacy.jpg',
        imageAlt: 'A golden retriever',
      }),
    ];
    const { container } = renderSlider();

    expect(screen.getByText('Emotional')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Legacy headline lives on' })).toBeTruthy();
    const img = container.querySelector('img[src="/api/uploads/legacy.jpg"]');
    expect(img).toBeTruthy();
  });

  it('renders a <picture> with a mobile <source> when a separate mobile crop exists', () => {
    mockSections.current = [
      cmsSlide({
        headline: 'With crop',
        desktopImageUrl: '/api/uploads/desktop.jpg',
        mobileImageUrl: '/api/uploads/mobile.jpg',
      }),
    ];
    const { container } = renderSlider();

    const source = container.querySelector('source[media="(max-width: 767px)"]');
    expect(source?.getAttribute('srcset')).toBe('/api/uploads/mobile.jpg');
    expect(container.querySelector('img[src="/api/uploads/desktop.jpg"]')).toBeTruthy();
  });

  it('lays media full-bleed behind overlaid content — no boxed image card remains', () => {
    mockSections.current = [
      cmsSlide({ headline: 'Cinematic', desktopImageUrl: '/api/uploads/x.jpg', imageAlt: 'A dog' }),
    ];
    const { container } = renderSlider();

    const media = container.querySelector('[data-testid="hero-media"]');
    expect(media).toBeTruthy();
    expect(media?.className).toContain('absolute');
    expect(media?.className).toContain('inset-0');
    // The image itself fills the canvas (object-cover, no fixed aspect box)
    const img = container.querySelector('img[src="/api/uploads/x.jpg"]');
    expect(img?.className).toContain('object-cover');
    expect(img?.className).toContain('h-full');
    // The old aspect-[4/3] rounded placeholder box is gone
    expect(container.querySelector('[class*="aspect-"]')).toBeNull();
    expect(container.querySelector('[class*="rounded-2xl"]')).toBeNull();
    // A readability scrim sits between media and content
    const activeSlide = slidesOf(container)[0];
    const scrim = activeSlide.querySelector('[aria-hidden="true"].absolute.inset-0[class*="gradient"]');
    expect(scrim).toBeTruthy();
  });

  it('uses the full-bleed teal→charcoal fallback canvas when a slide has no photo', () => {
    mockSections.current = [cmsSlide({ headline: 'No photo yet' })];
    const { container } = renderSlider();

    expect(container.querySelectorAll('img').length).toBe(0);
    const media = container.querySelector('[data-testid="hero-media"]');
    expect(media).toBeTruthy();
    // Deep teal→charcoal fallback (not the old bright teal box)
    expect(media?.className).toContain('from-primary-900');
    expect(media?.className).toContain('to-primary-800');
  });

  it('applies separate mobile and desktop focal points as responsive classes', () => {
    mockSections.current = [
      cmsSlide({
        headline: 'Focal',
        desktopImageUrl: '/api/uploads/d.jpg',
        mobileImageUrl: '/api/uploads/m.jpg',
        imageFocalPoint: 'right',
        imageMobileFocalPoint: 'top',
      }),
    ];
    const { container } = renderSlider();

    const img = container.querySelector('img');
    expect(img?.className).toContain('object-top'); // mobile crop focal (below md)
    expect(img?.className).toContain('md:object-right'); // desktop focal (≥ md)
  });

  it('falls back to the desktop focal point when the mobile focal is absent (legacy records)', () => {
    mockSections.current = [
      cmsSlide({
        headline: 'Legacy focal',
        desktopImageUrl: '/api/uploads/d.jpg',
        imageFocalPoint: 'bottom',
      }),
    ];
    const { container } = renderSlider();

    const img = container.querySelector('img');
    expect(img?.className).toContain('object-bottom');
    expect(img?.className).toContain('md:object-bottom');
  });

  it('loads the first slide eagerly and later slides lazily', () => {
    mockSections.current = [
      cmsSlide({ headline: 'One', desktopImageUrl: '/a.jpg' }, 0, 'a'),
      cmsSlide({ headline: 'Two', desktopImageUrl: '/b.jpg' }, 1, 'b'),
    ];
    const { container } = renderSlider();

    expect(container.querySelector('img[src="/a.jpg"]')?.getAttribute('loading')).toBe('eager');
    expect(container.querySelector('img[src="/b.jpg"]')?.getAttribute('loading')).toBe('lazy');
  });

  it('navigates next/previous with wraparound and updates indicators', () => {
    mockSections.current = [
      cmsSlide({ headline: 'One' }, 0, 'a'),
      cmsSlide({ headline: 'Two' }, 1, 'b'),
      cmsSlide({ headline: 'Three' }, 2, 'c'),
    ];
    const { container } = renderSlider();

    expect(activeSlideIndex(container)).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(activeSlideIndex(container)).toBe(1);
    expect(screen.getByRole('tab', { name: 'Go to slide 2 of 3' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(activeSlideIndex(container)).toBe(0);

    // Wraparound: previous from the first slide lands on the last
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(activeSlideIndex(container)).toBe(2);
  });

  it('indicator clicks jump to the chosen slide', () => {
    mockSections.current = [cmsSlide({ headline: 'One' }, 0, 'a'), cmsSlide({ headline: 'Two' }, 1, 'b')];
    const { container } = renderSlider();

    fireEvent.click(screen.getByRole('tab', { name: 'Go to slide 2 of 2' }));
    expect(activeSlideIndex(container)).toBe(1);
  });

  it('manual navigation pauses autoplay until resumed with the play control', () => {
    vi.useFakeTimers();
    mockSections.current = [cmsSlide({ headline: 'One' }, 0, 'a'), cmsSlide({ headline: 'Two' }, 1, 'b')];
    const { container } = renderSlider();

    // Autoplay advances on its own
    act(() => {
      vi.advanceTimersByTime(7500);
    });
    expect(activeSlideIndex(container)).toBe(1);

    // Manual navigation goes back and pauses autoplay
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(activeSlideIndex(container)).toBe(0);
    expect(screen.getByRole('button', { name: 'Resume auto-rotation' }).getAttribute('aria-pressed')).toBe('true');

    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(activeSlideIndex(container)).toBe(0); // still paused

    // Resume → autoplay continues
    fireEvent.click(screen.getByRole('button', { name: 'Resume auto-rotation' }));
    act(() => {
      vi.advanceTimersByTime(7500);
    });
    expect(activeSlideIndex(container)).toBe(1);
  });

  it('does not auto-advance under prefers-reduced-motion', () => {
    vi.useFakeTimers();
    stubMatchMedia(true);
    mockSections.current = [cmsSlide({ headline: 'One' }, 0, 'a'), cmsSlide({ headline: 'Two' }, 1, 'b')];
    const { container } = renderSlider();

    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(activeSlideIndex(container)).toBe(0);
  });

  it('falls back to /shop for an unsafe primary CTA and drops an unsafe secondary CTA', () => {
    mockSections.current = [
      cmsSlide({
        headline: 'Unsafe links',
        ctaText: 'Sneaky',
        ctaUrl: 'javascript:alert(1)',
        secondaryCtaText: 'Also Sneaky',
        secondaryCtaUrl: 'javascript:alert(2)',
      }),
    ];
    renderSlider();

    const link = screen.getByRole('link', { name: /Sneaky/ });
    expect(link.getAttribute('href')).toBe('/shop');
    expect(screen.queryByRole('link', { name: /Also Sneaky/ })).toBeNull();
  });

  it('renders external CTA links safely', () => {
    mockSections.current = [
      cmsSlide({ headline: 'External', ctaText: 'Visit', ctaUrl: 'https://example.com/x' }),
    ];
    renderSlider();

    const link = screen.getByRole('link', { name: /Visit/ });
    expect(link.getAttribute('href')).toBe('https://example.com/x');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('keeps inactive slides out of the tab order', () => {
    mockSections.current = [cmsSlide({ headline: 'One' }, 0, 'a'), cmsSlide({ headline: 'Two' }, 1, 'b')];
    const { container } = renderSlider();

    const inactiveSlide = slidesOf(container)[1];
    expect(inactiveSlide.getAttribute('aria-hidden')).toBe('true');
    const inactiveLink = inactiveSlide.querySelector('a');
    expect(inactiveLink?.getAttribute('tabindex')).toBe('-1');
  });

  it('hides navigation controls for a single slide', () => {
    mockSections.current = [cmsSlide({ headline: 'Only one' })];
    renderSlider();

    expect(screen.queryByRole('button', { name: 'Next slide' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pause auto-rotation' })).toBeNull();
  });

  it('shows a stable dark skeleton while loading with no data', () => {
    mockSections.loading = true;
    const { container } = renderSlider();

    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });
});

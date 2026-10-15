import { useEffect, useMemo, useRef, useState } from 'react';
import { useHomepageSections } from '../../hooks/useCms';
import { DEFAULT_HERO_SLIDES, normalizeHeroSections } from './hero-slides';
import { useHeroCarousel } from './useHeroCarousel';
import { HERO_SCRIM_CLASS } from './hero.types';
import HeroSlideContent from './HeroSlideContent';
import HeroSlideMedia from './HeroSlideMedia';
import HeroSliderControls from './HeroSliderControls';

/**
 * Premium full-width cinematic homepage hero.
 *
 * CMS-managed (`hero_slide` homepage sections) with the three approved
 * default stories as fallback. The photograph (or the teal→charcoal
 * fallback canvas) covers the entire hero; headlines, descriptions, CTAs
 * and controls are real HTML layered over it. A readability scrim keeps
 * text contrast stable across varying photography. Content aligns with the
 * site's max-w-7xl grid while the media canvas stays edge-to-edge.
 * Autoplay is fully accessibility-governed — see useHeroCarousel.
 */
export default function HeroSlider() {
  const { sections, loading } = useHomepageSections('hero_slide');
  const slides = useMemo(
    () => (sections.length > 0 ? normalizeHeroSections(sections) : DEFAULT_HERO_SLIDES),
    [sections],
  );
  const carousel = useHeroCarousel({ count: slides.length });
  const [announced, setAnnounced] = useState('');
  const lastAutoIndex = useRef(carousel.index);

  // Announce user-driven slide changes politely; stay silent for autoplay
  // so screen readers are not interrupted every few seconds.
  useEffect(() => {
    if (lastAutoIndex.current !== carousel.index) {
      lastAutoIndex.current = carousel.index;
    }
    if (carousel.userPaused && slides[carousel.index]) {
      setAnnounced(`Slide ${carousel.index + 1} of ${slides.length}: ${slides[carousel.index].headline}`);
    }
  }, [carousel.index, carousel.userPaused, slides]);

  if (loading && sections.length === 0) {
    // First paint before CMS responds: dark full-bleed skeleton with the
    // same height rules as the real hero — no layout shift, no white flash.
    return (
      <section aria-busy="true" aria-label="Highlights" className="bg-[#071f22]">
        <div className="flex min-h-[600px] flex-col justify-end md:justify-center lg:min-h-[620px] xl:min-h-[680px]">
          <div className="mx-auto w-full max-w-7xl space-y-4 px-4 pb-28 pt-20 sm:px-6 md:px-8 md:pb-24 md:pt-24 lg:px-10">
            <div className="h-4 w-28 rounded bg-white/10" />
            <div className="h-9 w-3/4 max-w-xl rounded bg-white/20" />
            <div className="h-9 w-1/2 max-w-xl rounded bg-white/20" />
            <div className="h-5 w-full max-w-xl rounded bg-white/10" />
            <div className="h-12 w-44 rounded-xl bg-white/15" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={carousel.sectionRef}
      aria-label="Highlights"
      aria-roledescription="carousel"
      className="relative isolate overflow-hidden bg-[#071f22]"
      onMouseEnter={carousel.hoverProps.onMouseEnter}
      onMouseLeave={carousel.hoverProps.onMouseLeave}
      onFocusCapture={carousel.focusProps.onFocusCapture}
      onBlurCapture={carousel.focusProps.onBlurCapture}
      onTouchStart={carousel.swipeProps.onTouchStart}
      onTouchEnd={carousel.swipeProps.onTouchEnd}
    >
      {/* Page heading for document outline (slide headlines are h2). */}
      <h1 className="sr-only">PawTag — Pet identification and recovery</h1>
      <div aria-live="polite" className="sr-only">
        {announced}
      </div>

      {/*
        All slides occupy the same grid cell and crossfade via opacity; the
        grid row is as tall as the tallest slide's content, so the hero
        height never shifts between slides. Each slide stacks three layers:
        full-bleed media → readability scrim → content aligned to the
        site's max-w-7xl grid.
      */}
      <div className="relative grid">
        {slides.map((slide, i) => {
          const active = i === carousel.index;
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${i + 1} of ${slides.length}`}
              aria-hidden={!active}
              className={`relative col-start-1 row-start-1 transition-opacity duration-[600ms] ease-out ${
                active ? 'opacity-100' : 'pointer-events-none opacity-0'
              } ${carousel.reducedMotion ? 'transition-none' : ''}`}
            >
              <HeroSlideMedia slide={slide} eager={i === 0} />
              <div aria-hidden="true" className={`absolute inset-0 ${HERO_SCRIM_CLASS}`} />
              {/* Mobile: content sits low, clear of controls. Desktop: centered. */}
              <div className="relative flex min-h-[600px] flex-col justify-end md:justify-center lg:min-h-[620px] xl:min-h-[680px]">
                <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-20 sm:px-6 md:px-8 md:pb-24 md:pt-24 lg:px-10">
                  <div className="max-w-2xl">
                    <HeroSlideContent slide={slide} active={active} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Indicators lower-left, controls lower-right — same grid alignment.
          Desktop right-padding clears the emergency FAB's default bottom-right
          zone (fixed bottom-6 right-6, ~56px wide) on short laptop viewports. */}
      <div className="absolute inset-x-0 bottom-0 z-10">
        <div className="mx-auto max-w-7xl px-4 pb-5 sm:px-6 md:px-8 md:pb-7 md:pr-24 lg:px-10 lg:pr-24">
          <HeroSliderControls
            index={carousel.index}
            count={slides.length}
            onGoTo={carousel.goTo}
            onNext={carousel.next}
            onPrev={carousel.prev}
            userPaused={carousel.userPaused}
            onTogglePause={carousel.toggleUserPaused}
          />
        </div>
      </div>
    </section>
  );
}

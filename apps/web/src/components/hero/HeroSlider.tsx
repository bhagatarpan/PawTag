import { useEffect, useMemo, useRef, useState } from 'react';
import { useHomepageSections } from '../../hooks/useCms';
import { DEFAULT_HERO_SLIDES, normalizeHeroSections } from './hero-slides';
import { useHeroCarousel } from './useHeroCarousel';
import HeroSlideContent from './HeroSlideContent';
import HeroSlideMedia from './HeroSlideMedia';
import HeroSliderControls from './HeroSliderControls';

/**
 * Premium photography-led homepage hero carousel.
 *
 * CMS-managed (`hero_slide` homepage sections) with the three approved
 * default stories as fallback. Desktop uses an editorial split composition;
 * mobile stacks the (never-hidden) image above the content. Autoplay is
 * fully accessibility-governed — see useHeroCarousel for the pause rules.
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
    // First paint before CMS responds: stable skeleton, no layout shift.
    return (
      <section aria-busy="true" aria-label="Highlights" className="bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 md:py-16">
          <div className="grid items-center gap-8 md:grid-cols-12 md:gap-12">
            <div className="md:col-span-5 space-y-4">
              <div className="h-4 w-32 rounded bg-gray-100" />
              <div className="h-10 w-full rounded bg-gray-100" />
              <div className="h-10 w-3/4 rounded bg-gray-100" />
              <div className="h-5 w-full rounded bg-gray-100" />
              <div className="h-12 w-40 rounded-xl bg-gray-100" />
            </div>
            <div className="md:col-span-7">
              <div className="aspect-[4/3] w-full animate-pulse rounded-2xl md:rounded-3xl bg-gray-100" />
            </div>
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
      className="relative overflow-hidden bg-gradient-to-b from-primary-50/70 via-white to-white"
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

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 md:py-16 lg:py-20">
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
                className={`col-start-1 row-start-1 transition-opacity duration-[600ms] ease-out md:grid md:grid-cols-12 md:items-center md:gap-10 lg:gap-14 ${
                  active ? 'opacity-100' : 'pointer-events-none opacity-0'
                } ${carousel.reducedMotion ? 'transition-none' : ''}`}
              >
                {/* Mobile: image first (never hidden). Desktop: content left. */}
                <div className="order-1 md:order-2 md:col-span-7">
                  <HeroSlideMedia slide={slide} eager={i === 0} />
                </div>
                <div className="order-2 mt-8 md:order-1 md:col-span-5 md:mt-0">
                  <HeroSlideContent slide={slide} active={active} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 md:mt-10">
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

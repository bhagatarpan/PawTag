/**
 * Hero Slider - SwiperJS Implementation
 * 
 * Premium hero slider using SwiperJS for transitions, navigation, and accessibility.
 * Reads configuration from CMS settings and renders slides using shared HeroComponents.
 * 
 * Design tokens from DESIGN.md:
 * - Primary: #0d9488 (teal-600)
 * - Background: gradient from primary-700 via primary-600 to primary-800
 */

import { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation, EffectFade, Keyboard, A11y } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import 'swiper/css/effect-fade';

import { useHomepageSections, useSiteSettings } from '../../hooks/useCms';
import { Render } from '@puckeditor/core';
import { heroSliderConfig } from './heroSliderConfig';

// ─── Slide Data Interface ──────────────────────────────────────────

interface SlideData {
  id: number;
  tag: string;
  headline: string;
  sub: string;
  cta: { text: string; to: string };
  bg: string;
  visualType: string;
  stats: { number: string; label: string }[];
  flowSteps: { icon: string; label: string; desc: string }[];
  imageUrl: string;
  imageAlt: string;
  duration?: number;
  transition?: string;
}

// ─── Background Gradient Map ───────────────────────────────────────

const BG_GRADIENTS: Record<string, string> = {
  'from-primary-700 via-primary-600 to-primary-800': 'linear-gradient(135deg, #0f766e, #0d9488, #115e59)',
  'from-primary-800 via-primary-700 to-primary-600': 'linear-gradient(135deg, #115e59, #0f766e, #0d9488)',
  'from-primary-600 via-primary-700 to-primary-800': 'linear-gradient(135deg, #0d9488, #0f766e, #115e59)',
  'from-amber-600 via-amber-700 to-orange-600': 'linear-gradient(135deg, #d97706, #b45309, #ea580c)',
  'from-amber-500 via-yellow-500 to-amber-600': 'linear-gradient(135deg, #f59e0b, #eab308, #d97706)',
};

// ─── Main Component ────────────────────────────────────────────────

export default function HeroSlider() {
  const { sections, loading } = useHomepageSections('hero_slide');
  const { settings } = useSiteSettings();
  const [swiper, setSwiper] = useState<SwiperType | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Read slider settings from CMS
  const sliderSettings = {
    enabled: settings?.['heroSlider.enabled'] !== 'false',
    autoplay: settings?.['heroSlider.autoplay'] !== 'false',
    duration: parseInt(settings?.['heroSlider.duration'] || '5000'),
    pauseOnHover: settings?.['heroSlider.pauseOnHover'] !== 'false',
    transition: settings?.['heroSlider.transition'] || 'fade',
    speed: parseInt(settings?.['heroSlider.speed'] || '300'),
    loop: settings?.['heroSlider.loop'] === 'true',
    showArrows: settings?.['heroSlider.showArrows'] !== 'false',
    showPagination: settings?.['heroSlider.showPagination'] !== 'false',
    paginationType: settings?.['heroSlider.paginationType'] || 'bullets',
    keyboard: settings?.['heroSlider.keyboard'] !== 'false',
    touchSwipe: settings?.['heroSlider.touchSwipe'] !== 'false',
    respectReducedMotion: settings?.['heroSlider.respectReducedMotion'] !== 'false',
  };

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  // Map CMS sections to slide data
  const slides: SlideData[] = sections.map((section, i) => {
    const c = section.content as Record<string, unknown>;
    return {
      id: i + 1,
      tag: (c.tag as string) || section.title,
      headline: (c.headline as string) || section.title,
      sub: (c.sub as string) || section.subtitle || '',
      cta: {
        text: (c.ctaText as string) || 'Learn More',
        to: (c.ctaUrl as string) || '/shop',
      },
      bg: (c.bg as string) || 'from-primary-700 via-primary-600 to-primary-800',
      visualType: (c.visualType as string) || 'paw',
      stats: (c.stats as SlideData['stats']) || [],
      flowSteps: (c.flowSteps as SlideData['flowSteps']) || [],
      imageUrl: (c.imageUrl as string) || '',
      imageAlt: (c.imageAlt as string) || '',
      duration: (c.duration as number) || sliderSettings.duration,
      transition: (c.transition as string) || sliderSettings.transition,
    };
  });

  // Build Puck data from CMS content for each slide
  const buildPuckData = (section: any) => {
    const content = section.content as Record<string, unknown>;
    const components = (content?.components as any[]) || [];
    
    // If no components array, create from legacy format
    if (components.length === 0) {
      return {
        content: [
          ...(content?.tag ? [{ type: 'HeroBadge', props: { text: content.tag, variant: 'white' } }] : []),
          ...(content?.headline ? [{ type: 'HeroHeading', props: { text: content.headline, level: 'h1', color: 'white' } }] : []),
          ...(content?.sub ? [{ type: 'HeroText', props: { text: content.sub, size: 'lg', color: 'white/80' } }] : []),
          ...(content?.ctaText ? [{ type: 'HeroButton', props: { text: content.ctaText, url: content.ctaUrl || '/shop', variant: 'primary', openInNewTab: false } }] : []),
        ],
        root: {},
      };
    }
    
    return { content: components, root: {} };
  };

  if (!sliderSettings.enabled || loading || slides.length === 0) {
    return null;
  }

  return (
    <section
      className="relative"
      onMouseEnter={() => sliderSettings.pauseOnHover && setIsPaused(true)}
      onMouseLeave={() => sliderSettings.pauseOnHover && setIsPaused(false)}
    >
      <Swiper
        modules={[Autoplay, Pagination, Navigation, EffectFade, Keyboard, A11y]}
        effect={sliderSettings.transition as any}
        fadeEffect={{ crossFade: true }}
        speed={prefersReducedMotion ? 0 : sliderSettings.speed}
        loop={sliderSettings.loop}
        keyboard={sliderSettings.keyboard ? { enabled: true } : false}
        allowTouchMove={sliderSettings.touchSwipe}
        autoplay={
          sliderSettings.autoplay && !prefersReducedMotion
            ? {
                delay: sliderSettings.duration,
                disableOnInteraction: false,
                pauseOnMouseEnter: sliderSettings.pauseOnHover,
              }
            : false
        }
        pagination={
          sliderSettings.showPagination
            ? {
                clickable: true,
                type: sliderSettings.paginationType as any,
              }
            : false
        }
        navigation={sliderSettings.showArrows}
        onSwiper={setSwiper}
        className="hero-swiper"
      >
        {slides.map((slide, index) => (
          <SwiperSlide key={slide.id || index}>
            <div
              className="min-h-[500px] md:min-h-[600px] lg:min-h-[700px] flex items-center"
              style={{ background: BG_GRADIENTS[slide.bg] || BG_GRADIENTS['from-primary-700 via-primary-600 to-primary-800'] }}
            >
              <div className="w-full max-w-7xl mx-auto px-6 py-20 md:py-28 lg:py-36">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  {/* Text Content */}
                  <div className="space-y-6 animate-fade-in">
                    {sections[index] && (() => {
                      const puckData = buildPuckData(sections[index]);
                      return (
                        <div className="space-y-6">
                          <Render config={heroSliderConfig} data={puckData} />
                        </div>
                      );
                    })()}
                  </div>

                  {/* Visual Component */}
                  <div className="hidden lg:flex justify-center animate-fade-in" style={{ animationDelay: '0.2s' }}>
                    {sections[index] && (() => {
                      const puckData = buildPuckData(sections[index]);
                      return (
                        <div className="w-full max-w-md">
                          <Render config={heroSliderConfig} data={puckData} />
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Custom Navigation Arrows */}
      {sliderSettings.showArrows && (
        <>
          <button
            onClick={() => swiper?.slidePrev()}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            aria-label="Previous slide"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => swiper?.slideNext()}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            aria-label="Next slide"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </section>
  );
}

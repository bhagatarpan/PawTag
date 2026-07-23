import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, PawPrint, Scan, MapPin, Phone, UserCheck } from 'lucide-react';
import { useHomepageSections } from '../hooks/useCms';

interface SlideData {
  id: number;
  tag: string;
  headline: string;
  sub: string;
  cta: { text: string; to: string };
  bg: string;
}

const defaultSlides: SlideData[] = [
  {
    id: 1,
    tag: 'Emotional',
    headline: "They can't tell anyone where they live.",
    sub: "Let their tag do the talking.",
    cta: { text: 'Protect Your Pet', to: '/shop' },
    bg: 'from-primary-700 via-primary-600 to-primary-800',
  },
  {
    id: 2,
    tag: 'Functional',
    headline: 'Scan. Locate. Reunite.',
    sub: 'From lost to home in three simple steps.',
    cta: { text: 'Shop QR Tags', to: '/shop' },
    bg: 'from-primary-800 via-primary-700 to-primary-600',
  },
  {
    id: 3,
    tag: 'Trust',
    headline: 'Trusted by thousands of pet owners',
    sub: 'Join a community that never stops looking out for each other.',
    cta: { text: 'See How It Works', to: '/about' },
    bg: 'from-primary-600 via-primary-700 to-primary-800',
  },
];

function SlideVisual({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="relative flex items-center justify-center">
        <div className="w-64 h-64 md:w-80 md:h-80 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <PawPrint size={72} className="text-white/90 mx-auto mb-4" strokeWidth={1.5} />
            <p className="text-white/80 text-sm font-medium tracking-wide uppercase">Your best friend</p>
            <p className="text-white/60 text-xs mt-1">can't speak for themselves</p>
          </div>
        </div>
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
          <PawPrint size={24} className="text-white/40" />
        </div>
        <div className="absolute -bottom-6 -left-6 w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
          <PawPrint size={20} className="text-white/30" />
        </div>
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="flex items-center gap-3 md:gap-5">
        {[
          { icon: PawPrint, label: 'Finder', desc: 'Finds pet' },
          { icon: Scan, label: 'Scan', desc: 'Scans tag' },
          { icon: UserCheck, label: 'Profile', desc: 'Sees info' },
          { icon: Phone, label: 'Contact', desc: 'Calls owner' },
          { icon: MapPin, label: 'Reunited', desc: 'Pet home' },
        ].map((step, i) => (
          <div key={step.label} className="flex items-center">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <step.icon size={28} className="text-white" />
              </div>
              <p className="text-white font-semibold text-xs mt-2">{step.label}</p>
              <p className="text-white/60 text-[10px] mt-0.5">{step.desc}</p>
            </div>
            {i < 4 && (
              <div className="w-6 md:w-10 h-px bg-white/30 mx-1 mt-[-16px]" />
            )}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-4 md:gap-6">
      {[
        { num: '14K+', label: 'Pets Protected' },
        { num: '42', label: 'Reunited Today' },
        { num: '98%', label: 'Success Rate' },
      ].map((stat) => (
        <div key={stat.label} className="text-center p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15">
          <p className="text-3xl md:text-4xl font-bold text-white">{stat.num}</p>
          <p className="text-white/70 text-xs mt-1 font-medium">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

export default function HeroSlider() {
  const { sections } = useHomepageSections('hero_slide');
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const slides = sections.length > 0
    ? sections.map((s, i) => ({
        id: i + 1,
        tag: (s.content as Record<string, unknown>)?.tag as string || s.title,
        headline: (s.content as Record<string, unknown>)?.headline as string || s.title,
        sub: (s.content as Record<string, unknown>)?.sub as string || s.subtitle || '',
        cta: {
          text: (s.content as Record<string, unknown>)?.ctaText as string || 'Learn More',
          to: (s.content as Record<string, unknown>)?.ctaUrl as string || '/shop',
        },
        bg: (s.content as Record<string, unknown>)?.bg as string || 'from-primary-700 via-primary-600 to-primary-800',
      }))
    : defaultSlides;

  const goTo = useCallback((index: number) => {
    setCurrent((index + slides.length) % slides.length);
  }, [slides.length]);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [isPaused, next]);

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    setTouchStart(null);
  };

  const slide = slides[current] || defaultSlides[0];

  return (
    <section
      className={`relative bg-gradient-to-br ${slide.bg} overflow-hidden transition-all duration-700`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 lg:py-36">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div key={slide.id} className="animate-fade-in">
            <span className="inline-block px-3 py-1 rounded-full bg-white/15 text-white/90 text-xs font-semibold uppercase tracking-wider mb-6 backdrop-blur-sm">
              {slide.tag}
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
              {slide.headline}
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-8 max-w-lg">{slide.sub}</p>
            <Link
              to={slide.cta.to}
              className="inline-flex items-center gap-2 bg-white text-primary-700 px-8 py-3.5 rounded-xl font-semibold hover:bg-primary-50 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02]"
            >
              {slide.cta.text}
              <ChevronRight size={18} />
            </Link>
          </div>

          <div key={`vis-${slide.id}`} className="hidden md:flex justify-center animate-fade-in">
            <SlideVisual index={current % 3} />
          </div>
        </div>
      </div>

      {/* Nav arrows */}
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/25 transition-colors"
        aria-label="Previous slide"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/25 transition-colors"
        aria-label="Next slide"
      >
        <ChevronRight size={20} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_: unknown, i: number) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              i === current ? 'bg-white w-8' : 'bg-white/40 hover:bg-white/60'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
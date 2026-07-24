import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, PawPrint, Scan, MapPin, Phone, UserCheck, Award, Camera, Syringe, ClipboardCheck, Star, Sparkles, Shield, ShieldCheck, Lock, Eye, Heart, Tag, Home, Search, Bell, Check, QrCode, Smartphone, Users } from 'lucide-react';
import { useHomepageSections, useSiteSettings } from '../hooks/useCms';

const iconMap: Record<string, typeof PawPrint> = { PawPrint, Scan, MapPin, Phone, UserCheck, Award, Camera, Syringe, ClipboardCheck, Star, Sparkles, Shield, ShieldCheck, Lock, Eye, Heart, Tag, Home, Search, Bell, Check, QrCode, Smartphone, Users };

interface SlideData {
  id: number;
  tag: string;
  headline: string;
  sub: string;
  cta: { text: string; to: string };
  bg: string;
  visualType: 'paw' | 'flow' | 'stats' | 'image' | 'pet_profiles' | 'qr_code' | 'phone_scan' | 'trust_badges' | 'testimonials' | 'location' | 'awards' | 'heart';
  stats: { number: string; label: string }[];
  flowSteps: { icon: string; label: string; desc: string }[];
  imageUrl: string;
  imageAlt: string;
}

const defaultSlides: SlideData[] = [
  {
    id: 1,
    tag: 'Emotional',
    headline: "They can't tell anyone where they live.",
    sub: "Let their tag do the talking.",
    cta: { text: 'Protect Your Pet', to: '/shop' },
    bg: 'from-primary-700 via-primary-600 to-primary-800',
    visualType: 'paw',
    stats: [],
    flowSteps: [],
    imageUrl: '',
    imageAlt: '',
  },
  {
    id: 2,
    tag: 'Functional',
    headline: 'Scan. Locate. Reunite.',
    sub: 'From lost to home in three simple steps.',
    cta: { text: 'Shop QR Tags', to: '/shop' },
    bg: 'from-primary-800 via-primary-700 to-primary-600',
    visualType: 'flow',
    stats: [],
    flowSteps: [
      { icon: 'PawPrint', label: 'Finder', desc: 'Finds pet' },
      { icon: 'Scan', label: 'Scan', desc: 'Scans tag' },
      { icon: 'UserCheck', label: 'Profile', desc: 'Sees info' },
      { icon: 'Phone', label: 'Contact', desc: 'Calls owner' },
      { icon: 'MapPin', label: 'Reunited', desc: 'Pet home' },
    ],
    imageUrl: '',
    imageAlt: '',
  },
  {
    id: 3,
    tag: 'Trust',
    headline: 'Trusted by thousands of pet owners',
    sub: 'Join a community that never stops looking out for each other.',
    cta: { text: 'See How It Works', to: '/about' },
    bg: 'from-primary-600 via-primary-700 to-primary-800',
    visualType: 'stats',
    stats: [
      { number: '14K+', label: 'Pets Protected' },
      { number: '42', label: 'Reunited Today' },
      { number: '98%', label: 'Success Rate' },
    ],
    flowSteps: [],
    imageUrl: '',
    imageAlt: '',
  },
];

function SlideVisual({ slide, companyName }: { slide: SlideData; companyName: string }) {
  // Custom image
  if (slide.visualType === 'image' && slide.imageUrl) {
    return (
      <div className="flex items-center justify-center">
        <img src={slide.imageUrl} alt={slide.imageAlt || slide.headline} className="max-w-full max-h-80 rounded-2xl shadow-2xl object-cover" />
      </div>
    );
  }

  // Flow steps
  if (slide.visualType === 'flow' && slide.flowSteps.length > 0) {
    return (
      <div className="flex items-center gap-3 md:gap-5 flex-wrap justify-center">
        {slide.flowSteps.map((step, i) => {
          const Icon = iconMap[step.icon] || PawPrint;
          return (
            <div key={step.label} className="flex items-center">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <Icon size={28} className="text-white" />
                </div>
                <p className="text-white font-semibold text-xs mt-2">{step.label}</p>
                <p className="text-white/60 text-[10px] mt-0.5">{step.desc}</p>
              </div>
              {i < slide.flowSteps.length - 1 && (
                <div className="w-6 md:w-10 h-px bg-white/30 mx-1 mt-[-16px]" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Stats
  if (slide.visualType === 'stats' && slide.stats.length > 0) {
    return (
      <div className={`grid gap-4 md:gap-6 ${slide.stats.length === 2 ? 'grid-cols-2' : slide.stats.length >= 3 ? 'grid-cols-3' : 'grid-cols-1'}`}>
        {slide.stats.map((stat) => (
          <div key={stat.label} className="text-center p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15">
            <p className="text-3xl md:text-4xl font-bold text-white">{stat.number}</p>
            <p className="text-white/70 text-xs mt-1 font-medium">{stat.label}</p>
          </div>
        ))}
      </div>
    );
  }

  // Pet Profiles
  if (slide.visualType === 'pet_profiles') {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[
          { name: 'Buddy', breed: 'Golden Retriever', status: 'Protected', icon: '🐾' },
          { name: 'Luna', breed: 'Tabby Cat', status: 'Protected', icon: '🐱' },
          { name: 'Max', breed: 'Labrador', status: 'Active', icon: '🐕' },
          { name: 'Bella', breed: 'Cocker Spaniel', status: 'Protected', icon: '🐶' },
        ].map((pet) => (
          <div key={pet.name} className="bg-white/15 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
                {pet.icon}
              </div>
              <div>
                <p className="text-white font-bold text-sm">{pet.name}</p>
                <p className="text-white/60 text-xs">{pet.breed}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <Check size={12} className="text-green-400" />
              <span className="text-green-400 text-xs font-medium">{pet.status}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // QR Code Showcase
  if (slide.visualType === 'qr_code') {
    return (
      <div className="flex items-center justify-center">
        <div className="bg-white rounded-3xl p-6 shadow-2xl">
          <div className="w-48 h-48 bg-gray-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-300">
            <div className="text-center">
              <QrCode size={64} className="text-gray-400 mx-auto mb-2" />
              <p className="text-gray-400 text-xs">QR Code</p>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-gray-900 font-bold text-sm">Scan to Reunite</p>
            <p className="text-gray-500 text-xs">No app needed</p>
          </div>
        </div>
      </div>
    );
  }

  // Phone Scan Action
  if (slide.visualType === 'phone_scan') {
    return (
      <div className="flex items-center justify-center gap-6">
        <div className="bg-white/15 backdrop-blur-sm rounded-3xl p-4 border border-white/20">
          <Smartphone size={48} className="text-white" />
        </div>
        <div className="w-8 h-px bg-white/40" />
        <div className="bg-white/15 backdrop-blur-sm rounded-3xl p-4 border border-white/20">
          <Scan size={48} className="text-white" />
        </div>
        <div className="w-8 h-px bg-white/40" />
        <div className="bg-white/15 backdrop-blur-sm rounded-3xl p-4 border border-white/20">
          <PawPrint size={48} className="text-white" />
        </div>
      </div>
    );
  }

  // Trust & Safety Badges
  if (slide.visualType === 'trust_badges') {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[
          { icon: ShieldCheck, label: 'Encrypted', desc: 'Bank-level security' },
          { icon: Lock, label: 'Private', desc: 'You control sharing' },
          { icon: Eye, label: 'Transparent', desc: 'Full visibility' },
          { icon: Award, label: 'Trusted', desc: '14K+ pet owners' },
        ].map((badge) => (
          <div key={badge.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/15 text-center">
            <badge.icon size={28} className="text-white mx-auto mb-2" />
            <p className="text-white font-bold text-sm">{badge.label}</p>
            <p className="text-white/60 text-xs">{badge.desc}</p>
          </div>
        ))}
      </div>
    );
  }

  // Customer Testimonials
  if (slide.visualType === 'testimonials') {
    return (
      <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-6 border border-white/20 max-w-md">
        <div className="flex items-center gap-1 mb-3">
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={14} className="text-amber-400 fill-amber-400" />
          ))}
        </div>
        <p className="text-white/90 text-sm italic mb-4">"My dog got out last month. A neighbor scanned his {companyName} and I had him back within 20 minutes."</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">SM</div>
          <div>
            <p className="text-white font-semibold text-sm">Sarah M.</p>
            <p className="text-white/60 text-xs">Owner of a Golden Retriever</p>
          </div>
        </div>
      </div>
    );
  }

  // Location Sharing
  if (slide.visualType === 'location') {
    return (
      <div className="relative">
        <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-4">
            <MapPin size={24} className="text-white" />
            <div>
              <p className="text-white font-bold text-sm">Live Location Sharing</p>
              <p className="text-white/60 text-xs">GPS coordinates sent instantly</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-white font-bold">-36.8485</p>
              <p className="text-white/60 text-xs">Latitude</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <p className="text-white font-bold">174.7633</p>
              <p className="text-white/60 text-xs">Longitude</p>
            </div>
          </div>
        </div>
        <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
          <MapPin size={20} className="text-white" />
        </div>
      </div>
    );
  }

  // Awards & Achievements
  if (slide.visualType === 'awards') {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Award, label: 'Top Rated', color: 'bg-amber-500' },
          { icon: Star, label: '5-Star', color: 'bg-yellow-500' },
          { icon: Sparkles, label: 'Featured', color: 'bg-purple-500' },
        ].map((award) => (
          <div key={award.label} className="text-center">
            <div className={`w-16 h-16 rounded-full ${award.color} flex items-center justify-center mx-auto mb-2 shadow-lg`}>
              <award.icon size={28} className="text-white" />
            </div>
            <p className="text-white font-semibold text-xs">{award.label}</p>
          </div>
        ))}
      </div>
    );
  }

  // Heart & Emotional
  if (slide.visualType === 'heart') {
    return (
      <div className="flex items-center justify-center">
        <div className="relative">
          <div className="w-48 h-48 rounded-full bg-white/10 flex items-center justify-center">
            <Heart size={80} className="text-white/90 fill-white/30" />
          </div>
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/15 flex items-center justify-center">
            <PawPrint size={28} className="text-white" />
          </div>
          <div className="absolute -bottom-2 -left-2 w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">
            <Heart size={20} className="text-white fill-white/50" />
          </div>
        </div>
      </div>
    );
  }

  // Default: paw visual
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

export default function HeroSlider() {
  const { sections } = useHomepageSections('hero_slide');
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const slides: SlideData[] = sections.length > 0
    ? sections.map((s, i) => {
        const c = s.content as Record<string, unknown>;
        return {
          id: i + 1,
          tag: (c.tag as string) || s.title,
          headline: (c.headline as string) || s.title,
          sub: (c.sub as string) || s.subtitle || '',
          cta: {
            text: (c.ctaText as string) || 'Learn More',
            to: (c.ctaUrl as string) || '/shop',
          },
          bg: (c.bg as string) || 'from-primary-700 via-primary-600 to-primary-800',
          visualType: (c.visualType as SlideData['visualType']) || 'paw',
          stats: (c.stats as SlideData['stats']) || [],
          flowSteps: (c.flowSteps as SlideData['flowSteps']) || [],
          imageUrl: (c.imageUrl as string) || '',
          imageAlt: (c.imageAlt as string) || '',
        };
      })
    : defaultSlides;

  const duration = sections.length > 0
    ? ((sections[0].content as Record<string, unknown>)?.duration as number) || 5
    : 5;

  const goTo = useCallback((index: number) => {
    setCurrent((index + slides.length) % slides.length);
  }, [slides.length]);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(next, duration * 1000);
    return () => clearInterval(timer);
  }, [isPaused, next, duration]);

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
            <SlideVisual slide={slide} companyName={companyName} />
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

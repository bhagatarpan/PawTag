/**
 * Hero Slider Component Definitions
 * 
 * Shared component definitions for both admin (Puck editor) and public (SwiperJS renderer).
 * Single source of truth for all hero slide components.
 * 
 * Design tokens from DESIGN.md:
 * - Primary: #0d9488 (teal-600)
 * - Gradients: teal-600 → teal-700
 * - Font: system-ui stack
 */

import { Link } from 'react-router-dom';
import {
  PawPrint, Scan, MapPin, Phone, UserCheck, Award, Camera,
  Shield, ShieldCheck, Lock, Eye, Heart, Tag, Home, Search,
  Bell, Check, QrCode, Smartphone, Users, Star, Sparkles,
  Syringe, ClipboardCheck
} from 'lucide-react';

// ─── Icon Map ──────────────────────────────────────────────────────

export const heroIconMap: Record<string, typeof PawPrint> = {
  PawPrint, Scan, MapPin, Phone, UserCheck, Award, Camera,
  Shield, ShieldCheck, Lock, Eye, Heart, Tag, Home, Search,
  Bell, Check, QrCode, Smartphone, Users, Star, Sparkles,
  Syringe, ClipboardCheck,
};

// ─── Hero Heading Component ────────────────────────────────────────

export interface HeroHeadingProps {
  text: string;
  level?: 'h1' | 'h2' | 'h3';
  color?: 'white' | 'gray-900';
  className?: string;
}

export function HeroHeading({ text, level = 'h1', color = 'white', className = '' }: HeroHeadingProps) {
  const Tag = level;
  const colorClass = color === 'white' ? 'text-white' : 'text-gray-900';
  const sizeClass = { h1: 'text-4xl md:text-5xl lg:text-6xl', h2: 'text-3xl md:text-4xl', h3: 'text-2xl md:text-3xl' }[level];
  
  return (
    <Tag className={`${sizeClass} font-bold ${colorClass} leading-tight ${className}`}>
      {text}
    </Tag>
  );
}

// ─── Hero Text Component ───────────────────────────────────────────

export interface HeroTextProps {
  text: string;
  size?: 'sm' | 'base' | 'lg';
  color?: 'white' | 'white/80' | 'gray-600';
  className?: string;
}

export function HeroText({ text, size = 'lg', color = 'white/80', className = '' }: HeroTextProps) {
  const sizeClass = { sm: 'text-sm', base: 'text-base', lg: 'text-lg md:text-xl' }[size];
  const colorClass = `text-${color}`;
  
  return (
    <p className={`${sizeClass} ${colorClass} leading-relaxed ${className}`}>
      {text}
    </p>
  );
}

// ─── Hero Button Component ─────────────────────────────────────────

export interface HeroButtonProps {
  text: string;
  url: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: string;
  openInNewTab?: boolean;
}

export function HeroButton({ text, url, variant = 'primary', icon, openInNewTab }: HeroButtonProps) {
  const variantClasses = {
    primary: 'bg-white text-primary-700 hover:bg-gray-100',
    secondary: 'bg-primary-500 text-white hover:bg-primary-600 border border-primary-400',
    ghost: 'bg-transparent text-white border border-white/30 hover:bg-white/10',
  };
  
  const IconComponent = icon ? heroIconMap[icon] : null;
  
  return (
    <Link
      to={url}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noopener noreferrer' : undefined}
      className={`inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-base transition-all ${variantClasses[variant]}`}
    >
      {IconComponent && <IconComponent className="h-5 w-5" />}
      {text}
      {!IconComponent && <span className="ml-1">→</span>}
    </Link>
  );
}

// ─── Hero Badge Component ──────────────────────────────────────────

export interface HeroBadgeProps {
  text: string;
  variant?: 'teal' | 'amber' | 'green' | 'white';
}

export function HeroBadge({ text, variant = 'white' }: HeroBadgeProps) {
  const variantClasses = {
    teal: 'bg-primary-500/20 text-primary-100 border-primary-400/30',
    amber: 'bg-amber-500/20 text-amber-100 border-amber-400/30',
    green: 'bg-green-500/20 text-green-100 border-green-400/30',
    white: 'bg-white/15 text-white border-white/20',
  };
  
  return (
    <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border backdrop-blur-sm ${variantClasses[variant]}`}>
      {text}
    </span>
  );
}

// ─── Hero Image Component ──────────────────────────────────────────

export interface HeroImageProps {
  url: string;
  alt: string;
  width?: 'full' | 'large' | 'medium';
  rounded?: boolean;
}

export function HeroImage({ url, alt, width = 'large', rounded = true }: HeroImageProps) {
  const widthClass = { full: 'w-full', large: 'max-w-lg', medium: 'max-w-md' }[width];
  const roundedClass = rounded ? 'rounded-2xl' : '';
  
  return (
    <div className="flex items-center justify-center">
      <img
        src={url}
        alt={alt}
        className={`${widthClass} ${roundedClass} shadow-2xl object-cover`}
        loading="lazy"
      />
    </div>
  );
}

// ─── Hero Stats Component ──────────────────────────────────────────

export interface HeroStatsProps {
  items: { number: string; label: string }[];
}

export function HeroStats({ items }: HeroStatsProps) {
  const gridCols = items.length <= 2 ? 'grid-cols-2' : 'grid-cols-3';
  
  return (
    <div className={`grid ${gridCols} gap-4`}>
      {items.map((stat, i) => (
        <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/10">
          <p className="text-2xl md:text-3xl font-bold text-white">{stat.number}</p>
          <p className="text-xs text-white/70 mt-1 uppercase tracking-wide">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Hero Flow Component ───────────────────────────────────────────

export interface HeroFlowProps {
  steps: { icon: string; label: string; desc: string }[];
}

export function HeroFlow({ steps }: HeroFlowProps) {
  return (
    <div className="flex items-center gap-3 md:gap-5 flex-wrap justify-center">
      {steps.map((step, i) => {
        const Icon = heroIconMap[step.icon] || PawPrint;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <Icon className="h-7 w-7 md:h-8 md:w-8 text-white" />
              </div>
              <p className="text-white font-semibold text-xs mt-2">{step.label}</p>
              <p className="text-white/60 text-[10px]">{step.desc}</p>
            </div>
            {i < steps.length - 1 && (
              <div className="hidden md:block w-8 h-px bg-white/30 mx-2" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Hero Pet Profiles Component ───────────────────────────────────

export interface HeroPetProfilesProps {
  pets?: { name: string; breed: string }[];
}

const defaultPets = [
  { name: 'Buddy', breed: 'Golden Retriever' },
  { name: 'Luna', breed: 'Siamese Cat' },
  { name: 'Max', breed: 'German Shepherd' },
  { name: 'Bella', breed: 'Labrador' },
];

export function HeroPetProfiles({ pets = defaultPets }: HeroPetProfilesProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {pets.slice(0, 4).map((pet, i) => (
        <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <PawPrint className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{pet.name}</p>
              <p className="text-white/60 text-xs">{pet.breed}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <Check className="h-3 w-3 text-green-400" />
            <span className="text-green-400 text-[10px] font-medium">Protected</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Hero QR Code Component ────────────────────────────────────────

export interface HeroQRCodeProps {
  tagId?: string;
}

export function HeroQRCode({ tagId = 'PT-XXXXXXXX' }: HeroQRCodeProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-xs mx-auto">
      <div className="w-40 h-40 mx-auto border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center">
        <QrCode className="h-16 w-16 text-gray-400" />
      </div>
      <p className="text-center text-gray-600 font-semibold mt-4">Scan to Reunite</p>
      <p className="text-center text-gray-400 text-xs mt-1">{tagId}</p>
    </div>
  );
}

// ─── Hero Phone Scan Component ─────────────────────────────────────

export interface HeroPhoneScanProps {}

export function HeroPhoneScan({}: HeroPhoneScanProps) {
  return (
    <div className="flex items-center gap-4 md:gap-6">
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
          <Smartphone className="h-8 w-8 text-white" />
        </div>
        <p className="text-white text-xs mt-2 font-medium">Phone</p>
      </div>
      <div className="w-8 h-px bg-white/30" />
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
          <Scan className="h-8 w-8 text-white" />
        </div>
        <p className="text-white text-xs mt-2 font-medium">Scan</p>
      </div>
      <div className="w-8 h-px bg-white/30" />
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
          <PawPrint className="h-8 w-8 text-white" />
        </div>
        <p className="text-white text-xs mt-2 font-medium">Reunite</p>
      </div>
    </div>
  );
}

// ─── Hero Trust Badges Component ───────────────────────────────────

export interface HeroTrustBadgesProps {}

export function HeroTrustBadges({}: HeroTrustBadgesProps) {
  const badges = [
    { icon: ShieldCheck, label: 'Encrypted' },
    { icon: Lock, label: 'Private' },
    { icon: Eye, label: 'Transparent' },
    { icon: Award, label: 'Trusted' },
  ];
  
  return (
    <div className="grid grid-cols-2 gap-3">
      {badges.map((badge, i) => (
        <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
          <badge.icon className="h-6 w-6 text-white mx-auto" />
          <p className="text-white text-xs mt-1 font-medium">{badge.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Hero Testimonial Component ────────────────────────────────────

export interface HeroTestimonialProps {
  quote?: string;
  author?: string;
  rating?: number;
}

export function HeroTestimonial({ 
  quote = '"PawTag gave us peace of mind. When our cat went missing, we were reunited within hours."',
  author = 'Sarah M.',
  rating = 5 
}: HeroTestimonialProps) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 max-w-sm">
      <div className="flex gap-1 mb-3">
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />
        ))}
      </div>
      <p className="text-white/90 text-sm italic leading-relaxed">{quote}</p>
      <div className="flex items-center gap-2 mt-4">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <span className="text-white text-xs font-semibold">{author.charAt(0)}</span>
        </div>
        <p className="text-white/70 text-xs">{author}</p>
      </div>
    </div>
  );
}

// ─── Hero Location Component ───────────────────────────────────────

export interface HeroLocationProps {
  lat?: number;
  lng?: number;
}

export function HeroLocation({ lat = -36.8485, lng = 174.7633 }: HeroLocationProps) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 text-center">
      <div className="relative inline-block">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
          <MapPin className="h-8 w-8 text-red-400" />
        </div>
        <div className="absolute inset-0 rounded-full bg-red-400/30 animate-ping" />
      </div>
      <p className="text-white font-semibold mt-4">Live Location</p>
      <p className="text-white/60 text-xs mt-1 font-mono">{lat.toFixed(4)}, {lng.toFixed(4)}</p>
    </div>
  );
}

// ─── Hero Awards Component ─────────────────────────────────────────

export interface HeroAwardsProps {}

export function HeroAwards({}: HeroAwardsProps) {
  const awards = [
    { icon: Award, label: 'Top Rated', color: 'bg-amber-500/20 text-amber-400' },
    { icon: Star, label: '5-Star', color: 'bg-yellow-500/20 text-yellow-400' },
    { icon: Sparkles, label: 'Featured', color: 'bg-purple-500/20 text-purple-400' },
  ];
  
  return (
    <div className="flex gap-4">
      {awards.map((award, i) => (
        <div key={i} className="flex flex-col items-center">
          <div className={`w-16 h-16 rounded-full ${award.color} flex items-center justify-center border border-white/10`}>
            <award.icon className="h-7 w-7" />
          </div>
          <p className="text-white text-xs mt-2 font-medium">{award.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Hero Heart Component ──────────────────────────────────────────

export interface HeroHeartProps {}

export function HeroHeart({}: HeroHeartProps) {
  return (
    <div className="relative w-48 h-48 mx-auto">
      <div className="absolute inset-0 rounded-full bg-white/10 flex items-center justify-center">
        <Heart className="h-20 w-20 text-white/80" />
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <PawPrint className="h-10 w-10 text-white" />
      </div>
      <div className="absolute -top-2 -right-2 w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center border border-pink-400/30">
        <Heart className="h-5 w-5 text-pink-400" />
      </div>
    </div>
  );
}

// ─── Hero Paw (Default) Component ──────────────────────────────────

export interface HeroPawProps {
  companyName?: string;
}

export function HeroPaw({ companyName = 'PawTag' }: HeroPawProps) {
  return (
    <div className="relative w-64 h-64 mx-auto">
      <div className="absolute inset-0 rounded-full bg-white/10 flex items-center justify-center">
        <PawPrint className="h-24 w-24 text-white/80" />
      </div>
      <div className="absolute top-4 right-4 w-16 h-16 rounded-full bg-white/15 flex items-center justify-center border border-white/20">
        <Tag className="h-7 w-7 text-white" />
      </div>
      <p className="text-white/60 text-center text-xs mt-4 font-medium">
        Your best friend can't speak for themselves.
      </p>
    </div>
  );
}

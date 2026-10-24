import type { ReactNode } from 'react';

export interface PhotoHeroProps {
  /** Image source (pet photo, product photo). Decorative when title conveys all. */
  src: string;
  alt: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Content under the title (status pills, actions). */
  children?: ReactNode;
  /** Tailwind aspect classes; override per surface (dashboard, pet, product). */
  aspectClassName?: string;
  /** Bottom gradient for text contrast — keep on whenever text overlays the photo. */
  gradient?: boolean;
  className?: string;
}

/**
 * Photography-led header per the mobile concept boards: full-bleed image,
 * bottom scrim, white title/subtitle overlay, optional content row.
 * Callers control placement in the page (rounded card vs full bleed) via
 * `className`/`aspectClassName`.
 */
export function PhotoHero({
  src,
  alt,
  title,
  subtitle,
  children,
  aspectClassName = 'aspect-[4/3] sm:aspect-[16/7]',
  gradient = true,
  className = '',
}: PhotoHeroProps) {
  return (
    <div className={`relative overflow-hidden bg-gray-100 ${aspectClassName} ${className}`}>
      <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      {gradient && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent"
        />
      )}
      <div className="relative flex h-full flex-col justify-end gap-1 p-4 sm:p-6">
        {title && <div className="text-xl font-bold text-white sm:text-2xl">{title}</div>}
        {subtitle && <div className="text-sm text-white/90">{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}

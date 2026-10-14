import { useState } from 'react';
import { PawPrint } from 'lucide-react';
import {
  HERO_FALLBACK_GRADIENT_CLASS,
  HERO_FOCAL_CLASSES,
  type HeroSlideModel,
} from './hero.types';

/**
 * Responsive hero imagery with a polished brand fallback.
 *
 * - Desktop and mobile images render as purpose-specific <img> elements
 *   (a mobile crop is never a scaled desktop image; a desktop image is the
 *   fallback when no mobile crop exists).
 * - The active first slide loads eagerly (potential LCP element); every
 *   other image is lazy + async-decoded.
 * - The aspect-ratio container guarantees zero layout shift.
 * - Any load/decode error falls back to the teal gradient + paw watermark —
 *   never a broken-image icon, never stock photography.
 */
export default function HeroSlideMedia({
  slide,
  eager,
}: {
  slide: HeroSlideModel;
  eager: boolean;
}) {
  const [failed, setFailed] = useState<{ desktop: boolean; mobile: boolean }>({
    desktop: false,
    mobile: false,
  });
  const focal = HERO_FOCAL_CLASSES[slide.focalPoint];
  const desktopUrl = slide.desktopImageUrl;
  const mobileUrl = slide.mobileImageUrl || slide.desktopImageUrl;
  const alt = slide.imageAlt; // empty = decorative

  const showMobileImage = Boolean(mobileUrl) && !failed.mobile;
  const showDesktopImage = Boolean(desktopUrl) && !failed.desktop;

  return (
    <div className={`relative aspect-[4/3] w-full overflow-hidden rounded-2xl md:rounded-3xl ${HERO_FALLBACK_GRADIENT_CLASS} shadow-lg ring-1 ring-gray-900/5`}>
      {showMobileImage && (
        <img
          key={`m-${mobileUrl}`}
          src={mobileUrl}
          alt={alt}
          aria-hidden={alt ? undefined : true}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed((state) => ({ ...state, mobile: true }))}
          className={`md:hidden absolute inset-0 h-full w-full object-cover ${focal}`}
        />
      )}
      {showDesktopImage && (
        <img
          key={`d-${desktopUrl}`}
          src={desktopUrl}
          alt={alt}
          aria-hidden={alt ? undefined : true}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed((state) => ({ ...state, desktop: true }))}
          className={`hidden md:block absolute inset-0 h-full w-full object-cover ${focal}`}
        />
      )}
      {!showMobileImage && (
        <div className="md:hidden absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <PawPrint className="h-2/5 w-2/5 text-white/15" strokeWidth={1} />
        </div>
      )}
      {!showDesktopImage && (
        <div className="hidden md:flex absolute inset-0 items-center justify-center" aria-hidden="true">
          <PawPrint className="h-2/5 w-2/5 text-white/15" strokeWidth={1} />
        </div>
      )}
    </div>
  );
}

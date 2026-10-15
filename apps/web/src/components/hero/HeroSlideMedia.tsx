import { useState } from 'react';
import {
  HERO_FALLBACK_GRADIENT_CLASS,
  HERO_FOCAL_CLASSES,
  HERO_FOCAL_DESKTOP_CLASSES,
  type HeroSlideModel,
} from './hero.types';

/**
 * Full-bleed hero media layer — fills its slide's entire canvas
 * (absolute inset-0; no box, no rounding, no watermark).
 *
 * - A single <picture> selects the purpose-made mobile crop below 768px and
 *   the desktop image above it; the desktop image also serves viewports with
 *   no mobile crop. Only one image is downloaded per slide.
 * - Object-position follows the selected image: the mobile crop uses the
 *   mobile focal point below 768px, the desktop image uses the desktop
 *   focal point above (separate CMS controls; the mobile focal falls back
 *   to the desktop one on legacy records).
 * - The first slide loads eagerly with high fetch priority (LCP element);
 *   every later slide is lazy + async-decoded.
 * - Until photography exists — or if a load/decode fails — the deep
 *   teal→charcoal gradient fills the whole canvas. Never broken-image
 *   icons, never stock photography.
 */
export default function HeroSlideMedia({
  slide,
  eager,
}: {
  slide: HeroSlideModel;
  eager: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const mobileFocal = HERO_FOCAL_CLASSES[slide.mobileFocalPoint];
  const desktopFocal = HERO_FOCAL_DESKTOP_CLASSES[slide.focalPoint];
  const desktopUrl = slide.desktopImageUrl;
  const mobileUrl = slide.mobileImageUrl;
  const alt = slide.imageAlt; // empty = decorative

  return (
    <div data-testid="hero-media" className={`absolute inset-0 ${HERO_FALLBACK_GRADIENT_CLASS}`}>
      {!failed && desktopUrl && (
        <picture>
          {mobileUrl && <source media="(max-width: 767px)" srcSet={mobileUrl} />}
          <img
            src={desktopUrl}
            alt={alt}
            aria-hidden={alt ? undefined : true}
            loading={eager ? 'eager' : 'lazy'}
            // Lowercase spread: React 18 passes unknown lowercase attributes
            // through untouched (the camelCase fetchPriority prop lands in
            // React 19). Marks the first slide as the LCP candidate.
            {...(eager ? ({ fetchpriority: 'high' } as Record<string, string>) : {})}
            decoding="async"
            onError={() => setFailed(true)}
            className={`h-full w-full object-cover ${mobileFocal} ${desktopFocal}`}
          />
        </picture>
      )}
    </div>
  );
}

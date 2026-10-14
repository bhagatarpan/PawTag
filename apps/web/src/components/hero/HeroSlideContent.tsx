import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { resolveHeroLink } from './hero-links';
import type { HeroCta, HeroSlideModel } from './hero.types';

/** Safe fallback for an invalid primary CTA destination. */
const PRIMARY_FALLBACK_ROUTE = '/shop';

function HeroCtaLink({
  cta,
  variant,
  fallbackTo,
  active,
}: {
  cta: HeroCta;
  variant: 'primary' | 'secondary';
  fallbackTo?: string;
  active: boolean;
}) {
  const resolved = resolveHeroLink(cta.href, fallbackTo);
  if (resolved.kind === 'none') return null;

  const classes =
    variant === 'primary'
      ? 'inline-flex items-center justify-center gap-2 min-h-[48px] bg-primary-600 text-white px-7 py-3 rounded-xl font-semibold hover:bg-primary-700 active:bg-primary-800 transition-colors shadow-sm'
      : 'inline-flex items-center justify-center gap-2 min-h-[48px] border border-primary-600 text-primary-600 px-6 py-3 rounded-xl font-semibold hover:bg-primary-50 transition-colors';

  // Only the active slide's CTAs are reachable by keyboard.
  const focusability = active ? undefined : ({ tabIndex: -1 } as const);

  if (resolved.kind === 'external') {
    return (
      <a href={resolved.href} className={classes} rel="noopener noreferrer" target="_blank" {...focusability}>
        {cta.label}
        {variant === 'primary' && <ChevronRight size={18} aria-hidden="true" />}
      </a>
    );
  }

  // After the external branch, `resolved` is internal or fallback — both carry `.to`.
  const to = resolved.to;
  const fallbackNote = resolved.kind === 'fallback' ? { title: 'Link unavailable — taking you to our shop' } : undefined;
  return (
    <Link to={to} className={classes} {...fallbackNote} {...focusability}>
      {cta.label}
      {variant === 'primary' && <ChevronRight size={18} aria-hidden="true" />}
    </Link>
  );
}

/**
 * Text content for one hero slide. Always real HTML — never baked into an
 * image — so it stays accessible, editable in the CMS, and readable by
 * search engines.
 */
export default function HeroSlideContent({
  slide,
  active,
}: {
  slide: HeroSlideModel;
  active: boolean;
}) {
  return (
    <div className="flex flex-col items-start">
      {slide.eyebrow && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary-700">
          {slide.eyebrow}
        </p>
      )}
      <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-[3.4rem] font-extrabold tracking-tight text-gray-900 leading-[1.1]">
        {slide.headline}
      </h2>
      {slide.sub && (
        <p className="mt-4 max-w-xl text-base sm:text-lg text-gray-600 leading-relaxed">
          {slide.sub}
        </p>
      )}
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <HeroCtaLink cta={slide.primaryCta} variant="primary" fallbackTo={PRIMARY_FALLBACK_ROUTE} active={active} />
        {slide.secondaryCta && <HeroCtaLink cta={slide.secondaryCta} variant="secondary" active={active} />}
      </div>
    </div>
  );
}

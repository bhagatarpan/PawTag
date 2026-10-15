import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

/**
 * Hero navigation layered over the photographic canvas: bar-style slide
 * indicators (lower-left), pause/play + prev/next (lower-right on desktop,
 * clustered left on mobile to stay clear of the emergency FAB).
 * All controls are keyboard-operable with visible white focus rings and
 * accessible names; touch targets meet the 44px guideline. Colours are
 * tuned for the dark scrim, not the old white background.
 */
export default function HeroSliderControls({
  index,
  count,
  onGoTo,
  onNext,
  onPrev,
  userPaused,
  onTogglePause,
}: {
  index: number;
  count: number;
  onGoTo: (index: number) => void;
  onNext: () => void;
  onPrev: () => void;
  userPaused: boolean;
  onTogglePause: () => void;
}) {
  if (count <= 1) return null;

  const roundButton =
    'flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';

  return (
    <div className="flex items-center justify-start gap-4 md:justify-between" role="group" aria-label="Hero slide controls">
      <div className="flex items-center gap-2" role="tablist" aria-label="Choose a slide">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Go to slide ${i + 1} of ${count}`}
            onClick={() => onGoTo(i)}
            className={`h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              i === index ? 'w-8 bg-white' : 'w-4 bg-white/50 hover:bg-white/80'
            }`}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePause}
          aria-label={userPaused ? 'Resume auto-rotation' : 'Pause auto-rotation'}
          aria-pressed={userPaused}
          className={roundButton}
        >
          {userPaused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
        </button>
        <button type="button" onClick={onPrev} aria-label="Previous slide" className={roundButton}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={onNext} aria-label="Next slide" className={roundButton}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

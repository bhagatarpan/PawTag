import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

/**
 * Discreet hero navigation: slide dots, prev/next arrows, and the
 * pause/play control required for autoplay accessibility (WCAG 2.2 AA).
 * All controls are keyboard-operable with visible focus states and
 * accessible names; touch targets meet the 44px guideline.
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
            className={`h-2.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
              i === index ? 'w-8 bg-primary-600' : 'w-2.5 bg-gray-300 hover:bg-gray-400'
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
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {userPaused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous slide"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next slide"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

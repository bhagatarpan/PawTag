import { useCallback, useEffect, useRef, useState } from 'react';
import { HERO_AUTOPLAY_MS, HERO_SWIPE_THRESHOLD_PX } from './hero.types';

/**
 * Carousel state machine for the homepage hero.
 *
 * Autoplay rules (WCAG 2.2 AA):
 * - runs only when there is more than one slide;
 * - pauses on hover, on keyboard focus within the carousel, while the page
 *   is hidden, under prefers-reduced-motion, and after ANY intentional user
 *   interaction (the user can resume with the visible play control);
 * - uses a single setTimeout recreated per index change — never overlapping
 *   timers — and cleans up on every dependency change/unmount.
 */

export interface HeroCarousel {
  index: number;
  count: number;
  /** True while autoplay is currently advancing slides. */
  autoplayActive: boolean;
  /** Explicit user pause (set by the pause/play control or manual navigation). */
  userPaused: boolean;
  reducedMotion: boolean;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  toggleUserPaused: () => void;
  hoverProps: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
  focusProps: {
    onFocusCapture: () => void;
    onBlurCapture: (event: React.FocusEvent<HTMLElement>) => void;
  };
  swipeProps: {
    onTouchStart: (event: React.TouchEvent<HTMLElement>) => void;
    onTouchEnd: (event: React.TouchEvent<HTMLElement>) => void;
  };
  /** Attach to the carousel <section> so focus containment can be checked. */
  sectionRef: React.MutableRefObject<HTMLElement | null>;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  return reduced;
}

export function useHeroCarousel({ count, autoplayMs = HERO_AUTOPLAY_MS }: { count: number; autoplayMs?: number }): HeroCarousel {
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [hiddenPaused, setHiddenPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const sectionRef = useRef<HTMLElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const autoplayActive =
    count > 1 && !userPaused && !hoverPaused && !focusPaused && !hiddenPaused && !reducedMotion;

  useEffect(() => {
    if (!autoplayActive) return;
    const timer = setTimeout(() => setIndex((current) => (current + 1) % count), autoplayMs);
    return () => clearTimeout(timer);
  }, [autoplayActive, index, count, autoplayMs]);

  useEffect(() => {
    const onVisibilityChange = () => setHiddenPaused(document.hidden);
    onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const goTo = useCallback(
    (nextIndex: number) => {
      if (count === 0) return;
      setIndex(((nextIndex % count) + count) % count);
      // Intentional navigation pauses autoplay — resumable via the control.
      setUserPaused(true);
    },
    [count],
  );

  const next = useCallback(() => setIndex((current) => (current + 1) % count), [count]);
  const prev = useCallback(() => setIndex((current) => (current - 1 + count) % count), [count]);

  // Navigation helpers used by controls (also pause autoplay intentionally).
  const goToAndPause = useCallback(
    (target: 'next' | 'prev' | number) => {
      if (typeof target === 'number') goTo(target);
      else {
        target === 'next' ? next() : prev();
        setUserPaused(true);
      }
    },
    [goTo, next, prev],
  );

  const toggleUserPaused = useCallback(() => setUserPaused((paused) => !paused), []);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const deltaX = touchStartX.current - event.changedTouches[0].clientX;
      const deltaY = touchStartY.current - event.changedTouches[0].clientY;
      touchStartX.current = null;
      touchStartY.current = null;
      // Horizontal-dominant movement only — vertical scrolling must never
      // navigate slides, and small jitter must not trigger transitions.
      if (Math.abs(deltaX) < HERO_SWIPE_THRESHOLD_PX) return;
      if (Math.abs(deltaY) >= Math.abs(deltaX)) return;
      goToAndPause(deltaX > 0 ? 'next' : 'prev');
    },
    [goToAndPause],
  );

  return {
    index,
    count,
    autoplayActive,
    userPaused,
    reducedMotion,
    goTo: goToAndPause,
    next: () => goToAndPause('next'),
    prev: () => goToAndPause('prev'),
    toggleUserPaused,
    hoverProps: {
      onMouseEnter: () => setHoverPaused(true),
      onMouseLeave: () => setHoverPaused(false),
    },
    focusProps: {
      onFocusCapture: () => setFocusPaused(true),
      onBlurCapture: (event: React.FocusEvent<HTMLElement>) => {
        // Keep paused only while focus remains inside the carousel.
        if (!sectionRef.current?.contains(event.relatedTarget as Node | null)) {
          setFocusPaused(false);
        }
      },
    },
    swipeProps: {
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
    },
    sectionRef,
  };
}

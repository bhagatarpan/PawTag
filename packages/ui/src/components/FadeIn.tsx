/**
 * Scroll-triggered fade-in animation component.
 *
 * Uses IntersectionObserver to detect when an element enters the viewport,
 * then applies a CSS transition. Supports stagger delays for child elements.
 * Respects prefers-reduced-motion for accessibility.
 */

import React, { useRef, useEffect, useState, type ReactNode } from 'react';

export interface FadeInProps {
  children: ReactNode;
  /** Delay before animation starts (seconds). Default: 0 */
  delay?: number;
  /** Animation direction. Default: 'up' */
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  /** Animation duration (seconds). Default: 0.6 */
  duration?: number;
  /** If true, children animate in sequence with 100ms stagger */
  stagger?: boolean;
  /** Distance to travel (pixels). Default: 24 */
  distance?: number;
  /** Additional CSS class */
  className?: string;
  /** Once true, animate only once (don't re-trigger on re-entry). Default: true */
  once?: boolean;
}

function getInitialState(direction: string, distance: number): React.CSSProperties {
  const d = `${distance}px`;
  switch (direction) {
    case 'up':    return { opacity: 0, transform: `translateY(${d})` };
    case 'down':  return { opacity: 0, transform: `translateY(-${d})` };
    case 'left':  return { opacity: 0, transform: `translateX(${d})` };
    case 'right': return { opacity: 0, transform: `translateX(-${d})` };
    default:      return { opacity: 0 };
  }
}

const visibleStyle: React.CSSProperties = { opacity: 1, transform: 'translate(0, 0)' };

export function FadeIn({
  children,
  delay = 0,
  direction = 'up',
  duration = 0.6,
  stagger = false,
  distance = 24,
  className = '',
  once = true,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect prefers-reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  if (stagger) {
    // Wrap each direct child with staggered delay
    const items = React.Children.toArray(children);
    return (
      <div ref={ref} className={className}>
        {items.map((child, i) => (
          <FadeInChild
            key={i}
            isVisible={isVisible}
            delay={delay + i * 0.1}
            duration={duration}
            direction={direction}
            distance={distance}
          >
            {child}
          </FadeInChild>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...getInitialState(direction, distance),
        ...(isVisible ? visibleStyle : {}),
        transition: `opacity ${duration}s ease-out ${delay}s, transform ${duration}s ease-out ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/** Internal child wrapper for stagger mode */
function FadeInChild({
  children,
  isVisible,
  delay,
  duration,
  direction,
  distance,
}: {
  children: ReactNode;
  isVisible: boolean;
  delay: number;
  duration: number;
  direction: string;
  distance: number;
}) {
  return (
    <div
      style={{
        ...getInitialState(direction, distance),
        ...(isVisible ? visibleStyle : {}),
        transition: `opacity ${duration}s ease-out ${delay}s, transform ${duration}s ease-out ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

export default FadeIn;

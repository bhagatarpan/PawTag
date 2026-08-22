import { useEffect, useRef } from 'react';
import { useCartInteraction } from '../context/CartInteractionContext';

// Find the cart icon element in the DOM
function getCartDestination(): DOMRect | null {
  // Try the ref-based approach first (from Navbar)
  const byRef = document.querySelector('[data-cart-icon]');
  if (byRef) return byRef.getBoundingClientRect();
  // Fallback: find by badge
  const byBadge = document.querySelector('[data-cart-badge]');
  if (byBadge) return byBadge.parentElement?.getBoundingClientRect() || null;
  // Last resort: top-right corner
  return new DOMRect(window.innerWidth - 60, 8, 40, 40);
}

export default function FlyingImage() {
  const { flyRequest, clearFly, tokens } = useCartInteraction();
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!flyRequest || !containerRef.current) return;
    console.log('[FlyingImage] Rendering animation:', flyRequest.id, 'from:', flyRequest.sourceRect);

    const el = containerRef.current;
    const dest = getCartDestination();
    if (!dest) { clearFly(); return; }

    const { sourceRect, imageUrl } = flyRequest;
    const duration = tokens.duration.normal;

    // Starting position (center of source image)
    const startX = sourceRect.left + sourceRect.width / 2;
    const startY = sourceRect.top + sourceRect.height / 2;

    // Ending position (center of cart icon)
    const endX = dest.left + dest.width / 2;
    const endY = dest.top + dest.height / 2;

    // Control point for arc (above the midpoint)
    const midX = (startX + endX) / 2;
    const midY = Math.min(startY, endY) + tokens.fly.arcOffset;

    // Set initial styles
    el.style.cssText = `
      position: fixed;
      z-index: 9999;
      pointer-events: none;
      width: 80px;
      height: 80px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      transform: translate(${startX - 40}px, ${startY - 40}px) scale(${tokens.fly.scaleStart});
      opacity: ${tokens.fly.opacityStart};
      transition: none;
      will-change: transform, opacity;
    `;

    // Set image
    const img = document.createElement('img');
    img.src = imageUrl;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    img.alt = '';
    el.appendChild(img);

    // Force layout before animation
    el.offsetHeight;

    // Animate using Web Animations API for smooth performance
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);

      // Quadratic bezier interpolation for arc path
      const x = (1 - ease) * (1 - ease) * startX + 2 * (1 - ease) * ease * midX + ease * ease * endX;
      const y = (1 - ease) * (1 - ease) * startY + 2 * (1 - ease) * ease * midY + ease * ease * endY;

      // Scale: shrink as it travels
      const scale = tokens.fly.scaleStart + (tokens.fly.scaleMid - tokens.fly.scaleStart) * ease;
      // Opacity: fade near end
      const opacity = t > 0.7
        ? tokens.fly.opacityStart - ((t - 0.7) / 0.3) * (tokens.fly.opacityStart - tokens.fly.opacityEnd)
        : tokens.fly.opacityStart;
      // Subtle rotation
      const rotate = tokens.fly.rotateEnd * ease;

      el.style.transform = `translate(${x - 40}px, ${y - 40}px) scale(${scale}) rotate(${rotate}deg)`;
      el.style.opacity = String(opacity);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete — clean up
        clearFly();
      }
    }

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, [flyRequest, clearFly, tokens]);

  if (!flyRequest) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      role="presentation"
    />
  );
}

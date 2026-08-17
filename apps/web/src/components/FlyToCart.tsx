import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { PawPrint } from 'lucide-react';

interface FlyItem {
  id: number;
  image?: string;
  fromX: number;
  fromY: number;
  fromSize: number;
}

/**
 * Listens for `cart:add` custom events and renders a flying clone
 * that animates from the product card to the cart icon in the navbar.
 *
 * Also triggers a bump animation on the cart icon and a pop on the badge.
 *
 * Usage: mount <FlyToCart cartRef={cartButtonRef} /> once in the app.
 *
 * To trigger from anywhere:
 *   window.dispatchEvent(new CustomEvent('cart:add', { detail: { image, rect } }))
 */
export default function FlyToCart({ cartRef }: { cartRef: React.RefObject<HTMLElement | null> }) {
  const [items, setItems] = useState<FlyItem[]>([]);
  const counter = useRef(0);

  const triggerBump = useCallback(() => {
    const cartEl = cartRef.current;
    if (!cartEl) return;
    cartEl.classList.remove('animate-cart-bump');
    void cartEl.offsetWidth; // force reflow
    cartEl.classList.add('animate-cart-bump');
    setTimeout(() => cartEl.classList.remove('animate-cart-bump'), 500);

    // Pop the badge after a small delay
    setTimeout(() => {
      const badge = cartEl.querySelector('[data-cart-badge]');
      if (badge) {
        badge.classList.remove('animate-badge-pop');
        void (badge as HTMLElement).offsetWidth;
        badge.classList.add('animate-badge-pop');
        setTimeout(() => badge.classList.remove('animate-badge-pop'), 600);
      }
    }, 200);
  }, [cartRef]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.rect) return;

      const cartEl = cartRef.current;
      if (!cartEl) return;

      const cartRect = cartEl.getBoundingClientRect();
      const { rect, image } = detail;

      const id = ++counter.current;
      const flyItem: FlyItem = {
        id,
        image,
        fromX: rect.left + rect.width / 2 - 30,
        fromY: rect.top + rect.height / 2 - 30,
        fromSize: 60,
      };

      setItems((prev) => [...prev, flyItem]);

      // Remove after animation completes + trigger bump
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== id));
        triggerBump();
      }, 900);
    };

    window.addEventListener('cart:add', handler);
    return () => window.removeEventListener('cart:add', handler);
  }, [cartRef, triggerBump]);

  if (items.length === 0) return null;

  return createPortal(
    <>
      {items.map((item) => {
        const cartEl = cartRef.current;
        const cartRect = cartEl?.getBoundingClientRect();
        if (!cartRect) return null;

        return (
          <div
            key={item.id}
            className="animate-fly-to-cart fixed"
            style={{
              ['--fly-from-x' as string]: `${item.fromX}px`,
              ['--fly-from-y' as string]: `${item.fromY}px`,
              ['--fly-from-size' as string]: `${item.fromSize}px`,
              ['--fly-to-x' as string]: `${cartRect.left + cartRect.width / 2 - 14}px`,
              ['--fly-to-y' as string]: `${cartRect.top + cartRect.height / 2 - 14}px`,
            }}
          >
            {item.image ? (
              <img src={item.image} alt="" className="w-full h-full rounded-full object-cover shadow-lg" />
            ) : (
              <div className="w-full h-full rounded-full bg-teal-100 flex items-center justify-center shadow-lg">
                <PawPrint className="h-6 w-6 text-teal-500" />
              </div>
            )}
          </div>
        );
      })}
    </>,
    document.body,
  );
}

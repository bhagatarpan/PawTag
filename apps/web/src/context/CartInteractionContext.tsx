import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CART_ANIM, CART_ANIM_REDUCED } from '../lib/cart-animation-tokens';

export interface FlyRequest {
  id: string;             // Unique ID for this animation
  imageUrl: string;       // Product image URL
  sourceRect: DOMRect;    // Where the image is on screen
  onComplete?: () => void;
}

type AnimTokens = typeof CART_ANIM;

interface CartInteractionContextType {
  flyRequest: FlyRequest | null;
  triggerFly: (imageUrl: string, sourceRect: DOMRect) => string;
  clearFly: () => void;
  cartBump: boolean;
  clearCartBump: () => void;
  reducedMotion: boolean;
  tokens: AnimTokens;
}

const CartInteractionContext = createContext<CartInteractionContextType | null>(null);

export function CartInteractionProvider({ children }: { children: ReactNode }) {
  const [flyRequest, setFlyRequest] = useState<FlyRequest | null>(null);
  const [cartBump, setCartBump] = useState(false);
  const [reducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const tokens: AnimTokens = reducedMotion ? (CART_ANIM_REDUCED as unknown as AnimTokens) : CART_ANIM;

  const triggerFly = useCallback((imageUrl: string, sourceRect: DOMRect): string => {
    const id = `fly_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setFlyRequest({ id, imageUrl, sourceRect });
    return id;
  }, []);

  const clearFly = useCallback(() => {
    setFlyRequest(null);
  }, []);

  const clearCartBump = useCallback(() => {
    setCartBump(false);
  }, []);

  // Expose a method to trigger cart bump from FlyingImage completion
  const triggerCartBump = useCallback(() => {
    setCartBump(true);
  }, []);

  return (
    <CartInteractionContext.Provider value={{
      flyRequest,
      triggerFly,
      clearFly,
      cartBump,
      clearCartBump: () => setCartBump(false),
      reducedMotion,
      tokens,
    }}>
      {children}
    </CartInteractionContext.Provider>
  );
}

export function useCartInteraction() {
  const ctx = useContext(CartInteractionContext);
  if (!ctx) throw new Error('useCartInteraction must be used within CartInteractionProvider');
  return ctx;
}

// Helper to trigger bump externally (from FlyingImage completion)
let bumpCallback: (() => void) | null = null;
export function setCartBumpCallback(cb: () => void) { bumpCallback = cb; }
export function triggerCartBump() { bumpCallback?.(); }

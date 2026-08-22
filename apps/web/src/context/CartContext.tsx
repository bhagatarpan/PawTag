import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { sdk, getNzRegionId } from '../lib/medusa';
import api from '../lib/api';

export interface CartItem {
  productId: string;
  variantId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  petName?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
  cart: any | null;
  loading: boolean;
  error: string | null;
}

const CartContext = createContext<CartContextType | null>(null);
const CART_ID_KEY = 'pawtag_medusa_cart_id';

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cartIdRef = useRef<string | null>(null);

  // Helper: get current cart ID
  const getCartId = (): string | null => cartIdRef.current || localStorage.getItem(CART_ID_KEY);

  // Helper: re-fetch cart from Medusa and update state
  const refreshCart = async (): Promise<any | null> => {
    const id = getCartId();
    if (!id) { console.warn('[Cart] refreshCart: no cart ID'); return null; }
    try {
      const { cart: reloaded } = await sdk.store.cart.retrieve(id);
      console.log('[Cart] refreshCart: items=', reloaded?.items?.length, 'total=', reloaded?.total);
      setCart(reloaded);
      return reloaded;
    } catch (e) {
      console.error('[Cart] refreshCart failed:', e);
      setCart(null);
      cartIdRef.current = null;
      localStorage.removeItem(CART_ID_KEY);
      return null;
    }
  };

  // Load or create cart on mount
  useEffect(() => {
    const loadCart = async () => {
      const savedCartId = localStorage.getItem(CART_ID_KEY);
      if (savedCartId) {
        try {
          setLoading(true);
          const { cart: retrieved } = await sdk.store.cart.retrieve(savedCartId);
          cartIdRef.current = savedCartId;
          setCart(retrieved);
        } catch {
          localStorage.removeItem(CART_ID_KEY);
          cartIdRef.current = null;
          try {
            const regionId = await getNzRegionId();
            const { cart: newCart } = await sdk.store.cart.create({ region_id: regionId });
            cartIdRef.current = (newCart as any).id;
            localStorage.setItem(CART_ID_KEY, (newCart as any).id);
            setCart(newCart);
          } catch { /* will create on addItem */ }
        } finally { setLoading(false); }
      } else {
        try {
          const regionId = await getNzRegionId();
          const { cart: newCart } = await sdk.store.cart.create({ region_id: regionId });
          cartIdRef.current = (newCart as any).id;
          localStorage.setItem(CART_ID_KEY, (newCart as any).id);
          setCart(newCart);
        } catch { /* will create on addItem */ }
      }
    };
    loadCart();
  }, []);

  const items: CartItem[] = (cart?.items || []).map((item: any) => ({
    productId: item.product_id || '',
    variantId: item.variant_id || '',
    name: item.title || '',
    price: item.unit_price || 0,
    quantity: item.quantity,
    image: item.thumbnail || item.variant?.product?.thumbnail || undefined,
  }));

  const addItem = useCallback(async (item: CartItem) => {
    setError(null);
    try {
      setLoading(true);

      // Create cart if none exists
      let cartId = getCartId();
      if (!cartId) {
        const regionId = await getNzRegionId();
        const { cart: newCart } = await sdk.store.cart.create({ region_id: regionId });
        cartId = (newCart as any).id as string;
        cartIdRef.current = cartId;
        localStorage.setItem(CART_ID_KEY, cartId);
        setCart(newCart);

        // Fire-and-forget: sync user
        const syncCartId = cartId as string;
        api.post('/customer/medusa-sync').then((res) => {
          const cid = res.data?.data?.medusaCustomerId;
          if (cid) sdk.store.cart.update(syncCartId, { customer_id: cid } as any).catch(() => {});
        }).catch(() => {});
      }

      console.log('[Cart] Adding item to cart:', cartId, item.variantId);
      await sdk.store.cart.createLineItem(cartId as string, {
        variant_id: item.variantId,
        quantity: item.quantity,
      });
      console.log('[Cart] Item added, refreshing...');

      // Always re-fetch to get consistent state
      await refreshCart();
    } catch (err: any) {
      setError(err?.message || 'Failed to add item to cart');
    } finally {
      setLoading(false);
    }
  }, []);

  // Helper to ensure we have a valid cart ID
  const ensureCartId = (): string => {
    const id = getCartId();
    if (!id) throw new Error('No cart');
    return id;
  };

  const removeItem = useCallback(async (variantId: string) => {
    const id = getCartId();
    if (!id) return;
    setError(null);
    try {
      setLoading(true);
      // Re-fetch to get fresh line item IDs
      const freshCart = await refreshCart();
      if (!freshCart) return;
      const lineItem = (freshCart as any).items?.find((i: any) => i.variant_id === variantId);
      if (lineItem) {
        await sdk.store.cart.deleteLineItem(id, lineItem.id);
        await refreshCart();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove item');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateQuantity = useCallback(async (variantId: string, quantity: number) => {
    if (quantity <= 0) { removeItem(variantId); return; }
    const id = getCartId();
    if (!id) return;
    setError(null);
    try {
      setLoading(true);
      const freshCart = await refreshCart();
      if (!freshCart) return;
      const lineItem = (freshCart as any).items?.find((i: any) => i.variant_id === variantId);
      if (lineItem) {
        await sdk.store.cart.updateLineItem(id, lineItem.id, { quantity });
        await refreshCart();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update quantity');
    } finally {
      setLoading(false);
    }
  }, [removeItem]);

  const clearCart = useCallback(async () => {
    const id = getCartId();
    if (!id) return;
    try {
      setLoading(true);
      const freshCart = await refreshCart();
      if (!freshCart) return;
      for (const item of (freshCart as any).items || []) {
        await sdk.store.cart.deleteLineItem(id, (item as any).id);
      }
      await refreshCart();
    } catch {
      setCart(null);
      cartIdRef.current = null;
      localStorage.removeItem(CART_ID_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const total = (cart as any)?.total || 0;
  const itemCount = ((cart as any)?.items || []).reduce((sum: number, i: any) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, total, itemCount, cart, loading, error }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

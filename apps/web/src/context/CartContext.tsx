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
  const cartRef = useRef<any>(null);

  // Keep ref in sync with state
  useEffect(() => { cartRef.current = cart; }, [cart]);

  // Load or create cart on mount
  useEffect(() => {
    const loadCart = async () => {
      const savedCartId = localStorage.getItem(CART_ID_KEY);
      if (savedCartId) {
        try {
          setLoading(true);
          const { cart: retrieved } = await sdk.store.cart.retrieve(savedCartId);
          setCart(retrieved);
        } catch {
          localStorage.removeItem(CART_ID_KEY);
          try {
            const regionId = await getNzRegionId();
            const { cart: newCart } = await sdk.store.cart.create({ region_id: regionId });
            localStorage.setItem(CART_ID_KEY, (newCart as any).id);
            setCart(newCart);
          } catch { /* will create on addItem */ }
        } finally { setLoading(false); }
      } else {
        try {
          const regionId = await getNzRegionId();
          const { cart: newCart } = await sdk.store.cart.create({ region_id: regionId });
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

  // All functions use cartRef.current — never stale
  const addItem = useCallback(async (item: CartItem) => {
    setError(null);
    try {
      setLoading(true);
      let currentCart = cartRef.current;

      if (!currentCart) {
        const regionId = await getNzRegionId();
        const { cart: newCart } = await sdk.store.cart.create({ region_id: regionId });
        currentCart = newCart;
        localStorage.setItem(CART_ID_KEY, (newCart as any).id);
        setCart(newCart);

        // Fire-and-forget: sync user to Medusa
        api.post('/customer/medusa-sync').then((res) => {
          const cid = res.data?.data?.medusaCustomerId;
          if (cid) sdk.store.cart.update((newCart as any).id, { customer_id: cid } as any);
        }).catch(() => {});
      }

      const { cart: withItem } = await sdk.store.cart.createLineItem((currentCart as any).id, {
        variant_id: item.variantId,
        quantity: item.quantity,
      });
      setCart(withItem);
    } catch (err: any) {
      setError(err?.message || 'Failed to add item to cart');
    } finally {
      setLoading(false);
    }
  }, []);

  const removeItem = useCallback(async (variantId: string) => {
    const currentCart = cartRef.current;
    if (!currentCart) return;
    setError(null);
    try {
      setLoading(true);
      const cartId = (currentCart as any).id;
      const lineItem = (currentCart as any).items?.find((i: any) => i.variant_id === variantId);
      if (lineItem) {
        const result = await sdk.store.cart.deleteLineItem(cartId, lineItem.id);
        if (result.parent) {
          setCart(result.parent as any);
        } else {
          const { cart: reloaded } = await sdk.store.cart.retrieve(cartId);
          setCart(reloaded);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove item');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateQuantity = useCallback(async (variantId: string, quantity: number) => {
    if (quantity <= 0) { removeItem(variantId); return; }
    const currentCart = cartRef.current;
    if (!currentCart) return;
    setError(null);
    try {
      setLoading(true);
      const cartId = (currentCart as any).id;
      const lineItem = (currentCart as any).items?.find((i: any) => i.variant_id === variantId);
      if (lineItem) {
        const { cart: updated } = await sdk.store.cart.updateLineItem(cartId, lineItem.id, { quantity });
        setCart(updated);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update quantity');
    } finally {
      setLoading(false);
    }
  }, [removeItem]);

  const clearCart = useCallback(async () => {
    const currentCart = cartRef.current;
    if (!currentCart) return;
    try {
      setLoading(true);
      for (const item of (currentCart as any).items || []) {
        await sdk.store.cart.deleteLineItem((currentCart as any).id, (item as any).id);
      }
      const { cart: empty } = await sdk.store.cart.retrieve((currentCart as any).id);
      setCart(empty);
    } catch {
      setCart(null);
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

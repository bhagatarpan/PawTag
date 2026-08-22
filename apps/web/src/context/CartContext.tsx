import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { sdk, getNzRegionId } from '../lib/medusa';
import api from '../lib/api';
import type { StoreCart } from '@medusajs/types';

export interface CartItem {
  productId: string;
  variantId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  petName?: string;
}

export interface AddedItem {
  name: string;
  price: number;
  quantity: number;
  image?: string;
  timestamp: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  refreshCart: () => Promise<StoreCart | null>;
  total: number;
  itemCount: number;
  cart: StoreCart | null;
  loading: boolean;
  error: string | null;
  lastAddedItem: AddedItem | null;
  clearLastAddedItem: () => void;
}

const CartContext = createContext<CartContextType | null>(null);
const CART_ID_KEY = 'pawtag_medusa_cart_id';

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<StoreCart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAddedItem, setLastAddedItem] = useState<AddedItem | null>(null);
  const cartIdRef = useRef<string | null>(null);

  const getCartId = (): string | null => cartIdRef.current || localStorage.getItem(CART_ID_KEY);

  // Re-fetch cart from Medusa and update state
  const refreshCart = useCallback(async (): Promise<StoreCart | null> => {
    const id = getCartId();
    if (!id) return null;
    try {
      const { cart: reloaded } = await sdk.store.cart.retrieve(id);
      setCart(reloaded);
      return reloaded;
    } catch {
      setCart(null);
      cartIdRef.current = null;
      localStorage.removeItem(CART_ID_KEY);
      return null;
    }
  }, []);

  const clearLastAddedItem = useCallback(() => setLastAddedItem(null), []);

  // Load or create cart on mount
  useEffect(() => {
    const loadCart = async () => {
      const savedCartId = localStorage.getItem(CART_ID_KEY);
      if (savedCartId) {
        try {
          const { cart: retrieved } = await sdk.store.cart.retrieve(savedCartId);
          cartIdRef.current = savedCartId;
          setCart(retrieved);
        } catch {
          localStorage.removeItem(CART_ID_KEY);
          cartIdRef.current = null;
          try {
            const regionId = await getNzRegionId();
            const { cart: newCart } = await sdk.store.cart.create({ region_id: regionId });
            cartIdRef.current = newCart.id;
            localStorage.setItem(CART_ID_KEY, newCart.id);
            setCart(newCart);
          } catch { /* will create on addItem */ }
        }
      } else {
        try {
          const regionId = await getNzRegionId();
          const { cart: newCart } = await sdk.store.cart.create({ region_id: regionId });
          cartIdRef.current = newCart.id;
          localStorage.setItem(CART_ID_KEY, newCart.id);
          setCart(newCart);
        } catch { /* will create on addItem */ }
      }
    };
    loadCart();
  }, []);

  // Memoized derived values
  const items: CartItem[] = useMemo(() => (cart?.items || []).map((item) => ({
    productId: item.product_id || '',
    variantId: item.variant_id || '',
    name: item.title || '',
    price: item.unit_price || 0,
    quantity: item.quantity,
    image: item.thumbnail || undefined,
  })), [cart]);

  const total = useMemo(() => cart?.total || 0, [cart]);
  const itemCount = useMemo(() => (cart?.items || []).reduce((sum, i) => sum + i.quantity, 0), [cart]);

  // ADD ITEM — optimistic update + server reconcile
  const addItem = useCallback(async (item: CartItem) => {
    setError(null);
    try {
      let cartId = getCartId();

      // If no cart exists, create one first
      if (!cartId) {
        const regionId = await getNzRegionId();
        const { cart: newCart } = await sdk.store.cart.create({ region_id: regionId });
        cartId = newCart.id;
        cartIdRef.current = cartId;
        localStorage.setItem(CART_ID_KEY, cartId);
        setCart(newCart);

        // Fire-and-forget: sync user
        api.post('/customer/medusa-sync').then((res) => {
          const cid = res.data?.data?.medusaCustomerId;
          if (cid) sdk.store.cart.update(cartId!, { customer_id: cid } as any).catch(() => {});
        }).catch(() => {});
      }

      // OPTIMISTIC: immediately add item to local cart so badge + drawer update instantly
      setCart(prev => {
        if (!prev) return prev;
        const existing = (prev.items || []).find(i => i.variant_id === item.variantId);
        const newItems = existing
          ? (prev.items || []).map(i =>
              i.variant_id === item.variantId ? { ...i, quantity: i.quantity + item.quantity } : i
            )
          : [...(prev.items || []), {
              id: `optimistic_${item.variantId}`,
              variant_id: item.variantId,
              product_id: item.productId,
              title: item.name,
              unit_price: item.price,
              quantity: item.quantity,
              thumbnail: item.image || null,
            } as any];
        return { ...prev, items: newItems, total: (prev.total || 0) + item.price * item.quantity } as StoreCart;
      });

      // Show toast
      setLastAddedItem({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        timestamp: Date.now(),
      });

      // Reconcile with server truth
      const { cart: updated } = await sdk.store.cart.createLineItem(cartId!, {
        variant_id: item.variantId,
        quantity: item.quantity,
      });
      setCart(updated);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to add item to cart');
      await refreshCart();
    }
  }, [refreshCart]);

  // REMOVE ITEM — optimistic + refetch to reconcile
  const removeItem = useCallback(async (variantId: string) => {
    const id = getCartId();
    if (!id) return;
    setError(null);

    const previousCart = cart;
    setCart(prev => {
      if (!prev) return prev;
      return { ...prev, items: (prev.items || []).filter(i => i.variant_id !== variantId) } as StoreCart;
    });

    try {
      setLoading(true);
      const lineItem = previousCart?.items?.find((i) => i.variant_id === variantId);
      if (lineItem) {
        await sdk.store.cart.deleteLineItem(id, lineItem.id);
        await refreshCart();
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to remove item');
      setCart(previousCart);
    } finally {
      setLoading(false);
    }
  }, [cart, refreshCart]);

  // UPDATE QUANTITY — optimistic + use mutation response
  const updateQuantity = useCallback(async (variantId: string, quantity: number) => {
    if (quantity <= 0) { removeItem(variantId); return; }
    const id = getCartId();
    if (!id) return;
    setError(null);

    const previousCart = cart;
    setCart(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: (prev.items || []).map(i =>
          i.variant_id === variantId ? { ...i, quantity } : i
        ),
      } as StoreCart;
    });

    try {
      setLoading(true);
      const lineItem = previousCart?.items?.find((i) => i.variant_id === variantId);
      if (lineItem) {
        const { cart: updated } = await sdk.store.cart.updateLineItem(id, lineItem.id, { quantity });
        setCart(updated);
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to update quantity');
      setCart(previousCart);
    } finally {
      setLoading(false);
    }
  }, [cart, removeItem]);

  const clearCart = useCallback(async () => {
    setCart(null);
    cartIdRef.current = null;
    localStorage.removeItem(CART_ID_KEY);
  }, []);

  const value = useMemo(() => ({
    items, addItem, removeItem, updateQuantity, clearCart, refreshCart, total, itemCount, cart, loading, error, lastAddedItem, clearLastAddedItem,
  }), [items, addItem, removeItem, updateQuantity, clearCart, refreshCart, total, itemCount, cart, loading, error, lastAddedItem, clearLastAddedItem]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

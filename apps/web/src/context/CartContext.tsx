/**
 * @module CartContext
 * @description React context for PawTag shopping cart.
 *
 * PawTag-native shopping cart. All cart operations go through POST /api/cart/* endpoints.
 *
 * Features:
 * - Add/remove/update items
 * - Server-side price validation
 * - Cart totals calculation
 * - Persistent cart (server-side via user ID)
 * - Optimistic updates for UI responsiveness
 *
 * Usage:
 * ```tsx
 * const { items, addItem, removeItem, total } = useCart();
 * ```
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '../lib/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CartItem {
  _id: string;
  productId: string;
  variantId?: string;
  productName: string;
  name?: string;
  sku: string;
  unitPrice: number;
  price?: number;
  customizationTotal: number;
  quantity: number;
  image?: string;
  customisation?: boolean;
}

export interface AddedItem {
  name: string;
  price: number;
  quantity: number;
  image?: string;
  timestamp: number;
}

export interface CartTotals {
  items: Array<{
    itemId: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    customisationTotal: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: { productId: string; quantity: number; customisation?: boolean; name?: string; price?: number; image?: string }) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  refreshCart: () => Promise<void>;
  totals: CartTotals;
  total: number;
  itemCount: number;
  loading: boolean;
  error: string | null;
  lastAddedItem: AddedItem | null;
  clearLastAddedItem: () => void;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const CartContext = createContext<CartContextType | null>(null);

const EMPTY_TOTALS: CartTotals = {
  items: [],
  subtotal: 0,
  discount: 0,
  shipping: 0,
  tax: 0,
  total: 0,
  currency: 'NZD',
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [totals, setTotals] = useState<CartTotals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAddedItem, setLastAddedItem] = useState<AddedItem | null>(null);

  /* ---- Fetch cart from server ---- */
  const refreshCart = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/cart');
      const data = res.data?.data;
      if (data?.cart) {
        setItems(data.cart.items || []);
        setTotals(data.totals || EMPTY_TOTALS);
      }
    } catch (err: any) {
      // 401 = not logged in, that's ok
      if (err?.response?.status !== 401) {
        setError('Failed to load cart');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Load cart on mount ---- */
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  /* ---- Add item ---- */
  const addItem = useCallback(async (item: { productId: string; quantity: number; customisation?: boolean; name?: string; price?: number; image?: string }) => {
    try {
      setLoading(true);
      const res = await api.post('/cart/items', {
        productId: item.productId,
        quantity: item.quantity,
        customisation: item.customisation,
      });
      const data = res.data?.data;
      if (data?.cart) {
        setItems(data.cart.items || []);
        setTotals(data.totals || EMPTY_TOTALS);
        setLastAddedItem({
          name: item.name || 'Item',
          price: item.price || 0,
          quantity: item.quantity,
          image: item.image,
          timestamp: Date.now(),
        });
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to add item');
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Remove item ---- */
  const removeItem = useCallback(async (itemId: string) => {
    try {
      setLoading(true);
      const res = await api.delete(`/cart/items/${itemId}`);
      const data = res.data?.data;
      if (data?.cart) {
        setItems(data.cart.items || []);
        setTotals(data.totals || EMPTY_TOTALS);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to remove item');
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Update quantity ---- */
  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    try {
      setLoading(true);
      const res = await api.put(`/cart/items/${itemId}`, { quantity });
      const data = res.data?.data;
      if (data?.cart) {
        setItems(data.cart.items || []);
        setTotals(data.totals || EMPTY_TOTALS);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update quantity');
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Clear cart ---- */
  const clearCart = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.delete('/cart');
      const data = res.data?.data;
      if (data?.cart) {
        setItems(data.cart.items || []);
        setTotals(data.totals || EMPTY_TOTALS);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to clear cart');
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Derived values ---- */
  const total = totals.total;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const clearLastAddedItem = useCallback(() => setLastAddedItem(null), []);

  const value: CartContextType = {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    refreshCart,
    totals,
    total,
    itemCount,
    loading,
    error,
    lastAddedItem,
    clearLastAddedItem,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

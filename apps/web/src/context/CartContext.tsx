/**
 * @module CartContext
 * @description React context for PawTag shopping cart.
 *
 * Supports both guest (localStorage) and authenticated (server) carts.
 * Guest carts are automatically synced to the server when the user logs in.
 *
 * Design:
 * - Guest: Cart stored in localStorage as JSON
 * - Authenticated: Cart stored on server via /api/cart/*
 * - On login: localStorage cart is merged into server cart
 * - On logout: Server cart is preserved, localStorage cleared
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '../lib/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CartItem {
  _id?: string;
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
  addedAt?: string;
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
  addItem: (item: { productId: string; quantity: number; customisation?: boolean; name?: string; price?: number; image?: string; sku?: string }) => void;
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
  clearLastAddedItem: (id?: string) => void;
  isGuest: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CART_STORAGE_KEY = 'pawtag_guest_cart';

const EMPTY_TOTALS: CartTotals = {
  items: [],
  subtotal: 0,
  discount: 0,
  shipping: 0,
  tax: 0,
  total: 0,
  currency: 'NZD',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getGuestCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setGuestCart(items: CartItem[]): void {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

function calculateTotals(items: CartItem[]): CartTotals {
  const subtotal = items.reduce((sum, item) => {
    const unitPrice = item.unitPrice || item.price || 0;
    return sum + (unitPrice + (item.customizationTotal || 0)) * item.quantity;
  }, 0);

  return {
    items: items.map((item) => ({
      itemId: item._id || item.productId,
      productId: item.productId,
      productName: item.productName || item.name || 'Item',
      quantity: item.quantity,
      unitPrice: item.unitPrice || item.price || 0,
      customisationTotal: item.customizationTotal || 0,
      lineTotal: ((item.unitPrice || item.price || 0) + (item.customizationTotal || 0)) * item.quantity,
    })),
    subtotal,
    discount: 0,
    shipping: 0,
    tax: 0,
    total: subtotal,
    currency: 'NZD',
  };
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [totals, setTotals] = useState<CartTotals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAddedItem, setLastAddedItem] = useState<AddedItem | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check auth state
  useEffect(() => {
    const token = localStorage.getItem('pawtag_token');
    setIsAuthenticated(!!token);
  }, []);

  const isGuest = !isAuthenticated;

  /* ---- Load cart ---- */
  const refreshCart = useCallback(async () => {
    const token = localStorage.getItem('pawtag_token');

    if (!token) {
      // Guest: load from localStorage
      const guestItems = getGuestCart();
      setItems(guestItems);
      setTotals(calculateTotals(guestItems));
      return;
    }

    // Authenticated: load from server
    try {
      setLoading(true);
      const res = await api.get('/cart');
      const data = res.data?.data;
      if (data?.cart) {
        setItems(data.cart.items || []);
        setTotals(data.totals || EMPTY_TOTALS);
      } else {
        // Server returned empty cart
        setItems([]);
        setTotals(EMPTY_TOTALS);
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        // Token expired or invalid — fall back to guest cart
        localStorage.removeItem('pawtag_token');
        localStorage.removeItem('pawtag_refresh_token');
        const guestItems = getGuestCart();
        setItems(guestItems);
        setTotals(calculateTotals(guestItems));
      } else {
        setError('Failed to load cart');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Sync guest cart to server on login ---- */
  const syncGuestCartToServer = useCallback(async () => {
    const token = localStorage.getItem('pawtag_token');
    if (!token) return;

    const guestItems = getGuestCart();
    if (!guestItems.length) return;

    // Add each guest item to server cart
    let syncSuccess = false;
    for (const item of guestItems) {
      try {
        await api.post('/cart/items', {
          productId: item.productId,
          quantity: item.quantity,
          customisation: item.customisation,
        });
        syncSuccess = true;
      } catch {
        // Non-critical — continue syncing other items
      }
    }

    // Only clear guest cart if sync was successful
    if (syncSuccess) {
      localStorage.removeItem(CART_STORAGE_KEY);
    }

    // Reload cart from server (whether sync succeeded or not)
    await refreshCart();
  }, [refreshCart]);

  // Listen for auth changes and sync guest cart
  useEffect(() => {
    const handleStorage = () => {
      const token = localStorage.getItem('pawtag_token');
      const wasGuest = !isAuthenticated;
      setIsAuthenticated(!!token);

      if (wasGuest && token) {
        // User just logged in — sync guest cart
        syncGuestCartToServer();
      } else if (!token) {
        // User logged out — reload guest cart
        refreshCart();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [isAuthenticated, syncGuestCartToServer, refreshCart]);

  // Also check on mount and after cart operations
  useEffect(() => {
    const token = localStorage.getItem('pawtag_token');
    if (token && !isAuthenticated) {
      setIsAuthenticated(true);
      syncGuestCartToServer();
    }
  }, [isAuthenticated, syncGuestCartToServer]);

  /* ---- Load cart on mount ---- */
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  /* ---- Add item ---- */
  const addItem = useCallback(async (item: { productId: string; quantity: number; customisation?: boolean; name?: string; price?: number; image?: string; sku?: string }) => {
    const token = localStorage.getItem('pawtag_token');

    if (!token) {
      // Guest: add to localStorage
      const guestItems = getGuestCart();
      const existing = guestItems.find(
        (i) => i.productId === item.productId && i.customisation === item.customisation
      );

      if (existing) {
        existing.quantity += item.quantity;
      } else {
        guestItems.push({
          _id: item.productId,
          productId: item.productId,
          productName: item.name || 'Item',
          name: item.name,
          sku: item.sku || '',
          unitPrice: item.price || 0,
          price: item.price,
          customizationTotal: 0,
          quantity: item.quantity,
          image: item.image,
          customisation: item.customisation,
          addedAt: new Date().toISOString(),
        });
      }

      setGuestCart(guestItems);
      setItems(guestItems);
      setTotals(calculateTotals(guestItems));
      setLastAddedItem({
        name: item.name || 'Item',
        price: item.price || 0,
        quantity: item.quantity,
        image: item.image,
        timestamp: Date.now(),
      });
      return;
    }

    // Authenticated: add to server
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
      if (err?.response?.status === 401) {
        // Token expired — fall back to guest cart
        localStorage.removeItem('pawtag_token');
        localStorage.removeItem('pawtag_refresh_token');
        const guestItems = getGuestCart();
        const existing = guestItems.find(
          (i) => i.productId === item.productId && i.customisation === item.customisation
        );
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          guestItems.push({
            _id: item.productId,
            productId: item.productId,
            productName: item.name || 'Item',
            name: item.name,
            sku: item.sku || '',
            unitPrice: item.price || 0,
            price: item.price,
            customizationTotal: 0,
            quantity: item.quantity,
            image: item.image,
            customisation: item.customisation,
            addedAt: new Date().toISOString(),
          });
        }
        setGuestCart(guestItems);
        setItems(guestItems);
        setTotals(calculateTotals(guestItems));
        setLastAddedItem({
          name: item.name || 'Item',
          price: item.price || 0,
          quantity: item.quantity,
          image: item.image,
          timestamp: Date.now(),
        });
      } else {
        setError(err?.response?.data?.error || 'Failed to add item');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Remove item ---- */
  const removeItem = useCallback(async (itemId: string) => {
    const token = localStorage.getItem('pawtag_token');

    if (!token) {
      // Guest: remove from localStorage
      const guestItems = getGuestCart().filter((i) => i._id !== itemId && i.productId !== itemId);
      setGuestCart(guestItems);
      setItems(guestItems);
      setTotals(calculateTotals(guestItems));
      return;
    }

    // Authenticated: remove from server
    try {
      setLoading(true);
      const res = await api.delete(`/cart/items/${itemId}`);
      const data = res.data?.data;
      if (data?.cart) {
        setItems(data.cart.items || []);
        setTotals(data.totals || EMPTY_TOTALS);
      }
    } catch (err: any) {
      if (err?.response?.status !== 401) {
        setError('Failed to remove item');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Update quantity ---- */
  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    const token = localStorage.getItem('pawtag_token');

    if (!token) {
      // Guest: update in localStorage
      const guestItems = getGuestCart();
      const item = guestItems.find((i) => i._id === itemId || i.productId === itemId);
      if (item) {
        if (quantity <= 0) {
          const filtered = guestItems.filter((i) => i._id !== itemId && i.productId !== itemId);
          setGuestCart(filtered);
          setItems(filtered);
          setTotals(calculateTotals(filtered));
        } else {
          item.quantity = quantity;
          setGuestCart(guestItems);
          setItems([...guestItems]);
          setTotals(calculateTotals(guestItems));
        }
      }
      return;
    }

    // Authenticated: update on server
    try {
      setLoading(true);
      const res = await api.put(`/cart/items/${itemId}`, { quantity });
      const data = res.data?.data;
      if (data?.cart) {
        setItems(data.cart.items || []);
        setTotals(data.totals || EMPTY_TOTALS);
      }
    } catch (err: any) {
      if (err?.response?.status !== 401) {
        setError('Failed to update quantity');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Clear cart ---- */
  const clearCart = useCallback(async () => {
    const token = localStorage.getItem('pawtag_token');

    if (!token) {
      localStorage.removeItem(CART_STORAGE_KEY);
      setItems([]);
      setTotals(EMPTY_TOTALS);
      return;
    }

    try {
      setLoading(true);
      await api.delete('/cart');
      setItems([]);
      setTotals(EMPTY_TOTALS);
    } catch (err: any) {
      if (err?.response?.status !== 401) {
        setError('Failed to clear cart');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Derived values ---- */
  const total = totals.total;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const clearLastAddedItem = useCallback((id?: string) => {
    if (id) {
      setLastAddedItem((prev) => (prev && prev.timestamp.toString() === id ? null : prev));
    } else {
      setLastAddedItem(null);
    }
  }, []);

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
    isGuest,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

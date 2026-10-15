/**
 * @module CartContext
 * @description React context for PawTag shopping cart.
 *
 * Supports both guest (localStorage) and authenticated (server) carts.
 *
 * Design:
 * - Guest: Cart stored in localStorage as JSON with a 30-day expiry
 *   (matches the server default `commerce.cart.ttlDays`), refreshed on
 *   every cart change.
 * - Authenticated: Cart stored on server via /api/cart/*
 * - Guest→account merge happens on READ: whenever the cart loads while a
 *   token is present, stranded guest items are folded into the server cart
 *   first. This is deliberate — the old design listened for the cross-tab
 *   `storage` event to detect login, but that event never fires in the tab
 *   that signed in, so same-tab logins stranded the guest cart and the
 *   account cart rendered empty. Merge-on-read cannot miss any login path.
 * - On logout: Server cart is preserved; guest storage cleared on merge.
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';
import { useAuth } from './AuthContext';

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
  customisationTexts?: string[];
  customizable?: boolean;
  customizationLabel?: string;
  customizationPrice?: number;
  autoRenew?: boolean;
  isSubscription?: boolean;
  isAccessory?: boolean;
  monthlyPrice?: number;
  annualPrice?: number;
  freePeriodMonths?: number;
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
    isAccessory?: boolean;
  }>;
  subtotal: number;
  discount: number;
  accessoryDiscount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: { productId: string; quantity: number; customisation?: boolean; customisationTexts?: string[]; name?: string; price?: number; image?: string; sku?: string; customizable?: boolean; customizationLabel?: string; customizationPrice?: number; autoRenew?: boolean }) => Promise<void>;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateItemTexts: (itemId: string, texts: string[]) => void;
  toggleCustomisation: (itemId: string, enable: boolean) => Promise<void>;
  toggleAutoRenew: (itemId: string, autoRenew: boolean) => Promise<void>;
  clearCart: () => void;
  refreshCart: () => Promise<void>;
  totals: CartTotals;
  total: number;
  itemCount: number;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  lastAddedItem: AddedItem | null;
  clearLastAddedItem: (id?: string) => void;
  isGuest: boolean;
  /** Price of item when added vs current DB price — set if price changed */
  priceChanged: boolean;
  /** Applied promo code (persisted server-side) */
  promoCode: string | null;
  /** Whether a promo code is applied */
  promoApplied: boolean;
  /** Set promo code (called by Checkout when applying/removing) */
  setPromoCode: (code: string | null) => void;
  /** Set promo applied state */
  setPromoApplied: (applied: boolean) => void;
  /**
   * Effective free-shipping threshold for the signed-in member
   * (server-resolved entitlement), or null for guests/non-members.
   * Display-only progress — authoritative shipping stays in server totals.
   */
  freeShippingThreshold: number | null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CART_STORAGE_KEY = 'pawtag_guest_cart';

/** Guest carts expire after 30 days — matches the server default
 *  `commerce.cart.ttlDays` so both cart kinds age out together. */
const GUEST_CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const EMPTY_TOTALS: CartTotals = {
  items: [],
  subtotal: 0,
  discount: 0,
  accessoryDiscount: 0,
  shipping: 0,
  tax: 0,
  total: 0,
  currency: 'NZD',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Stored shape: `{ v, savedAt, items }`. Older deployments wrote a bare
 * item array — still accepted on read and re-stamped as an envelope on
 * the next write, so no migration is required.
 */
function getGuestCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);

    let items: CartItem[];
    let savedAt: number;
    if (Array.isArray(parsed)) {
      items = parsed;
      savedAt = Date.now(); // legacy format — treat as fresh once
    } else if (Array.isArray(parsed?.items)) {
      items = parsed.items;
      savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now();
    } else {
      return [];
    }

    if (Date.now() - savedAt > GUEST_CART_TTL_MS) {
      localStorage.removeItem(CART_STORAGE_KEY);
      return [];
    }
    return items;
  } catch {
    return [];
  }
}

function setGuestCart(items: CartItem[]): void {
  localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify({ v: 1, savedAt: Date.now(), items }),
  );
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
      isAccessory: item.isAccessory ?? false,
    })),
    subtotal,
    discount: 0,
    accessoryDiscount: 0,
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

/** Normalise customisation to a boolean for consistent comparison. */
function normCustom(v?: boolean): boolean {
  return v === true;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { token: authToken } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [totals, setTotals] = useState<CartTotals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAddedItem, setLastAddedItem] = useState<AddedItem | null>(null);
  // AuthContext initialises its token synchronously from localStorage, so
  // this is correct on first render (no guest flash for signed-in users).
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!authToken);
  const [priceChanged, setPriceChanged] = useState(false);
  const [promoCode, setPromoCodeState] = useState<string | null>(null);
  const [promoApplied, setPromoApplied] = useState(false);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number | null>(null);

  // Free-shipping threshold for progress display — member entitlement only
  // (guests/non-members have no server threshold; the UI must not invent one).
  useEffect(() => {
    if (!isAuthenticated) {
      setFreeShippingThreshold(null);
      return;
    }
    let cancelled = false;
    api
      .get(API.public.commerce.freeShippingThreshold)
      .then((res) => {
        if (!cancelled) setFreeShippingThreshold(res.data?.data?.threshold ?? null);
      })
      .catch(() => {
        if (!cancelled) setFreeShippingThreshold(null); // display-only — never block cart on failure
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const isGuest = !isAuthenticated;

  /**
   * In-flight guest→server merge. Concurrent refreshCart calls (mount +
   * page effects fire together) await the same promise so items can never
   * be merged twice.
   */
  const mergeInFlightRef = useRef<Promise<void> | null>(null);

  /**
   * Fold stranded guest-cart items into the server cart, if any.
   *
   * This runs on READ (inside refreshCart) rather than listening for the
   * cross-tab `storage` event — that event never fires in the tab that
   * signed in, which stranded guest carts and rendered account carts
   * empty after a same-tab login. Merge-on-read works for every login
   * path: login page, in-checkout sign-in, register, other tabs.
   */
  const mergeGuestCartIntoServer = useCallback(async (): Promise<void> => {
    if (mergeInFlightRef.current) return mergeInFlightRef.current;

    const run = (async () => {
      const token = localStorage.getItem('pawtag_token');
      if (!token) return;

      const guestItems = getGuestCart();
      if (!guestItems.length) return;

      // Fetch the current server cart to detect duplicates
      let serverCart: CartItem[] = [];
      try {
        const res = await api.get(API.cart.get);
        serverCart = res.data?.data?.cart?.items || [];
      } catch {
        // If we can't fetch, add all items (server dedupes by product+customisation)
      }

      const failed: CartItem[] = [];

      // Merge: for each guest item, if it already exists on server, add quantity
      // Otherwise, push it as a new item
      for (const item of guestItems) {
        const cust = normCustom(item.customisation);
        const existing = serverCart.find(
          (si) => si.productId === item.productId && normCustom(si.customisation) === cust
        );

        try {
          if (existing) {
            if (!existing._id) continue;
            // Item already on server — update quantity (add guest qty to server qty)
            await api.put(API.cart.updateItem(existing._id), {
              quantity: existing.quantity + item.quantity,
            });
          } else {
            // New item — add to server. Engraving texts and metadata must
            // survive the guest→login sync, or pet names entered before
            // signing in are silently lost.
            await api.post(API.cart.addItem, {
              productId: item.productId,
              quantity: item.quantity,
              customisation: cust,
              customisationTexts: cust ? (item.customisationTexts || []) : [],
              customizable: item.customizable,
              customizationLabel: item.customizationLabel,
              customizationPrice: item.customizationPrice,
            });
          }
        } catch {
          // Keep the item in guest storage rather than losing it — it will
          // retry on the next cart read.
          failed.push(item);
        }
      }

      // Clear only what merged; retain failures for the next read.
      if (failed.length) {
        setGuestCart(failed);
      } else {
        localStorage.removeItem(CART_STORAGE_KEY);
      }
    })();

    mergeInFlightRef.current = run.finally(() => {
      mergeInFlightRef.current = null;
    });
    return mergeInFlightRef.current;
  }, []);

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

    // Authenticated: fold in any stranded guest items FIRST, then load
    // from the server so the merged cart is what renders.
    try {
      setLoading(true);
      await mergeGuestCartIntoServer();
      const res = await api.get(API.cart.get);
      const data = res.data?.data;
      if (data?.cart) {
        setItems(data.cart.items || []);
        setTotals(data.totals || EMPTY_TOTALS);
        // Restore promo state from server cart
        if (data.cart.promoCode) {
          setPromoCodeState(data.cart.promoCode);
          setPromoApplied(true);
        } else {
          setPromoCodeState(null);
          setPromoApplied(false);
        }
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
  }, [mergeGuestCartIntoServer]);

  // Listen for auth changes across TABS. Same-tab logins never fire the
  // `storage` event — that case is covered by merge-on-read in refreshCart.
  useEffect(() => {
    const handleStorage = () => {
      const token = localStorage.getItem('pawtag_token');
      setIsAuthenticated(!!token);
      // Cart re-reads on any auth transition; refreshCart merges guest
      // items when a token is now present.
      if (!window.location.pathname.startsWith('/checkout')) {
        refreshCart();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refreshCart]);

  // Same-tab auth transitions: mirror the token into local auth state and
  // re-read the cart. refreshCart folds in stranded guest items when a
  // token is now present (merge-on-read) — this covers every login path
  // (login page, in-checkout sign-in, register) without relying on the
  // cross-tab `storage` event, which never fires in the signing-in tab.
  const prevAuthTokenRef = useRef(authToken);
  useEffect(() => {
    setIsAuthenticated(!!authToken);
    // Skip the initial run — the mount-load effect already reads the cart.
    if (prevAuthTokenRef.current === authToken) return;
    prevAuthTokenRef.current = authToken;
    if (authToken) {
      refreshCart();
    } else if (!window.location.pathname.startsWith('/checkout')) {
      // Signed out — reload as guest, but DON'T wipe the cart during
      // checkout; that page manages its own cart state and error handling.
      refreshCart();
    }
    // refreshCart is stable (empty dep chain via refs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  /* ---- Load cart on mount ---- */
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  /* ---- Add item ---- */
  const addItem = useCallback(async (item: { productId: string; quantity: number; customisation?: boolean; customisationTexts?: string[]; name?: string; price?: number; image?: string; sku?: string; customizable?: boolean; customizationLabel?: string; customizationPrice?: number; autoRenew?: boolean }) => {
    const token = localStorage.getItem('pawtag_token');
    const cust = normCustom(item.customisation);
    const custTexts = (item.customisationTexts || []).map(t => t.trim()).filter(Boolean);

    if (!token) {
      // Guest: add to localStorage
      const guestItems = getGuestCart();
      // Merge by product + customisation (not by text)
      const existing = guestItems.find(
        (i) => i.productId === item.productId && normCustom(i.customisation) === cust
      );

      if (existing) {
        existing.quantity += item.quantity;
        existing.customisationTexts = [...(existing.customisationTexts || []), ...custTexts];
        // Backfill metadata if missing
        if (item.customizable !== undefined && existing.customizable === undefined) existing.customizable = item.customizable;
        if (item.customizationLabel !== undefined && existing.customizationLabel === undefined) existing.customizationLabel = item.customizationLabel;
        if (item.customizationPrice !== undefined && existing.customizationPrice === undefined) existing.customizationPrice = item.customizationPrice;
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
          customisation: cust,
          customisationTexts: custTexts,
          customizable: item.customizable,
          customizationLabel: item.customizationLabel,
          customizationPrice: item.customizationPrice,
          autoRenew: item.autoRenew ?? true,
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
      setError(null);
      const res = await api.post(API.cart.addItem, {
        productId: item.productId,
        quantity: item.quantity,
        customisation: cust,
        customisationTexts: custTexts,
        autoRenew: item.autoRenew,
      });
      const data = res.data?.data;
      if (data?.cart) {
        setItems(data.cart.items || []);
        setTotals(data.totals || EMPTY_TOTALS);

        // Detect price changes — compare what we sent vs what server stored
        const serverItem = (data.cart.items || []).find(
          (ci: CartItem) => ci.productId === item.productId && normCustom(ci.customisation) === cust
        );
        if (serverItem && item.price && serverItem.unitPrice !== item.price) {
          setPriceChanged(true);
        }

        setLastAddedItem({
          name: item.name || 'Item',
          price: serverItem?.unitPrice || item.price || 0,
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
        setIsAuthenticated(false);
        const guestItems = getGuestCart();
        const existing = guestItems.find(
          (i) => i.productId === item.productId && normCustom(i.customisation) === cust
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
            customizationTotal: cust ? (item.customizationPrice || 0) : 0,
            quantity: item.quantity,
            image: item.image,
            customisation: cust,
            customisationTexts: cust ? (item.customisationTexts || []) : [],
            customizable: item.customizable,
            customizationLabel: item.customizationLabel,
            customizationPrice: item.customizationPrice,
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
        const msg = err?.response?.data?.error || 'Failed to add item. Please try again.';
        setError(msg);
        throw new Error(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Update item customisation texts ---- */
  const updateItemTexts = useCallback(async (itemId: string, texts: string[]) => {
    const token = localStorage.getItem('pawtag_token');

    if (!token) {
      // Guest: update in localStorage
      const guestItems = getGuestCart();
      const item = guestItems.find((i) => i._id === itemId || i.productId === itemId);
      if (item) {
        item.customisationTexts = texts;
        setGuestCart(guestItems);
        setItems([...guestItems]);
      }
      return;
    }

    // Authenticated: update on server
    try {
      setLoading(true);
      const res = await api.put(API.cart.updateItem(itemId), { customisationTexts: texts });
      const data = res.data?.data;
      if (data?.cart) {
        setItems(data.cart.items || []);
        setTotals(data.totals || EMPTY_TOTALS);
      }
    } catch (err: any) {
      if (err?.response?.status !== 401) {
        setError('Failed to update engraving');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Toggle auto-renew for a cart item ---- */
  const toggleAutoRenew = useCallback(async (itemId: string, autoRenew: boolean) => {
    const token = localStorage.getItem('pawtag_token');

    if (!token) {
      const guestItems = getGuestCart();
      const item = guestItems.find((i) => i._id === itemId || i.productId === itemId);
      if (item) {
        item.autoRenew = autoRenew;
        setGuestCart(guestItems);
        setItems([...guestItems]);
      }
      return;
    }

    try {
      const res = await api.put(API.cart.updateItem(itemId), { autoRenew });
      const data = res.data?.data;
      if (data?.cart) {
        setItems(data.cart.items || []);
      }
    } catch {
      // Surface the failure (previously silent) and re-sync to server truth
      setError('Failed to update the renewal setting. Please try again.');
      await refreshCart().catch(() => {});
    }
  }, [refreshCart]);

  /* ---- Toggle customisation on/off ---- */
  const toggleCustomisation = useCallback(async (itemId: string, enable: boolean) => {
    const token = localStorage.getItem('pawtag_token');

    if (!token) {
      // Guest: update in localStorage
      const guestItems = getGuestCart();
      const item = guestItems.find((i) => i._id === itemId || i.productId === itemId);
      if (item) {
        item.customisation = enable;
        if (!enable) {
          item.customisationTexts = [];
          item.customizationTotal = 0;
        } else {
          item.customizationTotal = item.customizationPrice || 0;
          // Initialize texts array with empty strings
          const qty = item.quantity || 1;
          item.customisationTexts = Array(qty).fill('');
        }
        setGuestCart(guestItems);
        setItems([...guestItems]);
        setTotals(calculateTotals(guestItems));
      }
      return;
    }

    // Authenticated: update on server
    try {
      setLoading(true);
      const res = await api.put(API.cart.updateItem(itemId), { customisation: enable });
      const data = res.data?.data;
      if (data?.cart) {
        setItems(data.cart.items || []);
        setTotals(data.totals || EMPTY_TOTALS);
      }
    } catch (err: any) {
      if (err?.response?.status !== 401) {
        setError('Failed to update engraving');
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
      const res = await api.delete(API.cart.removeItem(itemId));
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
      const res = await api.put(API.cart.updateItem(itemId), { quantity });
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
      await api.delete(API.cart.clear);
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

  const clearError = useCallback(() => setError(null), []);

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
    updateItemTexts,
    toggleCustomisation,
    toggleAutoRenew,
    clearCart,
    refreshCart,
    totals,
    total,
    itemCount,
    loading,
    error,
    clearError,
    lastAddedItem,
    clearLastAddedItem,
    isGuest,
    priceChanged,
    promoCode,
    promoApplied,
    setPromoCode: setPromoCodeState,
    setPromoApplied,
    freeShippingThreshold,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

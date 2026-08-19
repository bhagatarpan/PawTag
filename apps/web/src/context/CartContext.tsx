import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { sdk, getNzRegionId } from '../lib/medusa';
import api from '../lib/api';

// Backwards-compatible cart item shape for consumers
export interface CartItem {
  productId: string;      // Medusa product ID
  variantId: string;      // Medusa variant ID
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

  // Load cart from Medusa on mount
  useEffect(() => {
    const loadCart = async () => {
      const savedCartId = localStorage.getItem(CART_ID_KEY);
      if (savedCartId) {
        try {
          setLoading(true);
          const { cart: retrieved } = await sdk.store.cart.retrieve(savedCartId);
          setCart(retrieved);
        } catch {
          // Cart no longer exists — clear ID
          localStorage.removeItem(CART_ID_KEY);
        } finally {
          setLoading(false);
        }
      }
    };
    loadCart();
  }, []);

  // Derive items from Medusa cart
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

      let currentCart = cart;

      // Create cart if none exists
      if (!currentCart) {
        const regionId = await getNzRegionId();
        const { cart: newCart } = await sdk.store.cart.create({ region_id: regionId });
        currentCart = newCart;
        localStorage.setItem(CART_ID_KEY, (newCart as any).id);
        setCart(newCart);

        // Sync user to Medusa and associate with cart (fire-and-forget)
        try {
          const syncRes = await api.post('/customer/medusa-sync');
          if (syncRes.data.data?.medusaCustomerId) {
            await sdk.store.cart.update((newCart as any).id, {
              customer_id: syncRes.data.data.medusaCustomerId,
            } as any);
          }
        } catch {
          // Non-critical — cart still works without customer association
        }
      }

      // Add item to cart
      const { cart: withItem } = await sdk.store.cart.createLineItem((currentCart as any).id, {
        variant_id: item.variantId,
        quantity: item.quantity,
      });

      setCart(withItem);
    } catch (err: any) {
      setError(err?.message || err?.statusText || 'Failed to add item to cart');
    } finally {
      setLoading(false);
    }
  }, [cart]);

  const removeItem = useCallback(async (variantId: string) => {
    if (!cart) return;
    setError(null);
    try {
      setLoading(true);
      const cartId = (cart as any).id;
      const lineItem = (cart as any).items?.find((i: any) => i.variant_id === variantId);
      if (lineItem) {
        const result = await sdk.store.cart.deleteLineItem(cartId, lineItem.id);
        // deleteLineItem returns { parent: StoreCart } — the cart is in `parent`
        if (result.parent) {
          setCart(result.parent as any);
        } else {
          // Re-retrieve cart if parent not included
          const { cart: reloaded } = await sdk.store.cart.retrieve(cartId);
          setCart(reloaded);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove item');
    } finally {
      setLoading(false);
    }
  }, [cart]);

  const updateQuantity = useCallback(async (variantId: string, quantity: number) => {
    if (!cart) return;
    if (quantity <= 0) {
      removeItem(variantId);
      return;
    }
    setError(null);
    try {
      setLoading(true);
      const cartId = (cart as any).id;
      const lineItem = (cart as any).items?.find((i: any) => i.variant_id === variantId);
      if (lineItem) {
        const { cart: updated } = await sdk.store.cart.updateLineItem(cartId, lineItem.id, { quantity });
        setCart(updated);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update quantity');
    } finally {
      setLoading(false);
    }
  }, [cart, removeItem]);

  const clearCart = useCallback(async () => {
    if (!cart) return;
    // Medusa doesn't have a clear cart — delete each item
    try {
      setLoading(true);
      for (const item of cart.items) {
        await sdk.store.cart.deleteLineItem(cart.id, (item as any).id);
      }
      // Re-retrieve to get empty cart
      const { cart: empty } = await sdk.store.cart.retrieve(cart.id);
      setCart(empty);
    } catch {
      // If cart is gone, just clear state
      setCart(null);
      localStorage.removeItem(CART_ID_KEY);
    } finally {
      setLoading(false);
    }
  }, [cart]);

  // Totals in major units (cents → dollars)
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

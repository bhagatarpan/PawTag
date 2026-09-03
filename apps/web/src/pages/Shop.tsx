/**
 * @module Shop Page
 * @description Public shop page displaying PawTag products.
 *
 * Fetches products from the PawTag products API (GET /api/products).
 * stock status, and comparison table.
 *
 * Usage:
 * ```tsx
 * // Route: /shop
 * // No authentication required
 * <Shop />
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCartInteraction } from '../context/CartInteractionContext';
import { ProductCard, type ProductCardProduct } from '@pawtag/ui';
import SeoHead from '../components/SeoHead';
import { useShopPage, useSiteSettings } from '../hooks/useCms';
import { getProductBadge } from '../utils/productHelpers';
import api from '../lib/api';
import { Package } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** PawTag product from the API */
interface PawTagProduct {
  _id: string;
  name: string;
  description: string;
  shortDescription?: string;
  price: number;
  salePrice?: number;
  compareAtPrice?: number;
  currency: string;
  images: string[];
  category: string;
  tags: string[];
  isActive: boolean;
  isPublished: boolean;
  stock: number;
  reserved: number;
  sku: string;
  weight?: number;
  isSubscription: boolean;
  isTagProduct: boolean;
  subscriptionConfig?: {
    type: 'annual' | 'monthly';
    freePeriodMonths: number;
    gracePeriodWeeks: number;
    monthlyPrice?: number;
    features: string[];
  };
  badge?: string;
  sortOrder: number;
  warrantyMonths: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toCardProduct(p: PawTagProduct): ProductCardProduct {
  const effectivePrice = p.salePrice ?? p.price;
  const badge = getProductBadge(p.sku) || (p.badge ? { label: p.badge, color: 'teal' } : null);
  const available = p.stock - p.reserved;

  return {
    id: p._id,
    name: p.name,
    shortDescription: p.shortDescription || undefined,
    price: effectivePrice,
    currency: p.currency || 'NZD',
    image: p.images?.[0] || undefined,
    sku: p.sku,
    stock: available,
    monthlyPrice: p.subscriptionConfig?.monthlyPrice,
    badge: badge ? { label: badge.label, color: badge.color } : null,
    features: [
      `${p.subscriptionConfig?.freePeriodMonths || 12} months free subscription included`,
      `${p.warrantyMonths || 12} month warranty`,
      'Free NZ-wide shipping',
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Shop() {
  const [products, setProducts] = useState<PawTagProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedId, setAddedId] = useState<string | null>(null);
  const { addItem, error: cartError, clearError } = useCart();
  const { page: shopPage } = useShopPage('shop');
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';
  const navigate = useNavigate();
  const { triggerFly } = useCartInteraction();

  /* ---- Fetch products from PawTag API ---- */
  useEffect(() => {
    api.get('/products', { params: { limit: 50 } })
      .then((res) => {
        const data = res.data?.data;
        setProducts(data?.items || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* ---- Derived data ---- */
  const cardProducts = useMemo(() => products.map(toCardProduct), [products]);

  const shopTitle = useMemo(() =>
    (shopPage?.content as Record<string, unknown>)?.heroTitle as string || shopPage?.title || `Shop ${companyName}`,
    [shopPage, companyName]
  );
  const shopDesc = useMemo(() =>
    (shopPage?.content as Record<string, unknown>)?.heroDescription as string || shopPage?.subtitle || 'Choose the right PawTag for your pet. Each tag comes with 12 months free subscription.',
    [shopPage]
  );

  /* ---- Add to cart handler ---- */
  const handleAddToCart = useCallback(async (cardProduct: ProductCardProduct, e?: React.MouseEvent) => {
    const product = products.find((p) => p._id === cardProduct.id);
    if (!product) return;

    if (e) {
      e.preventDefault();
    }

    try {
      await addItem({
        productId: product._id,
        quantity: 1,
        name: product.name,
        price: product.salePrice ?? product.price,
        image: product.images?.[0],
      });

      setAddedId(product._id);
      if (e) {
        const rect = e.currentTarget?.getBoundingClientRect();
        if (rect) triggerFly(product.images?.[0] || '', rect);
      }
      setTimeout(() => setAddedId(null), 2000);
    } catch {
      // Error already set in CartContext — toast will display it
    }
  }, [products, addItem, triggerFly]);

  /* ---- Product click handler ---- */
  const handleProductClick = useCallback((cardProduct: ProductCardProduct) => {
    const product = products.find((p) => p._id === cardProduct.id);
    if (product) {
      navigate(`/shop/${product._id}`);
    }
  }, [navigate, products]);

  /* ---- Loading skeleton ---- */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-gray-200 rounded w-64" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl h-80" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SeoHead title={shopTitle} description={shopDesc} />
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{shopTitle}</h1>
          <p className="text-gray-600 mb-8">{shopDesc}</p>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {cardProducts.length === 0 ? (
              <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-gray-200">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No products available right now</h3>
                <p className="text-gray-500">We're restocking our shelves. Check back soon!</p>
              </div>
            ) : (
              cardProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={(_p, e) => handleAddToCart(product, e)}
                  onDetails={() => handleProductClick(product)}
                  added={addedId === product.id}
                />
              ))
            )}
          </div>
        </div>
      </div>
      {/* Cart Error Toast */}
      {cartError && (
        <div className="fixed top-20 right-4 z-50 animate-slide-in-right">
          <div className="bg-red-50 border border-red-200 rounded-xl shadow-xl p-3 flex items-center gap-3 max-w-xs w-full">
            <div className="flex-shrink-0 h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 text-sm font-bold">!</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800">{cartError}</p>
            </div>
            <button
              onClick={clearError}
              className="flex-shrink-0 p-1 text-red-400 hover:text-red-600 transition-colors"
            >
              <span className="sr-only">Dismiss</span>
              &times;
            </button>
          </div>
        </div>
      )}
    </>
  );
}

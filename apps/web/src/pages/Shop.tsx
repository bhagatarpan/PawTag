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
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCartInteraction } from '../context/CartInteractionContext';
import { useAuth } from '../context/AuthContext';
import { ProductCard, type ProductCardProduct } from '@pawtag/ui';
import SeoHead from '../components/SeoHead';
import { useShopPage, useSiteSettings } from '../hooks/useCms';
import { getProductBadge } from '../utils/productHelpers';
import api from '../lib/api';
import { Package, Shield, Crown } from 'lucide-react';
import analytics from '../lib/analytics';

/* ------------------------------------------------------------------ */
 /*  Types                                                              */
 /* ------------------------------------------------------------------ */

 export interface IFeatureHighlight {
    /** Icon name from Lucide icon set */
    icon: string;
    /** Description text */
    description: string;
 }

 /** PawTag product from the API */
 interface PawTagProduct {
   _id: string;
   name: string;
   slug: string;
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
    shippingDescription?: string;
    featureHighlights?: IFeatureHighlight[];
 }

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toCardProduct(
  p: PawTagProduct,
  guardianTier: string,
  isGoldMember: boolean,
  rates: { guardianRate: number; guardianSpentAmount: number; goldRate: number; goldSpentAmount: number } | null
): ProductCardProduct {
   const effectivePrice = p.salePrice ?? p.price;
   const badge = getProductBadge(p.sku) || (p.badge ? { label: p.badge, color: 'teal' } : null);
   const available = p.stock - p.reserved;

   // Calculate points earning for this product using CMS-driven formula
   let pointsEarning: { points: number; label?: string } | null = null;
   if (guardianTier) {
     const rate = rates ? (isGoldMember ? rates.goldRate : rates.guardianRate) : (isGoldMember ? 2 : 1);
     const spentAmount = rates ? (isGoldMember ? rates.goldSpentAmount : rates.guardianSpentAmount) : 1;
     const points = Math.floor((effectivePrice / spentAmount) * rate);
     pointsEarning = {
       points,
       label: isGoldMember ? 'Gold 2x' : undefined,
     };
   }

   // Show Gold upsell for Guardian members who are not Gold
   const showGoldUpsell = !!guardianTier && !isGoldMember;

   return {
      id: p._id,
      slug: p.slug,
      name: p.name,
      shortDescription: p.shortDescription || undefined,
      price: effectivePrice,
      currency: p.currency || 'NZD',
      image: p.images?.[0] || undefined,
      sku: p.sku,
      stock: available,
      monthlyPrice: p.subscriptionConfig?.monthlyPrice,
      freePeriodMonths: p.subscriptionConfig?.freePeriodMonths,
      badge: badge ? { label: badge.label, color: badge.color } : null,
      featureHighlights: p.featureHighlights && p.featureHighlights.length > 0
        ? p.featureHighlights.map(h => ({ icon: h.icon, description: h.description }))
        : undefined,
      pointsEarning,
      showGoldUpsell,
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
  const { user } = useAuth();
  const companyName = settings?.['company.name'] || 'PawTag';
  const navigate = useNavigate();
  const { triggerFly } = useCartInteraction();

  // Guardian loyalty state
  const [guardianTier, setGuardianTier] = useState<string>('');
  const [isGoldMember, setIsGoldMember] = useState(false);
  const [pointsRates, setPointsRates] = useState<{ guardianRate: number; guardianSpentAmount: number; goldRate: number; goldSpentAmount: number } | null>(null);

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

  // Fetch Guardian tier for points earning display
  useEffect(() => {
    if (user) {
      api.get('/customer/guardian/tier')
        .then(res => {
          const tierData = res.data.data;
          setGuardianTier(tierData.tier || 'CARE');
          setIsGoldMember(tierData.isGoldMember || false);
        })
        .catch(() => {});
    }
  }, [user]);

  // Fetch points rates for accurate per-product points display
  useEffect(() => {
    api.get('/public/points/rates')
      .then(res => setPointsRates(res.data.data))
      .catch(() => {});
  }, []);

  /* ---- Derived data ---- */
  const cardProducts = useMemo(() => products.map(p => toCardProduct(p, guardianTier, isGoldMember, pointsRates)), [products, guardianTier, isGoldMember, pointsRates]);

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

      // Track add to cart event
      analytics.trackAddToCart(
        product._id,
        product.name,
        product.salePrice ?? product.price,
        1
      );

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
       navigate(`/shop/${product.slug}`);
     }
   }, [navigate, products]);

  /* ---- Loading skeleton ---- */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-gray-200 rounded w-64" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
          <p className="text-gray-600 mb-4">{shopDesc}</p>

          {/* Guardian Loyalty Banner */}
          {!user && (
            <div className="mb-6 p-4 bg-gradient-to-r from-primary-50 to-amber-50 border border-primary-100 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-primary-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-primary-800">
                      <strong>Every purchase can earn rewards.</strong>{' '}
                      <span className="text-primary-600">Guardian members earn Points with every eligible purchase.</span>
                    </p>
                    <p className="text-xs text-primary-600 mt-1">
                      Join free and start earning PawRewards today.
                    </p>
                  </div>
                </div>
                <Link to="/guardian" className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors whitespace-nowrap">
                  Learn More
                </Link>
              </div>
            </div>
          )}

          {/* What You're Missing - for logged-in non-Guardian users */}
          {user && !guardianTier && (
            <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Shield className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-900">
                      <strong>You're not earning rewards yet.</strong>
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Guardian members earn points on every purchase and unlock exclusive benefits.
                    </p>
                  </div>
                </div>
                <Link to="/account/guardian" className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors whitespace-nowrap">
                  Join Free
                </Link>
              </div>
            </div>
          )}

          {/* Gold Callout - for logged-in non-Gold users */}
          {user && !isGoldMember && (
            <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Crown className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-900">
                      <strong>Earn 2× Points with Gold.</strong>
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Gold members earn double points on every purchase and start at Nurture tier.
                      Just $1.99/month.
                    </p>
                  </div>
                </div>
                <Link to="/gold" className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors whitespace-nowrap">
                  Learn About Gold
                </Link>
              </div>
            </div>
          )}

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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

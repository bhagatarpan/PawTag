/**
 * @module ProductDetail Page
 * @description Product detail page for a single PawTag product.
 *
 * Fetches product from the PawTag products API (GET /api/products/:id).
 * Displays full product information, images, and add-to-cart form.
 *
 * Usage:
 * ```tsx
 * // Route: /shop/:id
 * // No authentication required
 * <ProductDetail />
 * ```
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Shield, Truck, Check } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { getProductBadge } from '../utils/productHelpers';
import api from '../lib/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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
  stock: number;
  reserved: number;
  sku: string;
  isActive: boolean;
  isSubscription: boolean;
  isTagProduct: boolean;
  subscriptionConfig?: {
    type: 'annual' | 'monthly';
    freePeriodMonths: number;
    monthlyPrice?: number;
    features: string[];
  };
  warrantyMonths: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<PawTagProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const { addItem, error: cartError, clearError } = useCart();

  /* ---- Fetch product ---- */
  useEffect(() => {
    if (!id) return;
    api.get(`/products/${id}`)
      .then((res) => setProduct(res.data?.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  /* ---- Add to cart ---- */
  const handleAddToCart = async () => {
    if (!product) return;
    try {
      await addItem({
        productId: product._id,
        quantity,
        name: product.name,
        price: product.salePrice ?? product.price,
        image: product.images?.[0],
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    } catch {
      // Error already set in CartContext — toast will display it
    }
  };

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl h-96" />
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-10 bg-gray-200 rounded w-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---- Not found ---- */
  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
          <Link to="/shop" className="text-teal-600 hover:underline">Back to Shop</Link>
        </div>
      </div>
    );
  }

  const effectivePrice = product.salePrice ?? product.price;
  const available = product.stock - product.reserved;
  const badge = getProductBadge(product.sku);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back link */}
        <Link to="/shop" className="inline-flex items-center text-sm text-gray-600 hover:text-teal-600 mb-6">
          <ArrowLeft size={16} className="mr-1" /> Back to Shop
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Images */}
          <div>
            <div className="bg-white rounded-xl overflow-hidden">
              {product.images?.[selectedImage] ? (
                <img
                  src={product.images[selectedImage]}
                  alt={product.name}
                  className="w-full h-96 object-cover"
                />
              ) : (
                <div className="w-full h-96 bg-gray-100 flex items-center justify-center text-gray-400">
                  No image
                </div>
              )}
            </div>
            {product.images && product.images.length > 1 && (
              <div className="flex gap-2 mt-3">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${i === selectedImage ? 'border-teal-500' : 'border-gray-200'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            {badge && (
              <span className="inline-block mt-2 px-3 py-1 bg-teal-100 text-teal-700 text-sm font-medium rounded-full">
                {badge.label}
              </span>
            )}

            <p className="text-3xl font-bold text-teal-600 mt-4">
              ${effectivePrice.toFixed(2)} NZD
            </p>
            {product.compareAtPrice && product.compareAtPrice > effectivePrice && (
              <p className="text-lg text-gray-400 line-through">
                ${product.compareAtPrice.toFixed(2)}
              </p>
            )}

            {product.shortDescription && (
              <p className="text-gray-600 mt-4">{product.shortDescription}</p>
            )}

            {/* Stock status */}
            <div className="mt-4">
              {available > 0 ? (
                <span className="text-sm text-green-600">In stock ({available} available)</span>
              ) : (
                <span className="text-sm text-red-600">Out of stock</span>
              )}
            </div>

            {/* Quantity + Add to Cart */}
            <div className="flex items-center gap-4 mt-6">
              <div className="flex items-center border border-gray-300 rounded-lg">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-100"
                >
                  -
                </button>
                <span className="px-4 py-2">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-100"
                >
                  +
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={available === 0}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {added ? (
                  <><Check size={18} /> Added!</>
                ) : (
                  <><ShoppingCart size={18} /> Add to Cart</>
                )}
              </button>
            </div>

            {/* Features */}
            <div className="mt-6 space-y-3 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-teal-600" />
                {product.warrantyMonths || 12} month warranty
              </div>
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-teal-600" />
                Free NZ-wide shipping
              </div>
              {product.isSubscription && (
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-teal-600" />
                  {product.subscriptionConfig?.freePeriodMonths || 12} months free subscription
                </div>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                <div className="text-gray-600 text-sm" dangerouslySetInnerHTML={{ __html: product.description }} />
              </div>
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
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, PawPrint, Shield, Truck, Check, AlertCircle } from 'lucide-react';
import { sdk } from '../lib/medusa';
import { useCart } from '../context/CartContext';
import { getProductBadge, getProductIcon } from '../utils/productHelpers';
import type { StoreProduct } from '@medusajs/types';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const { addItem } = useCart();

  useEffect(() => {
    if (!id) return;
    sdk.store.product.retrieve(id, { fields: '*variants.prices,*images,*type,*tags' })
      .then(({ product: p }) => setProduct(p))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = () => {
    if (!product) return;
    const variant = product.variants?.[0];
    if (!variant) return;
    addItem({
      productId: product.id,
      variantId: variant.id,
      name: product.title,
      price: variant.prices?.[0]?.amount || 0,
      quantity,
      image: product.thumbnail || undefined,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const getProductIconForSku = (sku: string) => getProductIcon(sku, 'lg');
  const getBadge = (handle: string) => getProductBadge(handle);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <PawPrint className="h-16 w-16 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-700">Product not found</h2>
        <Link to="/shop" className="text-primary-600 hover:text-primary-700 font-medium">
          ← Back to Shop
        </Link>
      </div>
    );
  }

  const badge = getBadge(product.handle || '');
  const variant = product.variants?.[0];
  const price = variant ? (variant.prices?.[0]?.amount || 0) : 0;
  const monthlyPrice = (product.metadata as any)?.subscriptionConfig?.monthlyPrice || 0;
  const images = (product.images || []).map((img: any) => img.url).filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <Link to="/shop" className="hover:text-teal-600 flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Shop
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image / Placeholder */}
          <div className="space-y-4">
            <div className="relative bg-gradient-to-br from-primary-50 to-primary-100 rounded-2xl overflow-hidden aspect-square flex items-center justify-center">
              {images.length > 0 ? (
                <img
                  src={images[selectedImage] || images[0]}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-primary-300">
                  {getProductIconForSku(product.handle || '')}
                  <PawPrint className="h-40 w-40" />
                </div>
              )}
              {badge && (
                <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold ${badge.color}`}>
                  {badge.label}
                </div>
              )}
              {images.length > 1 && (
                <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                  {selectedImage + 1} / {images.length}
                </div>
              )}
            </div>
            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      i === selectedImage
                        ? 'border-primary-500 ring-2 ring-primary-200'
                        : 'border-gray-200 hover:border-gray-300 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`${product.title} ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              {product.type && (
                <span className="text-sm font-medium text-primary-600 uppercase tracking-wide">{product.type.value}</span>
              )}
              <h1 className="text-3xl font-bold text-gray-900 mt-2">{product.title}</h1>
              {product.subtitle && (
                <p className="text-sm text-gray-500 mt-1">{product.subtitle}</p>
              )}
            </div>

            {/* Price */}
            <div className="bg-primary-50 rounded-xl p-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-primary-700">${price.toFixed(2)}</span>
                <span className="text-base text-gray-500">NZD</span>
              </div>
              <p className="text-sm text-primary-600 mt-1">
                Includes 12 months free subscription
                {monthlyPrice > 0 && (
                  <> — then ${monthlyPrice.toFixed(2)}/month billed annually</>
                )}
              </p>
            </div>

            {/* Description */}
            <div className="border-t border-b border-gray-200 py-6">
              <p className="text-gray-600 leading-relaxed">{product.description}</p>
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${variant ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className={`text-sm font-medium ${variant ? 'text-green-700' : 'text-red-600'}`}>
                {variant ? 'In stock' : 'Out of stock'}
              </span>
            </div>

            {/* Quantity & Add to Cart */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Quantity:</label>
                <div className="flex items-center border border-gray-300 rounded-lg">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-l-lg">-</button>
                  <span className="px-6 py-2 font-medium">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-r-lg">+</button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!variant || added}
                className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl font-semibold text-lg transition-all ${
                  added
                    ? 'bg-green-500 text-white'
                    : !variant
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-primary-600 text-white hover:bg-primary-700 active:scale-[0.98] shadow-lg shadow-primary-200'
                }`}
              >
                <ShoppingCart className="h-6 w-6" />
                {added ? 'Added to Cart!' : !variant ? 'Out of Stock' : `Add to Cart — $${(price * quantity).toFixed(2)}`}
              </button>
            </div>

            {/* Info Badges */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <Shield className="h-8 w-8 text-primary-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900 text-sm">12 Month Warranty</p>
                  <p className="text-gray-500 text-xs">Normal wear & tear</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <Truck className="h-8 w-8 text-primary-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900 text-sm">NZ-Wide Shipping</p>
                  <p className="text-gray-500 text-xs">From $7.99</p>
                </div>
              </div>
            </div>

            {/* Warranty Details */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" /> Warranty & Shipping
              </h4>
              <ul className="text-xs text-gray-600 space-y-1 ml-6">
                <li>• 12 month warranty on normal wear and tear</li>
                <li>• Physical damage (chewing, bending, breakage) not covered</li>
                <li>• Warranty replacements shipped with a shipping charge</li>
                <li>• Shipping: $7.99 NZ cities/suburbs, $10.99 rural/villages</li>
                <li>• Lost or damaged? Replacement at full cost as new</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

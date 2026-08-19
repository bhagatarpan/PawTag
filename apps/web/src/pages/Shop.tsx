import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, PawPrint, Check, Shield, Smartphone, Wifi, Zap } from 'lucide-react';
import { sdk } from '../lib/medusa';
import { useCart } from '../context/CartContext';
import SeoHead from '../components/SeoHead';
import { useShopPage, useSiteSettings } from '../hooks/useCms';
import { getProductBadge, getProductIcon } from '../utils/productHelpers';
import type { StoreProduct } from '@medusajs/types';

const COMPARISON_FEATURES = [
  { key: 'technology', label: 'Technology', scan: 'QR Code', classic: 'NFC + QR', plus: 'NFC + QR' },
  { key: 'material', label: 'Material', scan: 'Plastic', classic: 'Plastic', plus: 'Metal edges + Epoxy resin' },
  { key: 'scan_method', label: 'Scan Method', scan: 'Phone camera', classic: 'Phone tap', plus: 'Phone tap' },
  { key: 'durability', label: 'Durability', scan: 'Standard', classic: 'Standard', plus: 'Heavy-duty' },
  { key: 'subscription', label: 'Free Subscription', scan: '12 months', classic: '12 months', plus: '12 months' },
  { key: 'after_free', label: 'After Free Period', scan: '$0.99/mo', classic: '$1.99/mo', plus: '$1.99/mo' },
  { key: 'warranty', label: 'Warranty', scan: '12 months', classic: '12 months', plus: '12 months' },
  { key: 'shipping', label: 'Shipping', scan: 'Free NZ-wide', classic: 'Free NZ-wide', plus: 'Free NZ-wide' },
];

export default function Shop() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const { addItem } = useCart();
  const { page: shopPage } = useShopPage('shop');
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { products: medusaProducts } = await sdk.store.product.list({
        fields: '*variants.prices,*images,*type,*tags',
      });
      setProducts(medusaProducts || []);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: any) => {
    const variant = product.variants?.[0];
    if (!variant) return;
    setAddingId(product.id);
    addItem({
      productId: product.id,
      variantId: variant.id,
      name: product.title,
      price: (variant.prices?.[0]?.amount || 0) / 100,
      quantity: 1,
      image: product.thumbnail || undefined,
    });
    setTimeout(() => setAddingId(null), 1000);
  };

  const getBadge = (handle: string) => getProductBadge(handle);
  const getMonthlyPrice = (product: StoreProduct) => {
    // Subscription price from metadata
    return (product.metadata as any)?.subscriptionConfig?.monthlyPrice || 0;
  };

  const shopTitle = (shopPage?.content as Record<string, unknown>)?.heroTitle as string || shopPage?.title || `Shop ${companyName}`;
  const shopDesc = (shopPage?.content as Record<string, unknown>)?.heroDescription as string || shopPage?.subtitle || 'Choose the right PawTag for your pet. Each tag comes with 12 months free subscription.';

  return (
    <div className="min-h-screen bg-gray-50">
      <SeoHead
        title="Shop"
        description={shopDesc}
        keywords={['shop', 'pet tags', 'QR code tags', 'NFC tags', 'pet recovery', 'buy tags']}
      />

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-primary-700 to-primary-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-4">{shopTitle}</h1>
          <p className="text-primary-100 text-lg max-w-2xl mx-auto">
            {shopDesc}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Product Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200" />
                <div className="p-6 space-y-3">
                  <div className="h-6 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-10 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {products.map((product) => {
              const badge = getBadge(product.handle || '');
              const variant = product.variants?.[0];
              const price = variant ? (variant.prices?.[0]?.amount || 0) / 100 : 0;
              const monthlyPrice = getMonthlyPrice(product);
              const isMostOrdered = badge?.label === 'Most Ordered';
              return (
                <div key={product.id} className={`bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-primary-200 hover:shadow-lg transition-all duration-300 overflow-hidden relative ${isMostOrdered ? 'ring-2 ring-amber-400 scale-[1.02]' : ''}`}>
                  {badge && (
                    <div className={`absolute top-4 left-4 z-10 px-3 py-1 rounded-full text-xs font-bold ${badge.color}`}>
                      {badge.label}
                    </div>
                  )}

                  <div className="relative h-48 bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
                    {product.thumbnail ? (
                      <img src={product.thumbnail} alt={product.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-primary-300">
                        {getProductIcon(product.handle || '', 'sm')}
                        <PawPrint className="h-20 w-20" />
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{product.title}</h3>
                    {product.subtitle && (
                      <p className="text-sm text-gray-500 mb-4">{product.subtitle}</p>
                    )}

                    <div className="mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-primary-700">${price.toFixed(2)}</span>
                        <span className="text-sm text-gray-500">NZD</span>
                      </div>
                      {monthlyPrice > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          + ${monthlyPrice.toFixed(2)}/mo after 12 months free
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 mb-6">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>12 months free subscription included</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>12 month warranty</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>Free NZ-wide shipping</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        to={`/shop/${product.id}`}
                        className="flex-1 py-3 border border-primary-600 text-primary-600 rounded-xl font-medium hover:bg-primary-50 transition-all text-center text-sm"
                      >
                        Details
                      </Link>
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={!variant || addingId === product.id}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all text-sm ${
                          addingId === product.id
                            ? 'bg-green-500 text-white'
                            : !variant
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'bg-primary-600 text-white hover:bg-primary-700 active:scale-[0.98]'
                        }`}
                      >
                        <ShoppingCart className="h-4 w-4" />
                        {addingId === product.id ? 'Added!' : !variant ? 'Unavailable' : 'Add to Cart'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Comparison Table */}
        {!loading && products.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-12">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Compare PawTag Models</h2>
              <p className="text-gray-500 mt-1">Find the right tag for your pet</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-500 w-1/4">Feature</th>
                    <th className="text-center px-4 py-4 w-1/4">
                      <div className="flex flex-col items-center gap-1">
                        <Smartphone className="h-5 w-5 text-blue-500" />
                        <span className="text-sm font-bold text-gray-900">PawTag Scan</span>
                        <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">Essential</span>
                      </div>
                    </th>
                    <th className="text-center px-4 py-4 w-1/4 bg-amber-50/50">
                      <div className="flex flex-col items-center gap-1">
                        <Wifi className="h-5 w-5 text-amber-500" />
                        <span className="text-sm font-bold text-gray-900">PawTag Classic</span>
                        <span className="text-xs text-amber-700 font-medium bg-amber-100 px-2 py-0.5 rounded-full">Most Ordered</span>
                      </div>
                    </th>
                    <th className="text-center px-4 py-4 w-1/4">
                      <div className="flex flex-col items-center gap-1">
                        <Zap className="h-5 w-5 text-purple-500" />
                        <span className="text-sm font-bold text-gray-900">PawTag Plus</span>
                        <span className="text-xs text-purple-600 font-medium bg-purple-50 px-2 py-0.5 rounded-full">Premium</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_FEATURES.map((feat, i) => (
                    <tr key={feat.key} className={i % 2 === 0 ? 'bg-gray-50/50' : ''}>
                      <td className="px-6 py-3 text-sm font-medium text-gray-700">{feat.label}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">{feat.scan}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600 bg-amber-50/30 font-medium">{feat.classic}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">{feat.plus}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-gray-200">
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">Price</td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-lg font-bold text-primary-700">$9.99</span>
                    </td>
                    <td className="px-4 py-4 text-center bg-amber-50/30">
                      <span className="text-lg font-bold text-primary-700">$19.99</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-lg font-bold text-primary-700">$39.99</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Warranty & Shipping Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-8 w-8 text-primary-600" />
              <h3 className="text-lg font-bold text-gray-900">12 Month Warranty</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Every PawTag comes with a <strong>12 month warranty</strong> covering normal wear and tear.
              Physical damage such as chewing, bending, or key holder breakage is not covered.
              Warranty replacements are shipped free.
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <PawPrint className="h-8 w-8 text-primary-600" />
              <h3 className="text-lg font-bold text-gray-900">NZ-Wide Shipping</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Shipping is <strong>free</strong> for all New Zealand addresses — city, suburb, and rural.
              All PawTag products are shipped from Auckland.
            </p>
          </div>
        </div>

        {/* Replacement Note */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <p className="text-sm text-amber-800">
            <strong>Lost or damaged your PawTag?</strong> Replacement tags are available at full cost as new.
            Your subscription continues on your replacement tag.
          </p>
        </div>
      </div>
    </div>
  );
}

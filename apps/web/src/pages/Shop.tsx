import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, PawPrint, Check, Smartphone, Wifi, Shield, Zap } from 'lucide-react';
import api from '../lib/api';
import { useCart } from '../context/CartContext';
import { Product } from '../types';
import SeoHead from '../components/SeoHead';
import { useShopPage, useSiteSettings } from '../hooks/useCms';

const PRODUCT_BADGES: Record<string, { label: string; color: string }> = {
  'PT-SCAN-001': { label: 'Essential', color: 'bg-blue-100 text-blue-700' },
  'PT-CLASSIC-001': { label: 'Most Ordered', color: 'bg-amber-100 text-amber-700' },
  'PT-PLUS-001': { label: 'Premium', color: 'bg-purple-100 text-purple-700' },
};

const COMPARISON_FEATURES = [
  { key: 'technology', label: 'Technology', scan: 'QR Code', classic: 'NFC + QR', plus: 'NFC + QR' },
  { key: 'material', label: 'Material', scan: 'Plastic', classic: 'Plastic', plus: 'Metal edges + Epoxy resin' },
  { key: 'scan_method', label: 'Scan Method', scan: 'Phone camera', classic: 'Phone tap', plus: 'Phone tap' },
  { key: 'durability', label: 'Durability', scan: 'Standard', classic: 'Standard', plus: 'Heavy-duty' },
  { key: 'subscription', label: 'Free Subscription', scan: '12 months', classic: '12 months', plus: '12 months' },
  { key: 'after_free', label: 'After Free Period', scan: '$0.99/mo', classic: '$1.99/mo', plus: '$1.99/mo' },
  { key: 'warranty', label: 'Warranty', scan: '12 months', classic: '12 months', plus: '12 months' },
  { key: 'shipping', label: 'Shipping', scan: 'From $7.99', classic: 'From $7.99', plus: 'From $7.99' },
];

export default function Shop() {
  const [products, setProducts] = useState<Product[]>([]);
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
      const res = await api.get('/finder/shop/products');
      setProducts(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    setAddingId(product._id);
    addItem({
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.images?.[0],
    });
    setTimeout(() => setAddingId(null), 1000);
  };

  const getBadge = (sku: string) => PRODUCT_BADGES[sku];
  const getProductIcon = (sku: string) => {
    if (sku === 'PT-SCAN-001') return <Smartphone className="h-6 w-6" />;
    if (sku === 'PT-PLUS-001') return <Zap className="h-6 w-6" />;
    return <Wifi className="h-6 w-6" />;
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
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-4">{shopTitle}</h1>
          <p className="text-teal-100 text-lg max-w-2xl mx-auto">
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
              const badge = getBadge(product.sku);
              const monthlyPrice = product.subscriptionConfig?.monthlyPrice || 0;
              return (
                <div key={product._id} className={`bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all overflow-hidden relative ${badge?.label === 'Most Ordered' ? 'ring-2 ring-amber-400 scale-[1.02]' : ''}`}>
                  {badge && (
                    <div className={`absolute top-4 left-4 z-10 px-3 py-1 rounded-full text-xs font-bold ${badge.color}`}>
                      {badge.label}
                    </div>
                  )}

                  <div className="relative h-48 bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-teal-300">
                        {getProductIcon(product.sku)}
                        <PawPrint className="h-20 w-20" />
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{product.name}</h3>
                    <p className="text-sm text-gray-500 mb-4">{product.shortDescription}</p>

                    <div className="mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-teal-700">${product.price.toFixed(2)}</span>
                        <span className="text-sm text-gray-500">NZD</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        + ${monthlyPrice.toFixed(2)}/mo after 12 months free
                      </p>
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
                        <span>Ships NZ-wide</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        to={`/shop/${product._id}`}
                        className="flex-1 py-3 border border-teal-600 text-teal-600 rounded-xl font-medium hover:bg-teal-50 transition-all text-center text-sm"
                      >
                        Details
                      </Link>
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={product.stock <= 0 || addingId === product._id}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all text-sm ${
                          addingId === product._id
                            ? 'bg-green-500 text-white'
                            : product.stock <= 0
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'bg-teal-600 text-white hover:bg-teal-700 active:scale-[0.98]'
                        }`}
                      >
                        <ShoppingCart className="h-4 w-4" />
                        {addingId === product._id ? 'Added!' : product.stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
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
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-12">
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
                      <span className="text-lg font-bold text-teal-700">$9.99</span>
                    </td>
                    <td className="px-4 py-4 text-center bg-amber-50/30">
                      <span className="text-lg font-bold text-teal-700">$19.99</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-lg font-bold text-teal-700">$39.99</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Warranty & Shipping Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-8 w-8 text-teal-600" />
              <h3 className="text-lg font-bold text-gray-900">12 Month Warranty</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Every PawTag comes with a <strong>12 month warranty</strong> covering normal wear and tear.
              Physical damage such as chewing, bending, or key holder breakage is not covered.
              Warranty replacements are shipped with a shipping charge.
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <PawPrint className="h-8 w-8 text-teal-600" />
              <h3 className="text-lg font-bold text-gray-900">NZ-Wide Shipping</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Shipping is <strong>$7.99</strong> for NZ main cities and suburbs, or <strong>$10.99</strong> for rural and village addresses.
              All PawTag products are shipped from New Zealand. Free shipping may be introduced in the future.
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

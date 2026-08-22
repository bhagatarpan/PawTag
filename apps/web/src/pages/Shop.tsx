import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, PawPrint, Check, Shield, Smartphone, Wifi, Zap } from 'lucide-react';
import { sdk } from '../lib/medusa';
import { useCart } from '../context/CartContext';
import { useCartInteraction } from '../context/CartInteractionContext';
import { ProductCard, type ProductCardProduct } from '@pawtag/ui';
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

function toCardProduct(p: StoreProduct): ProductCardProduct {
  const variant = p.variants?.[0] as any;
  const price = variant?.prices?.[0]?.amount || 0;
  const monthlyPrice = (p.metadata as any)?.subscriptionConfig?.monthlyPrice || 0;
  const badge = getProductBadge(p.handle || '');
  return {
    id: p.id,
    name: p.title,
    shortDescription: (p as any).subtitle || undefined,
    price,
    currency: 'NZD',
    image: p.thumbnail || undefined,
    sku: variant?.sku || '',
    stock: 999,
    monthlyPrice: monthlyPrice > 0 ? monthlyPrice : undefined,
    badge: badge ? { label: badge.label, color: badge.color } : null,
    features: [
      '12 months free subscription included',
      '12 month warranty',
      'Free NZ-wide shipping',
    ],
  };
}

export default function Shop() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedId, setAddedId] = useState<string | null>(null);
  const { addItem } = useCart();
  const { page: shopPage } = useShopPage('shop');
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  useEffect(() => {
    sdk.store.product
      .list({ fields: '*variants.prices,*images,*type,*tags' })
      .then(({ products: p }) => setProducts(p || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const { triggerFly } = useCartInteraction();

  const handleAddToCart = useCallback((cardProduct: ProductCardProduct, e?: React.MouseEvent) => {
    const variant = products.find((p) => p.id === cardProduct.id)?.variants?.[0];
    if (!variant) return;

    // Find the product image element for flying animation
    if (e) {
      const card = (e.currentTarget as HTMLElement).closest('[data-product-image]')?.parentElement;
      const imgEl = card?.querySelector('[data-product-image]');
      if (imgEl && cardProduct.image) {
        triggerFly(cardProduct.image, imgEl.getBoundingClientRect());
      }
    }

    setAddedId(cardProduct.id);
    addItem({
      productId: cardProduct.id,
      variantId: variant.id,
      name: cardProduct.name,
      price: cardProduct.price,
      quantity: 1,
      image: cardProduct.image,
    });
    setTimeout(() => setAddedId(null), 1000);
  }, [products, addItem, triggerFly]);

  const shopTitle = (shopPage?.content as Record<string, unknown>)?.heroTitle as string || shopPage?.title || `Shop ${companyName}`;
  const shopDesc = (shopPage?.content as Record<string, unknown>)?.heroDescription as string || shopPage?.subtitle || 'Choose the right PawTag for your pet. Each tag comes with 12 months free subscription.';

  return (
    <div className="min-h-screen bg-gray-50">
      <SeoHead title="Shop" description={shopDesc} keywords={['shop', 'pet tags', 'QR code tags', 'NFC tags', 'pet recovery', 'buy tags']} />

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-primary-700 to-primary-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-4">{shopTitle}</h1>
          <p className="text-primary-100 text-lg max-w-2xl mx-auto">{shopDesc}</p>
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
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={toCardProduct(product)}
                onAddToCart={(p, e) => handleAddToCart(p, e)}
                onDetails={(p) => window.location.href = `/shop/${p.id}`}
                added={addedId === product.id}
              />
            ))}
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
                    <td className="px-4 py-4 text-center"><span className="text-lg font-bold text-primary-700">$9.99</span></td>
                    <td className="px-4 py-4 text-center bg-amber-50/30"><span className="text-lg font-bold text-primary-700">$19.99</span></td>
                    <td className="px-4 py-4 text-center"><span className="text-lg font-bold text-primary-700">$39.99</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-8 w-8 text-primary-600" />
              <h3 className="text-lg font-bold text-gray-900">12 Month Warranty</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">Every PawTag comes with a <strong>12 month warranty</strong> covering normal wear and tear.</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <PawPrint className="h-8 w-8 text-primary-600" />
              <h3 className="text-lg font-bold text-gray-900">NZ-Wide Shipping</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">Shipping is <strong>free</strong> for all New Zealand addresses.</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <p className="text-sm text-amber-800"><strong>Lost or damaged your PawTag?</strong> Replacement tags are available at full cost as new.</p>
        </div>
      </div>
    </div>
  );
}

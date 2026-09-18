import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft } from 'lucide-react';
import { useCart } from '../context/CartContext';
import CartItemCard from '../components/cart/CartItemCard';
import OrderSummary from '../components/cart/OrderSummary';

export default function CartPage() {
  const navigate = useNavigate();
  const { items, totals, loading, updateQuantity, removeItem } = useCart();

  const handleCheckout = () => {
    navigate('/checkout');
  };

  const isEmpty = items.length === 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your Cart</h1>
            <p className="text-sm text-gray-500 mt-1">
              {items.length} item{items.length !== 1 ? 's' : ''}
            </p>
          </div>
          <a
            href="/shop"
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 transition-colors"
          >
            <ArrowLeft size={16} />
            Continue Shopping
          </a>
        </div>

        {isEmpty ? (
          /* Empty State */
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <ShoppingCart size={48} className="text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
            <p className="text-gray-500 mb-6">Browse our tags and find the perfect one for your pet.</p>
            <a
              href="/shop"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              Shop Now
            </a>
          </div>
        ) : (
          /* 70/30 Layout */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            {/* Left 70% - Cart Items */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Cart Items</h2>
              <div className="divide-y divide-gray-100">
                {items.map((item) => (
                  <CartItemCard
                    key={item._id || item.productId}
                    item={item}
                    onUpdateQuantity={updateQuantity}
                    onRemove={removeItem}
                  />
                ))}
              </div>
            </div>

            {/* Right 30% - Order Summary (sticky) */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <OrderSummary
                subtotal={totals?.subtotal || 0}
                discount={totals?.discount || 0}
                shipping={totals?.shipping || 0}
                tax={totals?.tax || 0}
                total={totals?.total || 0}
                currency={totals?.currency || 'NZD'}
                itemCount={items.length}
                onCheckout={handleCheckout}
                loading={loading}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

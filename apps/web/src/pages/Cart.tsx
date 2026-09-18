import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import CartHeader from '../components/cart/CartHeader';
import CartEmptyState from '../components/cart/CartEmptyState';
import CartSkeleton from '../components/cart/CartSkeleton';
import CartIssueBanner from '../components/cart/CartIssueBanner';
import CartPriceChangeBanner from '../components/cart/CartPriceChangeBanner';
import CartInventoryBanner from '../components/cart/CartInventoryBanner';
import CartItemCard from '../components/cart/CartItemCard';
import OrderSummary from '../components/cart/OrderSummary';

export default function CartPage() {
  const navigate = useNavigate();
  const { items, totals, loading, error, updateQuantity, removeItem, refreshCart } = useCart();
  const { user } = useAuth();

  const handleCheckout = () => {
    navigate('/checkout');
  };

  const isEmpty = items.length === 0 && !loading;
  const isGuest = !user;

  // Guardian/Gold points calculation
  const guardianTier = (user as any)?.rbacRoles?.find((r: any) => r.name === 'GOLD') ? 'GOLD' : null;
  const pointsEarning = totals && totals.total > 0 ? {
    points: Math.floor(totals.total * (guardianTier === 'GOLD' ? 2 : 1)),
    isGoldMember: guardianTier === 'GOLD',
  } : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <CartHeader itemCount={items.length} />

        {/* Loading state */}
        {loading && items.length === 0 ? (
          <CartSkeleton />
        ) : isEmpty ? (
          /* Empty state */
          <CartEmptyState />
        ) : (
          /* Cart with items */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            {/* Left 70% - Cart Items */}
            <div>
              {/* Error banner */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-700">
                  {error}
                  <button
                    onClick={refreshCart}
                    className="ml-2 text-red-600 hover:text-red-800 underline"
                  >
                    Retry
                  </button>
                </div>
              )}

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

              {/* Guest info */}
              {isGuest && (
                <div className="bg-primary-50 border border-primary-100 rounded-lg p-4 mt-4">
                  <p className="text-sm text-primary-800">
                    <strong>Guest checkout:</strong> Your cart is saved in this browser.{' '}
                    <a href="/login" className="text-primary-600 hover:underline">Sign in</a> to save it to your account and earn Guardian Points.
                  </p>
                </div>
              )}
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
                onContinueShopping={() => navigate('/shop')}
                loading={loading}
                isGuest={isGuest}
                pointsEarning={pointsEarning}
                guardianTier={guardianTier}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

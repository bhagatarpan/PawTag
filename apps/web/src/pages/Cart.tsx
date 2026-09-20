import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';
import CartHeader from '../components/cart/CartHeader';
import CartEmptyState from '../components/cart/CartEmptyState';
import CartSkeleton from '../components/cart/CartSkeleton';
import CartItemCard from '../components/cart/CartItemCard';
import OrderSummary from '../components/cart/OrderSummary';

export default function CartPage() {
  const navigate = useNavigate();
  const { items, totals, loading, error, updateQuantity, removeItem, refreshCart, promoCode, promoApplied, setPromoCode: setPromoCodeCtx, setPromoApplied: setPromoAppliedCtx } = useCart();
  const { user } = useAuth();

  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');

  const applyPromoCode = useCallback(async (code: string) => {
    if (!code || !user) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      await api.post(API.cart.promo.apply, { code });
      setPromoCodeCtx(code);
      setPromoAppliedCtx(true);
      await refreshCart();
    } catch (err: any) {
      setPromoError(err?.response?.data?.error || 'Invalid promo code');
      setPromoCodeCtx('');
      setPromoAppliedCtx(false);
    } finally {
      setPromoLoading(false);
    }
  }, [user, setPromoCodeCtx, setPromoAppliedCtx, refreshCart]);

  const removePromoCode = useCallback(async () => {
    try {
      if (user) await api.delete(API.cart.promo.remove);
      setPromoCodeCtx('');
      setPromoAppliedCtx(false);
      await refreshCart();
    } catch (err: any) {
      setPromoError(err?.message || 'Failed to remove promo code');
    }
  }, [user, setPromoCodeCtx, setPromoAppliedCtx, refreshCart]);

  const handleCheckout = () => {
    navigate('/checkout');
  };

  const isEmpty = items.length === 0 && !loading;
  const isGuest = !user;

  // Guardian/Gold points calculation
  const guardianTier = user?.rbacRoles?.find((r) => r.name === 'GOLD') ? 'GOLD' : null;
  const pointsEarning = totals && totals.total > 0 ? {
    points: Math.floor(totals.total * (guardianTier === 'GOLD' ? 2 : 1)),
    isGoldMember: guardianTier === 'GOLD',
  } : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 pb-24 lg:pb-8">
      <div className="max-w-[1280px] mx-auto">
        <CartHeader itemCount={items.length} />

        {/* Loading state */}
        {loading && items.length === 0 ? (
          <CartSkeleton />
        ) : isEmpty ? (
          /* Empty state */
          <CartEmptyState />
        ) : (
          /* Cart with items — 12-column grid: 8 cols left, 4 cols right */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            {/* Left 67% — Cart Items */}
            <div className="lg:col-span-8">
              {/* Error banner */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
                  {error}
                  <button
                    onClick={refreshCart}
                    className="ml-2 text-red-600 hover:text-red-800 underline font-medium"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Product cards */}
              <div className="space-y-4">
                {items.map((item) => (
                  <CartItemCard
                    key={item._id || item.productId}
                    item={item}
                    onUpdateQuantity={updateQuantity}
                    onRemove={removeItem}
                  />
                ))}
              </div>

              {/* Guest messaging — corrected wording */}
              {isGuest && (
                <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-5">
                  <p className="text-sm text-amber-900">
                    Your cart is saved on this device.{' '}
                    <a href="/login" className="font-semibold text-amber-700 hover:text-amber-800 underline">
                      Sign in or create an account
                    </a>{' '}
                    to continue to checkout and save your cart.
                  </p>
                </div>
              )}
            </div>

            {/* Right 33% — Order Summary (sticky) */}
            <div className="lg:col-span-4">
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
                  promoCode={promoCode || undefined}
                  promoApplied={promoApplied}
                  promoError={promoError}
                  onApplyPromo={user ? applyPromoCode : undefined}
                  onRemovePromo={user ? removePromoCode : undefined}
                  promoLoading={promoLoading}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile sticky checkout bar */}
      {!isEmpty && !loading && items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-gray-200 px-4 py-3 z-40 safe-area-pb">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</p>
              <p className="text-lg font-bold text-gray-900">${(totals?.total || 0).toFixed(2)}</p>
            </div>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="flex-shrink-0 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

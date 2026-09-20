import { useState } from 'react';
import { Lock, Shield, Tag, Loader2, X, ArrowLeft } from 'lucide-react';
import PromoCodeControl from './PromoCodeControl';

export { type PromoCodeControlProps } from './PromoCodeControl';

interface OrderSummaryProps {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  itemCount: number;
  promoCode?: string;
  promoApplied?: boolean;
  promoError?: string;
  onApplyPromo?: (code: string) => Promise<void>;
  onRemovePromo?: () => void;
  onCheckout: () => void;
  onContinueShopping?: () => void;
  isGuest?: boolean;
  loading?: boolean;
  promoLoading?: boolean;
  /** Guardian points earning info */
  pointsEarning?: { points: number; isGoldMember?: boolean } | null;
  /** User's Guardian tier */
  guardianTier?: string | null;
}

export default function OrderSummary({
  subtotal,
  discount,
  shipping,
  tax,
  total,
  currency,
  itemCount,
  promoCode,
  promoApplied,
  promoError,
  onApplyPromo,
  onRemovePromo,
  onCheckout,
  onContinueShopping,
  isGuest = false,
  loading = false,
  promoLoading = false,
  pointsEarning = null,
  guardianTier = null,
}: OrderSummaryProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* 1. Order summary heading */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>

      {/* 2-7. Price breakdown */}
      <div className="space-y-3 text-sm">
        {/* 2. Merchandise subtotal */}
        <div className="flex justify-between text-gray-600">
          <span>Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
          <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
        </div>

        {/* 3. Discount/promo (only if API validated) */}
        {discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount{promoCode ? ` (${promoCode})` : ''}</span>
            <span className="font-medium">-${discount.toFixed(2)}</span>
          </div>
        )}

        {/* 4. Shipping */}
        <div className="flex justify-between text-gray-600">
          <span>Shipping</span>
          <span className="font-medium text-gray-900">
            {shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}
          </span>
        </div>

        {/* 5. GST/tax */}
        {tax > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>GST (included)</span>
            <span className="font-medium text-gray-900">${tax.toFixed(2)}</span>
          </div>
        )}

        {/* 6. Divider + Estimated total */}
        <div className="border-t border-gray-200 pt-3 mt-3">
          <div className="flex justify-between items-baseline">
            <span className="text-base font-bold text-gray-900">Estimated Total</span>
            <span className="text-lg font-bold text-gray-900">${total.toFixed(2)} {currency}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Final total at checkout</p>
        </div>
      </div>

      {/* Promo Code */}
      {onApplyPromo && (
        <div className="mt-4">
          <PromoCodeControl
            promoCode={promoCode}
            promoApplied={promoApplied}
            promoError={promoError}
            onApply={onApplyPromo}
            onRemove={onRemovePromo}
            loading={promoLoading}
          />
        </div>
      )}

      {/* Guardian/Gold benefit — compact module */}
      {pointsEarning && pointsEarning.points > 0 && (
        <div className={`mt-4 p-3 rounded-lg text-sm ${
          pointsEarning.isGoldMember
            ? 'bg-amber-50 border border-amber-200'
            : 'bg-primary-50 border border-primary-100'
        }`}>
          {pointsEarning.isGoldMember ? (
            <>
              <p className="font-medium text-amber-800">Guardian Gold</p>
              <p className="text-amber-700 text-xs mt-1">
                You'll earn <strong>{pointsEarning.points} PawRewards</strong> on this order (2x Gold bonus)
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-primary-800">
                Earn {pointsEarning.points} PawRewards
              </p>
              {!guardianTier && isGuest && (
                <a href="/guardian" className="text-primary-600 hover:underline text-xs mt-1 inline-block">
                  Join Guardian to start earning →
                </a>
              )}
            </>
          )}
        </div>
      )}

      {/* 8. Primary Checkout button */}
      <button
        onClick={onCheckout}
        disabled={loading || itemCount === 0}
        className="w-full mt-6 bg-primary-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Lock size={16} />
        {loading ? 'Processing...' : 'Secure Checkout'}
      </button>

      {/* 9. Payment/security reassurance */}
      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-500">
        <Shield size={12} />
        <span>Secure checkout powered by Stripe</span>
      </div>

      {/* 10. Continue shopping link */}
      {onContinueShopping && (
        <button
          onClick={onContinueShopping}
          className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 py-1"
        >
          <ArrowLeft size={14} />
          Continue Shopping
        </button>
      )}

      {/* Guest prompt */}
      {isGuest && (
        <p className="text-center text-xs text-gray-500 mt-3">
          <a href="/login" className="text-primary-600 hover:underline">Sign in</a> to save your cart and earn rewards
        </p>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Lock, Shield, Tag, Loader2, X, ArrowLeft } from 'lucide-react';

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
  onApplyPromo?: (code: string) => Promise<void>;
  onRemovePromo?: () => void;
  onCheckout: () => void;
  onContinueShopping?: () => void;
  isGuest?: boolean;
  loading?: boolean;
  promoLoading?: boolean;
}

function PromoCodeControl({
  promoCode,
  promoApplied,
  onApply,
  onRemove,
  loading,
}: {
  promoCode?: string;
  promoApplied?: boolean;
  onApply?: (code: string) => Promise<void>;
  onRemove?: () => void;
  loading?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');

  if (promoApplied && promoCode) {
    return (
      <div className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-green-700">
          <Tag size={14} />
          <span className="font-medium">{promoCode}</span>
          <span>applied</span>
        </div>
        <button
          onClick={onRemove}
          className="text-green-600 hover:text-green-800 p-1"
          aria-label="Remove promo code"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
      >
        Have a promo code?
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter code"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        />
        <button
          onClick={() => onApply?.(code)}
          disabled={!code || loading}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
        </button>
      </div>
      <button
        onClick={() => { setIsOpen(false); setCode(''); }}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        Cancel
      </button>
    </div>
  );
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
  onApplyPromo,
  onRemovePromo,
  onCheckout,
  onContinueShopping,
  isGuest = false,
  loading = false,
  promoLoading = false,
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
            onApply={onApplyPromo}
            onRemove={onRemovePromo}
            loading={promoLoading}
          />
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

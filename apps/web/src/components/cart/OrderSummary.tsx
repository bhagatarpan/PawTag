import { Lock, Shield } from 'lucide-react';

interface OrderSummaryProps {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  itemCount: number;
  promoCode?: string;
  onCheckout: () => void;
  isGuest?: boolean;
  loading?: boolean;
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
  onCheckout,
  isGuest = false,
  loading = false,
}: OrderSummaryProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>

      {/* Line items */}
      <div className="space-y-3 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
          <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
        </div>

        {discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount{promoCode ? ` (${promoCode})` : ''}</span>
            <span className="font-medium">-${discount.toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between text-gray-600">
          <span>Shipping</span>
          <span className="font-medium text-gray-900">
            {shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}
          </span>
        </div>

        {tax > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>GST</span>
            <span className="font-medium text-gray-900">${tax.toFixed(2)}</span>
          </div>
        )}

        <div className="border-t border-gray-200 pt-3 mt-3">
          <div className="flex justify-between">
            <span className="text-base font-bold text-gray-900">Estimated Total</span>
            <span className="text-lg font-bold text-gray-900">${total.toFixed(2)} {currency}</span>
          </div>
        </div>
      </div>

      {/* Checkout Button */}
      <button
        onClick={onCheckout}
        disabled={loading || itemCount === 0}
        className="w-full mt-6 bg-primary-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Lock size={16} />
        {loading ? 'Processing...' : 'Continue to Checkout'}
      </button>

      {/* Security reassurance */}
      <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-500">
        <Shield size={12} />
        <span>Secure checkout powered by Stripe</span>
      </div>

      {/* Guest prompt */}
      {isGuest && (
        <p className="text-center text-xs text-gray-500 mt-3">
          <a href="/login" className="text-primary-600 hover:underline">Sign in</a> to save your cart and earn rewards
        </p>
      )}
    </div>
  );
}

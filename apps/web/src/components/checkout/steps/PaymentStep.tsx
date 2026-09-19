import { Shield, Lock, CreditCard } from 'lucide-react';

interface PaymentStepProps {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  itemCount: number;
  shippingAddress: { line1: string; city: string; zip: string };
  children: React.ReactNode; // StripePaymentForm
  onBack: () => void;
}

export default function PaymentStep({
  subtotal,
  discount,
  shipping,
  tax,
  total,
  currency,
  itemCount,
  shippingAddress,
  children,
  onBack,
}: PaymentStepProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      {/* Left 70% - Payment Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <CreditCard size={20} />
          Payment Details
        </h2>
        {children}
      </div>

      {/* Right 30% - Order Summary */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>

          {/* Shipping address summary */}
          <div className="pb-4 mb-4 border-b border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Shipping to</p>
            <p className="text-sm text-gray-900">{shippingAddress.line1}</p>
            <p className="text-sm text-gray-600">{shippingAddress.city} {shippingAddress.zip}</p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
              <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
            </div>

            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
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
                <span>GST (included)</span>
                <span className="font-medium text-gray-900">${tax.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="flex justify-between items-baseline">
                <span className="text-base font-bold text-gray-900">Total</span>
                <span className="text-lg font-bold text-gray-900">${total.toFixed(2)} {currency}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onBack}
            className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            Back to Shipping
          </button>
        </div>
      </div>
    </div>
  );
}

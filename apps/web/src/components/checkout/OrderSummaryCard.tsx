import { Package, PawPrint } from 'lucide-react';

interface OrderItem {
  productName?: string;
  name?: string;
  quantity: number;
  unitPrice?: number;
  price?: number;
  customisationTexts?: string[];
}

interface OrderSummaryCardProps {
  items: OrderItem[];
  subtotal: number;
  shipping?: number;
  total: number;
  shippingAddress?: {
    line1: string;
    city: string;
    zip: string;
  };
  showShipping?: boolean;
}

export default function OrderSummaryCard({
  items,
  subtotal,
  shipping = 0,
  total,
  shippingAddress,
  showShipping = true,
}: OrderSummaryCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <Package className="h-4 w-4" /> Order Summary
      </h2>

      {/* Items */}
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary-50 rounded-lg flex items-center justify-center">
                <PawPrint className="h-5 w-5 text-primary-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{item.productName || item.name}</p>
                {item.customisationTexts && item.customisationTexts.length > 0 && item.customisationTexts.some((t: string) => t) && (
                  <div className="text-xs text-primary-600">
                    {item.customisationTexts.filter((t: string) => t).map((t: string, i: number) => (
                      <p key={i}>Pet name: {t}</p>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-900">NZ${(item.unitPrice || 0).toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>NZ${subtotal.toFixed(2)}</span>
        </div>
        {showShipping && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Shipping</span>
            <span className={shipping === 0 ? 'text-green-600 font-medium' : 'text-gray-900 font-medium'}>
              {shipping === 0 ? 'FREE' : `NZ$${shipping.toFixed(2)}`}
            </span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-100">
          <span>Total</span>
          <span className="text-primary-700">NZ${total.toFixed(2)}</span>
        </div>
      </div>

      {/* Shipping Address */}
      {shippingAddress && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-1">Shipping to</p>
          <p className="text-sm text-gray-700">
            {shippingAddress.line1}, {shippingAddress.city} {shippingAddress.zip}
          </p>
        </div>
      )}
    </div>
  );
}

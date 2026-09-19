import { Tag, Trash2 } from 'lucide-react';

interface CartItem {
  _id?: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  image?: string;
  customisation?: boolean;
  customisationTexts?: string[];
  customizationTotal?: number;
  isSubscription?: boolean;
}

interface CartReviewStepProps {
  items: CartItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onContinue: () => void;
}

export default function CartReviewStep({
  items,
  subtotal,
  discount,
  shipping,
  tax,
  total,
  currency,
  onUpdateQuantity,
  onRemove,
  onContinue,
}: CartReviewStepProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      {/* Left 70% - Cart Items */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Review Your Order</h2>
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <CartItemCard
              key={item._id || item.productId}
              item={item}
              onUpdateQuantity={onUpdateQuantity}
              onRemove={onRemove}
            />
          ))}
        </div>
      </div>

      {/* Right 30% - Order Summary */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</span>
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
              <p className="text-xs text-gray-500 mt-1">Final total at checkout</p>
            </div>
          </div>

          <button
            onClick={onContinue}
            className="w-full mt-6 bg-primary-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors"
          >
            Continue to Shipping
          </button>

          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-500">
            <span>Secure checkout powered by Stripe</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartItemCard({ item, onUpdateQuantity, onRemove }: {
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}) {
  const lineTotal = (item.unitPrice + (item.customizationTotal || 0)) * item.quantity;
  const hasCustomization = item.customisation && item.customisationTexts && item.customisationTexts.length > 0;

  return (
    <div className="flex gap-4 py-4">
      {/* Product Image */}
      <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
        {item.image ? (
          <img src={item.image} alt={item.productName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Tag size={20} />
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm">{item.productName}</h3>
            {item.isSubscription && (
              <span className="text-xs text-primary-600">Subscription</span>
            )}
          </div>
          <p className="font-semibold text-gray-900 text-sm">${lineTotal.toFixed(2)}</p>
        </div>

        {/* Customization */}
        {hasCustomization && (
          <div className="mt-1 text-xs text-primary-600">
            {item.customisationTexts?.filter(t => t).map((text, i) => (
              <span key={i}>"{text}" </span>
            ))}
            {item.customizationTotal ? (
              <span className="text-primary-500">+${item.customizationTotal.toFixed(2)}/unit</span>
            ) : null}
          </div>
        )}

        {/* Price breakdown */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onUpdateQuantity(item._id || item.productId, item.quantity - 1)}
              disabled={item.quantity <= 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              aria-label={`Decrease quantity of ${item.productName}`}
            >
              -
            </button>
            <span className="w-8 text-center font-medium">{item.quantity}</span>
            <button
              onClick={() => onUpdateQuantity(item._id || item.productId, item.quantity + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              aria-label={`Increase quantity of ${item.productName}`}
            >
              +
            </button>
          </div>

          <button
            onClick={() => onRemove(item._id || item.productId)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
            aria-label={`Remove ${item.productName} from cart`}
          >
            <Trash2 size={14} />
            <span>Remove</span>
          </button>
        </div>
      </div>
    </div>
  );
}

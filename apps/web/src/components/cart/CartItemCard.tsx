import { useState } from 'react';
import { Minus, Plus, Trash2, Tag, Loader2, AlertCircle } from 'lucide-react';

interface CartItemCardProps {
  item: {
    _id?: string;
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    image?: string;
    customisation?: boolean;
    customisationTexts?: string[];
    customizationTotal?: number;
    customizationLabel?: string;
    autoRenew?: boolean;
    isSubscription?: boolean;
  };
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}

export default function CartItemCard({ item, onUpdateQuantity, onRemove }: CartItemCardProps) {
  const [updating, setUpdating] = useState(false);
  const lineTotal = (item.unitPrice + (item.customizationTotal || 0)) * item.quantity;
  const hasCustomization = item.customisation && item.customisationTexts && item.customisationTexts.length > 0;

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity < 1) return;
    setUpdating(true);
    try {
      onUpdateQuantity(item._id || item.productId, newQuantity);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex gap-4 py-4 border-b border-gray-100 last:border-0">
      {/* Product Image */}
      <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt={item.productName}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Tag size={24} />
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900">{item.productName}</h3>

            {/* Subscription badge */}
            {item.isSubscription && (
              <span className="inline-flex items-center gap-1 text-xs text-primary-600 mt-1">
                <Tag size={12} /> Subscription
              </span>
            )}
          </div>

          {/* Line total */}
          <div className="text-right">
            <p className="font-semibold text-gray-900">${lineTotal.toFixed(2)}</p>
          </div>
        </div>

        {/* Customisation details */}
        {hasCustomization && (
          <div className="mt-2 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2">
            <p className="text-xs font-medium text-primary-700 mb-1">
              {item.customizationLabel || 'Customisation'}
            </p>
            {item.customisationTexts?.map((text, i) => (
              <p key={i} className="text-sm text-primary-800">"{text}"</p>
            ))}
            {item.customizationTotal ? (
              <p className="text-xs text-primary-600 mt-1">
                +${item.customizationTotal.toFixed(2)} per unit
              </p>
            ) : null}
          </div>
        )}

        {/* Price breakdown */}
        <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
          <span>${item.unitPrice.toFixed(2)} × {item.quantity}</span>
          {hasCustomization && item.customizationTotal ? (
            <span className="text-primary-600">+ ${item.customizationTotal.toFixed(2)} customisation</span>
          ) : null}
        </div>

        {/* Quantity Controls + Remove */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            {/* Decrement */}
            <button
              onClick={() => handleQuantityChange(item.quantity - 1)}
              disabled={item.quantity <= 1 || updating}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              aria-label={`Decrease quantity of ${item.productName}`}
            >
              {updating ? <Loader2 size={14} className="animate-spin" /> : <Minus size={14} />}
            </button>

            {/* Quantity display */}
            <span
              className="w-10 text-center font-semibold text-gray-900"
              aria-live="polite"
              aria-label={`Quantity: ${item.quantity}`}
            >
              {item.quantity}
            </span>

            {/* Increment */}
            <button
              onClick={() => handleQuantityChange(item.quantity + 1)}
              disabled={updating}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              aria-label={`Increase quantity of ${item.productName}`}
            >
              {updating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            </button>
          </div>

          {/* Remove button */}
          <button
            onClick={() => onRemove(item._id || item.productId)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            aria-label={`Remove ${item.productName} from cart`}
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Remove</span>
          </button>
        </div>
      </div>
    </div>
  );
}

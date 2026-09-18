import { Minus, Plus, Trash2, Tag } from 'lucide-react';

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
    autoRenew?: boolean;
    isSubscription?: boolean;
  };
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}

export default function CartItemCard({ item, onUpdateQuantity, onRemove }: CartItemCardProps) {
  const lineTotal = (item.unitPrice + (item.customizationTotal || 0)) * item.quantity;
  const hasCustomization = item.customisation && item.customisationTexts && item.customisationTexts.length > 0;

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
            <h3 className="font-semibold text-gray-900 truncate">{item.productName}</h3>
            {hasCustomization && (
              <p className="text-sm text-gray-500 mt-0.5 truncate">
                Engraving: {item.customisationTexts?.join(', ')}
              </p>
            )}
            {item.isSubscription && (
              <span className="inline-flex items-center gap-1 text-xs text-primary-600 mt-1">
                <Tag size={12} /> Subscription
              </span>
            )}
          </div>
          <p className="font-semibold text-gray-900 whitespace-nowrap">
            ${lineTotal.toFixed(2)}
          </p>
        </div>

        {/* Price breakdown */}
        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
          <span>${item.unitPrice.toFixed(2)} each</span>
          {hasCustomization && item.customizationTotal ? (
            <span>+ ${item.customizationTotal.toFixed(2)} customisation</span>
          ) : null}
        </div>

        {/* Quantity Controls + Remove */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdateQuantity(item._id || item.productId, Math.max(1, item.quantity - 1))}
              disabled={item.quantity <= 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus size={14} />
            </button>
            <span className="w-8 text-center font-medium text-gray-900">{item.quantity}</span>
            <button
              onClick={() => onUpdateQuantity(item._id || item.productId, item.quantity + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              aria-label="Increase quantity"
            >
              <Plus size={14} />
            </button>
          </div>

          <button
            onClick={() => onRemove(item._id || item.productId)}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
            aria-label="Remove item"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

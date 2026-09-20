import { useState } from 'react';
import { Minus, Plus, Trash2, Tag, Loader2, AlertTriangle } from 'lucide-react';

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
    /** Stock status from server */
    stock?: number;
    /** Price change from server */
    priceChanged?: boolean;
    /** Server is refreshing this item */
    refreshing?: boolean;
  };
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  /** Whether this item was just added (triggers highlight animation) */
  isNew?: boolean;
}

export default function CartItemCard({ item, onUpdateQuantity, onRemove, isNew = false }: CartItemCardProps) {
  const [updating, setUpdating] = useState(false);
  const lineTotal = (item.unitPrice + (item.customizationTotal || 0)) * item.quantity;
  const hasCustomization = item.customisation && item.customisationTexts && item.customisationTexts.length > 0;

  // Determine stock status
  const isOutOfStock = item.stock === 0;
  const isLowStock = item.stock !== undefined && item.stock > 0 && item.stock <= 5;
  const quantityExceedsStock = item.stock !== undefined && item.quantity > item.stock;

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity < 1) return;
    setUpdating(true);
    try {
      onUpdateQuantity(item._id || item.productId, newQuantity);
    } finally {
      setUpdating(false);
    }
  };

  // Determine card status border
  const statusBorder = isOutOfStock
    ? 'border-red-200 bg-red-50/30'
    : quantityExceedsStock
    ? 'border-amber-200 bg-amber-50/30'
    : 'border-gray-200 bg-white';

  return (
    <div
      className={`relative rounded-xl border p-5 transition-all duration-300 ease-out ${statusBorder} ${
        isNew ? 'ring-2 ring-primary-500 ring-offset-2 animate-[highlight_0.5s_ease-out]' : ''
      } ${item.refreshing ? 'opacity-60 pointer-events-none' : ''}`}
      style={{
        animation: isNew ? 'highlight 0.5s ease-out' : undefined,
      }}
    >
      {/* Refreshing overlay */}
      {item.refreshing && (
        <div className="absolute inset-0 bg-white/50 rounded-xl flex items-center justify-center z-10">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      )}

      <div className="flex gap-4">
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
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 text-[15px]">{item.productName}</h3>

              {/* Subscription badge */}
              {item.isSubscription && (
                <span className="inline-flex items-center gap-1 text-xs text-primary-600 mt-1 bg-primary-50 px-2 py-0.5 rounded-full">
                  <Tag size={12} /> Auto-renew
                </span>
              )}

              {/* Customisation details */}
              {hasCustomization && (
                <div className="mt-2 bg-primary-50/60 border border-primary-100 rounded-lg px-3 py-2">
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
            </div>

            {/* Line total */}
            <div className="text-right flex-shrink-0">
              <p className="font-semibold text-gray-900 text-[15px]">
                ${lineTotal.toFixed(2)}
              </p>
              {item.quantity > 1 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  ${item.unitPrice.toFixed(2)} each
                </p>
              )}
            </div>
          </div>

          {/* Stock warnings */}
          {isOutOfStock && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle size={12} />
              <span>Out of stock</span>
            </div>
          )}
          {isLowStock && !isOutOfStock && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle size={12} />
              <span>Only {item.stock} left in stock</span>
            </div>
          )}
          {quantityExceedsStock && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle size={12} />
              <span>Maximum available: {item.stock}</span>
            </div>
          )}

          {/* Quantity controls + Remove */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleQuantityChange(item.quantity - 1)}
                disabled={updating || item.quantity <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Decrease quantity"
              >
                <Minus size={14} />
              </button>
              <span className="w-10 text-center text-sm font-medium text-gray-900">
                {updating ? <Loader2 className="animate-spin mx-auto" size={14} /> : item.quantity}
              </span>
              <button
                onClick={() => handleQuantityChange(item.quantity + 1)}
                disabled={updating || (item.stock !== undefined && item.quantity >= item.stock)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Increase quantity"
              >
                <Plus size={14} />
              </button>
            </div>

            <button
              onClick={() => onRemove(item._id || item.productId)}
              disabled={updating}
              className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
              aria-label={`Remove ${item.productName}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

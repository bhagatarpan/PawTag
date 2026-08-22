import { useEffect, useState } from 'react';
import { Check, ShoppingCart, X } from 'lucide-react';
import { useCart, type AddedItem } from '../context/CartContext';

export default function CartToast() {
  const { lastAddedItem, clearLastAddedItem } = useCart();
  const [visible, setVisible] = useState(false);
  const [displayItem, setDisplayItem] = useState<AddedItem | null>(null);

  useEffect(() => {
    if (lastAddedItem) {
      setDisplayItem(lastAddedItem);
      setVisible(true);

      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => {
          clearLastAddedItem();
          setDisplayItem(null);
        }, 300); // Wait for exit animation
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [lastAddedItem, clearLastAddedItem]);

  if (!displayItem) return null;

  return (
    <div
      className={`fixed top-20 right-4 z-50 transition-all duration-300 ease-out ${
        visible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-3 flex items-center gap-3 max-w-xs w-full">
        {/* Success checkmark */}
        <div className="flex-shrink-0 h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
          <Check className="h-4 w-4 text-green-600" />
        </div>

        {/* Product info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {displayItem.image ? (
            <img
              src={displayItem.image}
              alt={displayItem.name}
              className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="h-5 w-5 text-primary-300" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-green-700">Added to cart</p>
            <p className="text-sm font-medium text-gray-900 truncate">{displayItem.name}</p>
            <p className="text-xs text-gray-500">
              ${displayItem.price.toFixed(2)} · Qty {displayItem.quantity}
            </p>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(() => {
              clearLastAddedItem();
              setDisplayItem(null);
            }, 300);
          }}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ShoppingCart, Truck, X } from 'lucide-react';
import { useCart, type AddedItem } from '../context/CartContext';
import { freeShippingProgress } from '../lib/cart-progress';

/**
 * "Added to cart" confirmation. Fixed-position so it is visible at ANY scroll
 * depth — the user never has to scroll up to confirm the action worked.
 * For members, also shows progress toward their free-shipping threshold.
 */
export default function CartToast() {
  const { lastAddedItem, clearLastAddedItem, totals, freeShippingThreshold } = useCart();
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
      }, 3500);

      return () => clearTimeout(timer);
    }
  }, [lastAddedItem, clearLastAddedItem]);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => {
      clearLastAddedItem();
      setDisplayItem(null);
    }, 300);
  };

  if (!displayItem) return null;

  // Display-only progress; null for guests/non-members (no server threshold).
  const progress = freeShippingProgress(totals.subtotal, freeShippingThreshold);

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
      <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-3 max-w-sm w-full">
        <div className="flex items-center gap-3">
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
            onClick={dismiss}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Free-shipping progress (members only — server-resolved threshold) */}
        {progress && (
          <div className="mt-2.5 px-1">
            <div className="flex items-center gap-1.5 text-xs">
              <Truck className={`h-3.5 w-3.5 shrink-0 ${progress.unlocked ? 'text-green-600' : 'text-primary-600'}`} />
              {progress.unlocked ? (
                <span className="font-medium text-green-700">You've unlocked free shipping</span>
              ) : (
                <span className="text-gray-600">
                  You're <span className="font-semibold text-gray-900">${progress.remaining.toFixed(2)}</span> away from free shipping
                </span>
              )}
            </div>
            <div
              className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress toward free shipping"
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${progress.unlocked ? 'bg-green-500' : 'bg-primary-500'}`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* View cart action */}
        <div className="mt-2.5 pt-2 border-t border-gray-100 flex justify-end">
          <Link
            to="/cart"
            onClick={dismiss}
            className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
          >
            View cart
          </Link>
        </div>
      </div>
    </div>
  );
}

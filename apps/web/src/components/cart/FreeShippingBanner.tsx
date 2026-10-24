import { Truck, CheckCircle } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { freeShippingProgress } from '../../lib/cart-progress';

/**
 * Free-shipping progress banner (concept board 3). Display only: the
 * threshold comes from the server-resolved entitlement (`freeShippingThreshold`)
 * and progress math lives in `lib/cart-progress` — this never applies or
 * changes shipping; authoritative totals stay in server cart/checkout.
 * Renders nothing when the server applies no threshold.
 */
export default function FreeShippingBanner({ className = '' }: { className?: string }) {
  const { totals, freeShippingThreshold } = useCart();
  const progress = freeShippingProgress(totals?.subtotal || 0, freeShippingThreshold);
  if (!progress) return null;

  return (
    <div
      role="status"
      className={`rounded-2xl border p-4 ${
        progress.unlocked ? 'bg-primary-50 border-primary-100' : 'bg-white border-gray-200'
      } ${className}`}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary-600"
        >
          {progress.unlocked ? <CheckCircle size={18} /> : <Truck size={18} />}
        </span>
        <p className="text-sm font-medium text-gray-900">
          {progress.unlocked ? (
            'Free shipping unlocked'
          ) : (
            <>
              Add <span className="font-semibold">${progress.remaining.toFixed(2)}</span> more for
              free shipping
            </>
          )}
        </p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
        <div
          className="h-full rounded-full bg-primary-600 transition-all duration-500"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <span className="sr-only">
        {progress.percent}% of the way to the ${progress.threshold.toFixed(2)} free-shipping
        threshold
      </span>
    </div>
  );
}

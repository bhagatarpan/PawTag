import { useState } from 'react';
import { Tag, X, Loader2 } from 'lucide-react';

export interface PromoCodeControlProps {
  promoCode?: string;
  promoApplied?: boolean;
  promoError?: string;
  onApply?: (code: string) => Promise<void>;
  onRemove?: () => void;
  loading?: boolean;
}

/**
 * Reusable promo code control component.
 * Used in both Cart (OrderSummary) and Checkout (Review step).
 *
 * Design tokens from DESIGN.md:
 * - Green badge: bg-green-50, text-green-700
 * - Primary button: bg-primary-600, text-white, rounded-xl
 * - Ghost link: text-primary-600
 */
export default function PromoCodeControl({
  promoCode,
  promoApplied,
  promoError,
  onApply,
  onRemove,
  loading,
}: PromoCodeControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');

  if (promoApplied && promoCode) {
    return (
      <div className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-green-700">
          <Tag size={14} />
          <span className="font-medium">{promoCode}</span>
          <span>applied</span>
        </div>
        <button
          onClick={onRemove}
          className="text-green-600 hover:text-green-800 p-1"
          aria-label="Remove promo code"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
      >
        Have a promo code?
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter code"
          className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        />
        <button
          onClick={() => onApply?.(code)}
          disabled={!code || loading}
          className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
        </button>
      </div>
      <button
        onClick={() => { setIsOpen(false); setCode(''); }}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        Cancel
      </button>
      {promoError && (
        <p className="text-xs text-red-500 mt-1" role="alert">{promoError}</p>
      )}
    </div>
  );
}

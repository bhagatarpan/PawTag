import { useEffect, useState } from 'react';
import { CreditCard, Loader2, Plus, Star } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import {
  formatSavedPaymentMethodLabel,
  type SavedPaymentMethod,
} from '@pawtag/shared';
import api from '../lib/api';

interface SavedPaymentMethodPickerProps {
  /** Selected saved card id, or null for "use a different card" (Stripe new-card form). */
  selectedPaymentMethodId: string | null;
  onSelect: (paymentMethodId: string | null) => void;
  /** Called with the loaded cards so the parent can show a matching pay-button label. */
  onCardsLoaded?: (cards: SavedPaymentMethod[]) => void;
}

function isExpired(pm: SavedPaymentMethod): boolean {
  if (!pm.expMonth || !pm.expYear) return false;
  const now = new Date();
  const endOfMonth = new Date(pm.expYear, pm.expMonth, 1); // first day after expiry month
  return endOfMonth <= now;
}

/**
 * Compact saved-card selector for checkout / membership payment steps.
 * Reuses GET /membership/payment-methods (user-scoped; Stripe is source of truth).
 * Renders nothing when the customer has no saved cards, so the existing
 * new-card flow is untouched.
 */
export default function SavedPaymentMethodPicker({
  selectedPaymentMethodId,
  onSelect,
  onCardsLoaded,
}: SavedPaymentMethodPickerProps) {
  const [cards, setCards] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get(API.customer.membership.paymentMethods)
      .then((res) => {
        if (cancelled) return;
        const list: SavedPaymentMethod[] = res.data?.data || [];
        setCards(list);
        onCardsLoaded?.(list);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your saved cards.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // onCardsLoaded is a parent callback; fetch once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
        <Loader2 size={14} className="animate-spin" /> Loading saved cards…
      </div>
    );
  }

  // No cards (or list failed) → parent keeps the existing new-card flow.
  if (error || cards.length === 0) return null;

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-gray-900 mb-1">Payment method</legend>
      {cards.map((card) => {
        const expired = isExpired(card);
        const value = card.id;
        return (
          <label
            key={card.id}
            className={`flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
              selectedPaymentMethodId === value
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            } ${expired ? 'opacity-60' : ''}`}
          >
            <input
              type="radio"
              name="saved-payment-method"
              value={value}
              checked={selectedPaymentMethodId === value}
              onChange={() => onSelect(value)}
              disabled={expired}
              className="text-primary-600 focus:ring-primary-500"
            />
            <CreditCard size={18} className="text-gray-400 shrink-0" />
            <span className="flex-1 min-w-0 text-sm text-gray-900">
              {formatSavedPaymentMethodLabel(card)}
              {expired && <span className="ml-2 text-xs text-red-600 font-medium">Expired</span>}
            </span>
            {card.isDefault && !expired && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 shrink-0">
                <Star size={10} className="fill-amber-400 text-amber-400" /> Default
              </span>
            )}
          </label>
        );
      })}

      <label
        className={`flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
          selectedPaymentMethodId === null
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <input
          type="radio"
          name="saved-payment-method"
          value=""
          checked={selectedPaymentMethodId === null}
          onChange={() => onSelect(null)}
          className="text-primary-600 focus:ring-primary-500"
        />
        <Plus size={18} className="text-gray-400 shrink-0" />
        <span className="text-sm text-gray-900">Use a different card</span>
      </label>
    </fieldset>
  );
}

import { useEffect, useState } from 'react';
import { CreditCard, Loader2, Star, Trash2 } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import {
  formatSavedPaymentMethodLabel,
  type SavedPaymentMethod,
} from '@pawtag/shared';
import { EmptyState } from '@pawtag/ui';
import api from '../lib/api';
import SetupPaymentMethodForm from './SetupPaymentMethodForm';

interface PaymentMethodsPanelProps {
  /** When true, hide destructive actions (used in compact contexts). */
  readOnly?: boolean;
  onChanged?: () => void;
}

/**
 * Multi saved payment methods manager (Stripe Customer source of truth).
 * One default; multiple cards; add / set default / remove.
 */
export default function PaymentMethodsPanel({ readOnly = false, onChanged }: PaymentMethodsPanelProps) {
  const [items, setItems] = useState<SavedPaymentMethod[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(API.customer.membership.paymentMethods);
      setItems(res.data?.data || []);
      setDefaultId(res.data?.defaultPaymentMethodId || null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetDefault(pm: SavedPaymentMethod) {
    setActionId(pm.id);
    setError('');
    try {
      const res = await api.post(API.customer.membership.paymentMethodsDefault, {
        paymentMethodId: pm.id,
      });
      setItems(res.data?.data || []);
      const next = (res.data?.data || []).find((p: SavedPaymentMethod) => p.isDefault);
      setDefaultId(next?.id || pm.id);
      onChanged?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to set default payment method');
    } finally {
      setActionId(null);
    }
  }

  async function handleRemove(pm: SavedPaymentMethod) {
    if (!window.confirm(`Remove ${formatSavedPaymentMethodLabel(pm)}?`)) return;
    setActionId(pm.id);
    setError('');
    try {
      const res = await api.post(API.customer.membership.paymentMethodsDetach, {
        paymentMethodId: pm.id,
      });
      setItems(res.data?.data || []);
      const next = (res.data?.data || []).find((p: SavedPaymentMethod) => p.isDefault);
      setDefaultId(next?.id || null);
      onChanged?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove payment method');
    } finally {
      setActionId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
        <Loader2 size={16} className="animate-spin" /> Loading payment methods…
      </div>
    );
  }

  return (
    <div data-testid="payment-methods-panel">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Payment Methods</h2>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            {showAdd ? 'Close' : 'Add payment method'}
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {showAdd && !readOnly && (
        <div className="mb-4">
          <SetupPaymentMethodForm
            onCompleted={() => {
              setShowAdd(false);
              load();
              onChanged?.();
            }}
          />
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="No saved payment methods"
          description="Add a card to speed up checkout and membership renewals."
        />
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map((pm) => (
            <div key={pm.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                  <CreditCard size={18} className="text-primary-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {formatSavedPaymentMethodLabel(pm)}
                  </p>
                  {pm.isDefault && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 mt-0.5">
                      <Star size={12} className="fill-current" /> Default
                    </span>
                  )}
                </div>
              </div>
              {!readOnly && (
                <div className="flex items-center gap-2 shrink-0">
                  {!pm.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(pm)}
                      disabled={actionId === pm.id}
                      className="text-xs font-medium text-primary-600 hover:text-primary-700 px-2 py-1"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${formatSavedPaymentMethodLabel(pm)}`}
                    onClick={() => handleRemove(pm)}
                    disabled={actionId === pm.id}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {actionId === pm.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">
        Your default card is used for membership renewals and Keep My Membership when payment is required.
        Saving is optional — you can manage cards anytime here.
      </p>
    </div>
  );
}

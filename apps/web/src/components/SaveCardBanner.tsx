import { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../../lib/api';

/**
 * Post-purchase optional save-card banner.
 * Yes → confirm-save (promote default only if none). Not now → dismiss only.
 * Does not block checkout/membership success.
 */
export default function SaveCardBanner({
  onDismiss,
  onSaved,
}: {
  onDismiss?: () => void;
  onSaved?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setBusy(true);
    setError('');
    try {
      await api.post(API.customer.membership.paymentMethodsConfirmSave, {});
      setDone(true);
      onSaved?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to save payment method');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4 flex items-start gap-3" data-testid="save-card-done">
        <CheckCircle2 size={20} className="text-green-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-green-900">Payment method saved</p>
          <p className="text-sm text-green-800 mt-0.5">
            It will be available for future purchases and membership renewals. Manage cards anytime under Membership → Payment Methods.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-4" data-testid="save-card-banner">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Save this card for faster checkout?</p>
          <p className="text-sm text-gray-600 mt-1">
            Securely save it with Stripe for future purchases and yearly memberships. Saving is optional — you can manage or remove cards later.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss save card offer"
          onClick={() => onDismiss?.()}
          className="p-1 rounded text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>
      </div>
      {error && (
        <div role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Yes, save this card'}
        </button>
        <button
          type="button"
          onClick={() => onDismiss?.()}
          disabled={busy}
          className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-white"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

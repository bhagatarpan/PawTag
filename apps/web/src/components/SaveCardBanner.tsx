import { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';
import SetupPaymentMethodForm from './SetupPaymentMethodForm';

/**
 * Post-purchase optional save-card offer for shop **and** membership purchases.
 * - PMs already on Stripe Customer → confirm-save (default only if none)
 * - No PMs yet → SetupIntent add-card form (never fake "saved" success)
 */
export default function SaveCardBanner({
  onDismiss,
  onSaved,
}: {
  onDismiss?: () => void;
  onSaved?: () => void;
}) {
  const [phase, setPhase] = useState<'loading' | 'offer' | 'add' | 'done'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hasPms, setHasPms] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get(API.customer.membership.paymentMethods)
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.data || [];
        setHasPms(list.length > 0);
        setPhase(list.length > 0 ? 'offer' : 'add');
      })
      .catch(() => {
        if (!cancelled) setPhase('add');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConfirmSave() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(API.customer.membership.paymentMethodsConfirmSave, {});
      const payload = res.data?.data;
      if (payload?.saved === false || (payload?.data && payload.data.length === 0)) {
        setError(
          'No saved card was found on your account yet. Add a card below — we could not save the checkout card automatically.',
        );
        setPhase('add');
        setBusy(false);
        return;
      }
      setPhase('done');
      onSaved?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to save payment method');
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'done') {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4 flex items-start gap-3" data-testid="save-card-done">
        <CheckCircle2 size={20} className="text-green-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-green-900">Payment method saved</p>
          <p className="text-sm text-green-800 mt-0.5">
            Available for future shop purchases and membership renewals. Manage cards anytime under{' '}
            <span className="font-semibold">Account → Membership → Payment Methods</span>.
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
        Checking your saved payment methods…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-4" data-testid="save-card-banner">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {hasPms ? 'Save this card for faster checkout?' : 'Add a card for faster checkout?'}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {hasPms
              ? 'Securely keep this card with Stripe for future shop purchases and yearly memberships. Saving is optional — you can manage or remove cards later.'
              : 'Add a card securely with Stripe for future shop purchases and yearly memberships. Saving is optional.'}
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

      {phase === 'offer' && (
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleConfirmSave}
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
      )}

      {phase === 'add' && (
        <div className="mt-3">
          <SetupPaymentMethodForm
            onCompleted={() => {
              setPhase('done');
              onSaved?.();
            }}
          />
        </div>
      )}
    </div>
  );
}

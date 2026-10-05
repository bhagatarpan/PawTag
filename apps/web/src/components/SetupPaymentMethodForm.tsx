import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2 } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../../lib/api';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

function SetupForm({ clientSecret, onCompleted }: { clientSecret: string; onCompleted: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError('');
    const { error: stripeError } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    });
    if (stripeError) {
      setError(stripeError.message || 'Unable to save payment method');
      setSubmitting(false);
      return;
    }
    onCompleted();
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div role="alert" className="text-sm text-red-600">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting || !stripe || !elements}
        className="w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Saving…
          </span>
        ) : (
          'Save payment method'
        )}
      </button>
    </form>
  );
}

/**
 * Add a saved card via Stripe SetupIntent (no charge).
 */
export default function SetupPaymentMethodForm({ onCompleted }: { onCompleted: () => void }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function startSetup() {
    setLoading(true);
    setError('');
    try {
      const res = await api.post(API.customer.membership.paymentMethodsSetupIntent);
      setClientSecret(res.data?.data?.clientSecret || null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to start adding a payment method');
    } finally {
      setLoading(false);
    }
  }

  if (!clientSecret) {
    return (
      <div className="rounded-xl border border-gray-200 p-4" data-testid="setup-pm-idle">
        <p className="text-sm text-gray-600 mb-3">
          Add a card securely with Stripe. This card can be used for future purchases and membership renewals.
        </p>
        {error && (
          <div role="alert" className="mb-3 text-sm text-red-600">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={startSetup}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
        >
          {loading ? 'Preparing…' : 'Add card'}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4" data-testid="setup-pm-form">
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <SetupForm clientSecret={clientSecret} onCompleted={onCompleted} />
      </Elements>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Loader2, Lock, Check } from 'lucide-react';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface StripePaymentFormProps {
  clientSecret: string;
  onPaymentSuccess: (paymentIntentId: string) => void;
  onPaymentError: (error: string) => void;
  disabled?: boolean;
  /** Increment from the parent to force the button back to idle (e.g. server-side confirmation failed). */
  resetKey?: number;
}

/**
 * Detect if this is a fake/demo payment intent.
 * Fake mode: no real Stripe API calls, simulated payment flow.
 */
function isFakeClientSecret(secret: string): boolean {
  return secret.includes('_fake') || secret.includes('demo_');
}

/**
 * Extract payment intent ID from a fake client secret.
 * Format: pi_demo_${timestamp}_secret_${secret}
 */
function extractFakePaymentIntentId(secret: string): string {
  const match = secret.match(/^(pi_[a-z0-9_]+)_secret_/);
  return match ? match[1] : `pi_demo_${Date.now()}_fake`;
}

/**
 * Payment button phases, driven by real events (no fake percentages):
 * idle        → "Pay now"
 * securing    → Stripe confirmPayment in flight ("Securing payment…")
 * confirming  → server-side order creation in flight ("Confirming your order…")
 * done        → "Payment confirmed" (only if still mounted)
 */
type PaymentPhase = 'idle' | 'securing' | 'confirming' | 'done';

function PaymentFormInner({ onPaymentSuccess, onPaymentError, disabled, resetKey = 0 }: Omit<StripePaymentFormProps, 'clientSecret'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [phase, setPhase] = useState<PaymentPhase>('idle');

  // Parent signals a recoverable failure (e.g. order creation failed after payment)
  useEffect(() => {
    if (resetKey > 0) setPhase('idle');
  }, [resetKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || phase !== 'idle' || disabled) return;

    setPhase('securing');

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/checkout',
        },
        redirect: 'if_required',
      });

      if (error) {
        onPaymentError(error.message || 'Payment failed');
        setPhase('idle');
        return;
      }

      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'requires_capture') {
        // Stripe client-side confirmation done; parent now creates the order server-side
        setPhase('confirming');
        onPaymentSuccess(paymentIntent.id);
      } else {
        onPaymentError(`Unexpected payment status: ${paymentIntent?.status}`);
        setPhase('idle');
      }
    } catch (err: any) {
      onPaymentError(err?.message || 'Payment failed');
      setPhase('idle');
    }
  };

  const isBusy = phase === 'securing' || phase === 'confirming';
  const isDone = phase === 'done';
  const isDisabled = !stripe || isBusy || disabled;

  const label =
    phase === 'securing' ? 'Securing payment…'
    : phase === 'confirming' ? 'Confirming your order…'
    : isDone ? 'Payment confirmed'
    : 'Pay now';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
          paymentMethodOrder: ['card', 'apple_pay', 'google_pay', 'klarna', 'afterpay_clearpay'],
        }}
      />

      <button
        type="submit"
        disabled={isDisabled}
        aria-busy={isBusy || undefined}
        className={`relative w-full overflow-hidden py-4 rounded-xl font-semibold text-lg transition-colors duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
          isDone
            ? 'bg-green-600 text-white cursor-default'
            : isBusy
            ? 'bg-primary-700 text-white cursor-wait'
            : 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 disabled:bg-gray-300 disabled:cursor-not-allowed'
        }`}
      >
        {isBusy && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 animate-shimmer motion-reduce:animate-none bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />
        )}
        <span className="relative flex items-center gap-2">
          {isDone ? (
            <Check className="h-5 w-5" />
          ) : isBusy ? (
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
          ) : (
            <Lock className="h-5 w-5" />
          )}
          {label}
        </span>
      </button>
    </form>
  );
}

export default function StripePaymentForm({ clientSecret, onPaymentSuccess, onPaymentError, disabled, resetKey }: StripePaymentFormProps) {
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [fakeProcessing, setFakeProcessing] = useState(false);

  // Fake mode detection
  const isFakeMode = isFakeClientSecret(clientSecret);

  useEffect(() => {
    if (!clientSecret || isFakeMode) return;
    stripePromise.then((stripe) => {
      if (stripe) {
        setStripeLoaded(true);
      } else {
        setStripeError('Payment system failed to load. Please disable any ad blockers and refresh.');
      }
    }).catch(() => {
      setStripeError('Payment system failed to load. Please check your connection and refresh.');
    });
  }, [clientSecret, isFakeMode]);

  // Fake mode handler: simulate payment success
  const handleFakePayment = () => {
    setFakeProcessing(true);
    // Simulate a brief processing delay
    setTimeout(() => {
      const paymentIntentId = extractFakePaymentIntentId(clientSecret);
      onPaymentSuccess(paymentIntentId);
    }, 800);
  };

  if (!clientSecret) return null;

  // Fake mode: show simulated payment button instead of Stripe Elements
  if (isFakeMode) {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
          <p className="text-xs text-amber-700 font-medium">Demo Mode — No real payment will be charged</p>
        </div>
        <button
          onClick={handleFakePayment}
          disabled={disabled || fakeProcessing}
          className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 active:bg-primary-800 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          {fakeProcessing ? (
            <><Loader2 size={16} className="animate-spin" /> Processing payment…</>
          ) : (
            <><Lock size={16} /> Pay now</>
          )}
        </button>
      </div>
    );
  }

  if (stripeError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <p className="text-sm text-red-700 font-medium mb-2">{stripeError}</p>
        <button
          onClick={() => { setStripeError(null); setStripeLoaded(false); window.location.reload(); }}
          className="text-sm text-red-600 underline hover:text-red-800"
        >
          Reload page
        </button>
      </div>
    );
  }

  if (!stripeLoaded) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        <span className="ml-2 text-sm text-gray-500">Loading payment methods...</span>
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#0d9488', // teal-600
        borderRadius: '12px',
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentFormInner onPaymentSuccess={onPaymentSuccess} onPaymentError={onPaymentError} disabled={disabled} resetKey={resetKey} />
    </Elements>
  );
}

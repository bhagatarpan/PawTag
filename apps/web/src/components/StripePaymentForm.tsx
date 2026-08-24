import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Loader2, Lock } from 'lucide-react';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface StripePaymentFormProps {
  clientSecret: string;
  onPaymentSuccess: (paymentIntentId: string) => void;
  onPaymentError: (error: string) => void;
  disabled?: boolean;
}

function PaymentFormInner({ onPaymentSuccess, onPaymentError, disabled }: Omit<StripePaymentFormProps, 'clientSecret'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || processing || disabled) return;

    setProcessing(true);
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
      } else if (paymentIntent?.status === 'succeeded') {
        onPaymentSuccess(paymentIntent.id);
      } else if (paymentIntent?.status === 'requires_capture') {
        // Payment authorized but not captured yet — still success
        onPaymentSuccess(paymentIntent.id);
      } else {
        onPaymentError(`Unexpected payment status: ${paymentIntent?.status}`);
      }
    } catch (err: any) {
      onPaymentError(err?.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

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
        disabled={!stripe || processing || disabled}
        className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold text-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {processing ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> Processing...</>
        ) : (
          <><Lock className="h-5 w-5" /> Pay</>
        )}
      </button>
    </form>
  );
}

export default function StripePaymentForm({ clientSecret, onPaymentSuccess, onPaymentError, disabled }: StripePaymentFormProps) {
  if (!clientSecret) return null;

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
      <PaymentFormInner onPaymentSuccess={onPaymentSuccess} onPaymentError={onPaymentError} disabled={disabled} />
    </Elements>
  );
}

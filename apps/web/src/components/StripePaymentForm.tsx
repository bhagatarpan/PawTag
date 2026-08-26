import { useState, useEffect, useRef } from 'react';
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
}

/**
 * Payment progress states:
 * 0%   = "Pay" (default)
 * 25%  = "Payment Submitted..." (Stripe confirmed client-side)
 * 50%  = "Payment Processing..." (waiting for server confirmation)
 * 75%  = "Payment Confirmed..." (order created, data loaded)
 * 100% = "✓ Payment Confirmed" (green, hold 500ms before redirect)
 */
const PAYMENT_STATES = [
  { progress: 0, text: 'Pay', icon: 'lock' },
  { progress: 25, text: 'Payment Submitted...', icon: 'spinner' },
  { progress: 50, text: 'Payment Processing...', icon: 'spinner' },
  { progress: 75, text: 'Payment Confirmed...', icon: 'spinner' },
  { progress: 100, text: 'Payment Confirmed', icon: 'check' },
] as const;

function PaymentFormInner({ onPaymentSuccess, onPaymentError, disabled }: Omit<StripePaymentFormProps, 'clientSecret'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Pay');
  const [isComplete, setIsComplete] = useState(false);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    };
  }, []);

  const updateProgress = (targetProgress: number, text: string) => {
    setProgress(targetProgress);
    setStatusText(text);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || processing || disabled) return;

    setProcessing(true);
    updateProgress(25, 'Payment Submitted...');

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
        setProcessing(false);
        setProgress(0);
        setStatusText('Pay');
        return;
      }

      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'requires_capture') {
        updateProgress(50, 'Payment Processing...');
        // Notify parent — it will call POST /orders/place and then onPaymentSuccess
        onPaymentSuccess(paymentIntent.id);
      } else {
        onPaymentError(`Unexpected payment status: ${paymentIntent?.status}`);
        setProcessing(false);
        setProgress(0);
        setStatusText('Pay');
      }
    } catch (err: any) {
      onPaymentError(err?.message || 'Payment failed');
      setProcessing(false);
      setProgress(0);
      setStatusText('Pay');
    }
  };

  // Expose progress update methods via callback ref
  // The parent (Checkout.tsx) calls these to drive progress after server-side operations
  useEffect(() => {
    // Attach progress controller to window for parent access
    (window as any).__paymentProgress = {
      setProcessingStage: (stage: 'confirmed' | 'complete') => {
        if (stage === 'confirmed') {
          updateProgress(75, 'Payment Confirmed...');
        } else if (stage === 'complete') {
          updateProgress(100, 'Payment Confirmed');
          setIsComplete(true);
          // Hold green state for 500ms before parent transitions
          progressTimerRef.current = setTimeout(() => {
            // Parent will handle the actual page transition
          }, 500);
        }
      },
    };
    return () => {
      delete (window as any).__paymentProgress;
    };
  }, []);

  const isDisabled = !stripe || processing || disabled;
  const showSpinner = progress > 0 && progress < 100;
  const showCheck = isComplete;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
          paymentMethodOrder: ['card', 'apple_pay', 'google_pay', 'klarna', 'afterpay_clearpay'],
        }}
      />

      {/* Animated Pay Button with Progress Bar */}
      <div className="relative">
        {/* Progress bar background */}
        <div className="absolute inset-0 rounded-xl overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              isComplete ? 'bg-green-500' : 'bg-primary-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Button content */}
        <button
          type="submit"
          disabled={isDisabled && progress === 0}
          className={`relative w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-2 ${
            isComplete
              ? 'bg-green-500 text-white cursor-default'
              : progress > 0
              ? 'bg-transparent text-white cursor-wait'
              : 'bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
          }`}
        >
          {showCheck ? (
            <>
              <Check className="h-5 w-5" />
              {statusText}
            </>
          ) : showSpinner ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {statusText}
            </>
          ) : (
            <>
              <Lock className="h-5 w-5" />
              {statusText}
            </>
          )}
        </button>
      </div>
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

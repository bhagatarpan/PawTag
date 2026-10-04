import { useState } from 'react';
import { CheckCircle2, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { formatCurrency, formatDate } from '@pawtag/shared';
import { API } from '@pawtag/shared/api';
import api from '../../lib/api';
import StripePaymentForm from './StripePaymentForm';

interface KeepMembershipPanelProps {
  tierDisplayName: string;
  benefitsUntil?: string;
  currentPeriodStart?: string;
  chargeAmount?: number;
  currency?: string;
  /** Benefits already ended → paid rejoin copy */
  periodEnded?: boolean;
  onSuccess?: () => void | Promise<void>;
}

/**
 * Calm single-action panel for "Keep my Membership".
 * No multi-step modal — one primary action, optional payment when period ended.
 */
export default function KeepMembershipPanel({
  tierDisplayName,
  benefitsUntil,
  currentPeriodStart,
  chargeAmount,
  currency = 'NZD',
  periodEnded = false,
  onSuccess,
}: KeepMembershipPanelProps) {
  const [phase, setPhase] = useState<'idle' | 'working' | 'payment' | 'done'>('idle');
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [membershipId, setMembershipId] = useState<string | null>(null);
  const [resultInfo, setResultInfo] = useState<{
    benefitsUntil?: string;
    chargeAmount?: number;
    currency?: string;
    tierDisplayName?: string;
  } | null>(null);

  const displayPrice =
    chargeAmount !== undefined && chargeAmount > 0
      ? formatCurrency(chargeAmount, currency)
      : undefined;

  async function handleKeep() {
    setPhase('working');
    setError('');
    try {
      const res = await api.post(API.customer.membership.keep);
      const data = res.data?.data;
      if (data?.outcome === 'payment_required' && data?.clientSecret) {
        setClientSecret(data.clientSecret);
        setMembershipId(data.membershipId || null);
        setResultInfo({
          benefitsUntil: data.benefitsUntil,
          chargeAmount: data.chargeAmount,
          currency: data.currency,
          tierDisplayName: data.tierDisplayName,
        });
        setPhase('payment');
        return;
      }

      setResultInfo({
        benefitsUntil: data?.benefitsUntil,
        tierDisplayName: data?.tierDisplayName || tierDisplayName,
      });
      setPhase('done');
      await onSuccess?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to keep membership. Please try again.');
      setPhase('idle');
    }
  }

  async function handlePaymentSuccess() {
    try {
      if (membershipId) {
        await api.post(API.customer.membership.activate, { membershipId });
      }
      setPhase('done');
      await onSuccess?.();
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          'Payment succeeded but activation failed. Please refresh or contact support.',
      );
    }
  }

  if (phase === 'done') {
    return (
      <div
        className="rounded-2xl border border-green-200 bg-green-50 p-5"
        data-testid="keep-membership-success"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 size={22} className="text-green-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-green-900">
              {tierDisplayName} membership kept
            </h3>
            <p className="text-sm text-green-800 mt-1">
              {resultInfo?.benefitsUntil
                ? `You're active again. Benefits continue until ${formatDate(resultInfo.benefitsUntil, 'long')}.`
                : 'Your membership is active again with auto-renew on.'}
            </p>
            <p className="text-xs text-green-700 mt-2">
              A confirmation email is on its way. You can view invoices anytime from your account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'payment' && clientSecret) {
    return (
      <div className="rounded-2xl border border-primary-200 bg-white p-5" data-testid="keep-membership-payment">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard size={20} className="text-primary-600" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Complete payment to keep {resultInfo?.tierDisplayName || tierDisplayName}
            </h3>
            <p className="text-sm text-gray-500">
              {resultInfo?.chargeAmount !== undefined
                ? `${formatCurrency(resultInfo.chargeAmount, resultInfo.currency || currency)} — one-time rejoin for a new membership period.`
                : 'One-time payment for a new membership period.'}
            </p>
          </div>
        </div>
        <StripePaymentForm
          clientSecret={clientSecret}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentError={(msg) => setError(msg)}
          disabled={phase === 'working'}
        />
        {error && (
          <div role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5" data-testid="keep-membership-panel">
      <div className="flex items-start gap-3">
        <ShieldCheck size={22} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-amber-900">Keep your {tierDisplayName} membership</h3>
          {periodEnded ? (
            <p className="text-sm text-amber-800 mt-1">
              Your benefits period has ended. We'll start a new {tierDisplayName} membership
              {displayPrice ? (
                <>
                  {' '}
                  for <span className="font-semibold">{displayPrice}</span>
                </>
              ) : null}{' '}
              using your saved payment method.
              {currentPeriodStart ? (
                <> New membership starts today (was active since {formatDate(currentPeriodStart, 'long')}).</>
              ) : null}
            </p>
          ) : (
            <p className="text-sm text-amber-800 mt-1">
              Benefits stay active until{' '}
              <span className="font-semibold">
                {benefitsUntil ? formatDate(benefitsUntil, 'long') : 'your renewal date'}
              </span>
              . Auto-renew turns back on at the same annual price.
              <span className="font-semibold"> No charge today.</span>
            </p>
          )}

          <button
            type="button"
            onClick={handleKeep}
            disabled={phase === 'working'}
            className="mt-4 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-60 transition-colors"
          >
            {phase === 'working' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {periodEnded ? 'Preparing payment…' : 'Keeping your membership…'}
              </>
            ) : periodEnded ? (
              <>Keep membership — {displayPrice || 'pay now'}</>
            ) : (
              <>Yes, keep my membership</>
            )}
          </button>

          {error && (
            <div role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

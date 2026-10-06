import { useState } from 'react';
import { CheckCircle2, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { formatCurrency, formatDate } from '@pawtag/shared';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';
import StripePaymentForm from './StripePaymentForm';

interface KeepMembershipPanelProps {
  tierDisplayName?: string;
  benefitsUntil?: string;
  currentPeriodStart?: string;
  /**
   * When true, benefits period is over → paid rejoin copy.
   * When false/undefined, free restore copy (no charge).
   * Do not infer paid from chargeAmount alone — server decides after keep.
   */
  periodEnded?: boolean;
  /** Full tier price for paid path display only (Path B). */
  chargeAmount?: number;
  currency?: string;
  onSuccess?: () => void | Promise<void>;
}

/**
 * Calm single-action panel for Keep My Membership.
 * Idle paid vs free uses `periodEnded` (from membership dates).
 * After keep, payment/outcome comes from the backend response.
 */
export default function KeepMembershipPanel({
  tierDisplayName,
  benefitsUntil,
  currentPeriodStart,
  periodEnded = false,
  chargeAmount,
  currency = 'NZD',
  onSuccess,
}: KeepMembershipPanelProps) {
  const [phase, setPhase] = useState<'idle' | 'working' | 'payment' | 'done'>('idle');
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [membershipId, setMembershipId] = useState<string | null>(null);
  const [resultInfo, setResultInfo] = useState<{
    benefitsUntil?: string;
    startDate?: string;
    endDate?: string;
    chargeAmount?: number;
    currency?: string;
    tierDisplayName?: string;
    outcome?: string;
  } | null>(null);

  const serverPaid = resultInfo?.outcome === 'payment_required';
  const displayPrice =
    (serverPaid ? resultInfo?.chargeAmount : chargeAmount) !== undefined &&
    (serverPaid ? resultInfo?.chargeAmount : chargeAmount)! > 0
      ? formatCurrency(
          (serverPaid ? resultInfo?.chargeAmount : chargeAmount)!,
          (serverPaid ? resultInfo?.currency : currency) || currency,
        )
      : undefined;

  // Idle: free unless benefits period already ended (never trust price alone)
  const showPaidIdle = phase === 'idle' && periodEnded && !serverPaid;

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
          tierDisplayName: data.tierDisplayName || tierDisplayName,
          outcome: data.outcome,
        });
        setPhase('payment');
        return;
      }

      setResultInfo({
        benefitsUntil: data?.benefitsUntil || data?.endDate,
        startDate: data?.startDate,
        endDate: data?.endDate || data?.benefitsUntil,
        tierDisplayName: data?.tierDisplayName || tierDisplayName,
        outcome: data?.outcome,
      });
      setPhase('done');
      await onSuccess?.();
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "We couldn't keep your membership. Your membership has not been changed. Please try again or contact support.",
      );
      setPhase('idle');
    }
  }

  async function handlePaymentSuccess() {
    try {
      if (membershipId) {
        await api.post(API.customer.membership.activate, { membershipId });
      }
      setResultInfo((prev) => ({
        ...prev,
        outcome: 'payment_required',
      }));
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
    const paid = resultInfo?.outcome === 'payment_required' && (resultInfo?.chargeAmount || 0) > 0;
    return (
      <div
        className="rounded-2xl border border-green-200 bg-green-50 p-5"
        data-testid="keep-membership-success"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 size={22} className="text-green-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-green-900">
              Your membership is active again
            </h3>
            <p className="text-sm text-green-800 mt-1">
              {paid && resultInfo?.chargeAmount
                ? `Payment of ${formatCurrency(resultInfo.chargeAmount, resultInfo.currency || currency)} was successful. `
                : ''}
              <span className="font-semibold">{resultInfo?.tierDisplayName || tierDisplayName}</span>
              {' — '}
              {resultInfo?.endDate
                ? `active until ${formatDate(resultInfo.endDate, 'long')}.`
                : 'your membership is active.'}
            </p>
            <p className="text-xs text-green-700 mt-2">
              {paid
                ? 'Your invoice has been emailed to you.'
                : 'No payment was required. Original membership dates were preserved.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'payment' && clientSecret) {
    const amount = resultInfo?.chargeAmount ?? chargeAmount;
    return (
      <div className="rounded-2xl border border-primary-200 bg-white p-5" data-testid="keep-membership-payment">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard size={20} className="text-primary-600" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Keep your {resultInfo?.tierDisplayName || tierDisplayName} membership
            </h3>
            <p className="text-sm text-gray-500">
              Your benefits period has ended. Complete payment of{' '}
              <span className="font-semibold">
                {amount !== undefined
                  ? formatCurrency(amount, resultInfo?.currency || currency)
                  : 'the membership price'}
              </span>{' '}
              using your saved payment method to start a new membership period.
            </p>
          </div>
        </div>
        <StripePaymentForm
          clientSecret={clientSecret}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentError={(msg) => setError(msg)}
        />
        {error && (
          <div role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Idle paid vs free uses periodEnded only (not chargeAmount prop)
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5" data-testid="keep-membership-panel">
      <div className="flex items-start gap-3">
        <ShieldCheck size={22} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-amber-900">
            Keep your {tierDisplayName || 'membership'}?
          </h3>
          {showPaidIdle ? (
            <p className="text-sm text-amber-800 mt-1">
              Your membership benefits have already been used. Keeping your membership will renew
              it for{' '}
              <span className="font-semibold">
                {displayPrice || 'the latest membership price'}
              </span>{' '}
              using your saved payment method.
              {currentPeriodStart ? (
                <> Your previous membership started {formatDate(currentPeriodStart, 'long')}.</>
              ) : null}
            </p>
          ) : (
            <p className="text-sm text-amber-800 mt-1">
              Your membership will remain active until{' '}
              <span className="font-semibold">
                {benefitsUntil ? formatDate(benefitsUntil, 'long') : 'your original end date'}
              </span>
              .
              <span className="font-semibold"> No additional payment is required.</span>
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleKeep}
              disabled={phase === 'working'}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-60 transition-colors"
            >
              {phase === 'working' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Keeping your membership...
                </>
              ) : showPaidIdle ? (
                <>Keep My Membership — {displayPrice || 'pay now'}</>
              ) : (
                <>Keep My Membership</>
              )}
            </button>
          </div>

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

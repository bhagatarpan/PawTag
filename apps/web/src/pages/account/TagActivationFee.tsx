import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Receipt, Lock, CheckCircle } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import { formatSavedPaymentMethodLabel, type SavedPaymentMethod } from '@pawtag/shared';
import api from '../../lib/api';
import StripePaymentForm from '../../components/StripePaymentForm';
import SavedPaymentMethodPicker from '../../components/SavedPaymentMethodPicker';

/**
 * One-time Tag Activation fee checkout (docs/TAG-ACTIVATION-LIMIT.md).
 *
 * Reached from the Activate Tag screen when the customer is at their
 * activation limit: pays the configured one-time fee (+ GST + CPF per
 * config) for THIS tag's single over-limit activation, then returns to
 * activation. All money math is server-side — this page only presents the
 * summary and the standard secure card form (saved default card + chooser).
 */

interface ActivationSummary {
  pendingOrderId: string;
  paymentIntentId: string;
  clientSecret?: string;
  amount: number;
  currency: string;
  feeAmount?: number;
  gst?: number;
  cpf?: { amount: number; gst: number } | null;
  productName?: string;
  tagId?: string;
  isZeroTotal?: boolean;
}

export default function TagActivationFee() {
  const [searchParams] = useSearchParams();
  const tagId = (searchParams.get('tagId') || '').toUpperCase();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<ActivationSummary | null>(null);
  const [confirmingZero, setConfirmingZero] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [paymentResetKey, setPaymentResetKey] = useState(0);
  const [savedCards, setSavedCards] = useState<SavedPaymentMethod[]>([]);
  const [selectedSavedPmId, setSelectedSavedPmId] = useState<string | null>(null);
  const startedRef = useRef(false);

  const goToActivation = (targetTagId: string) =>
    navigate(`/account/redeem-tag?tagId=${encodeURIComponent(targetTagId)}&paid=1`, { replace: true });

  useEffect(() => {
    if (!tagId) {
      setError('Missing tag ID — open Activate Tag and try again.');
      setLoading(false);
      return;
    }
    if (startedRef.current) return; // StrictMode-safe: one checkout per mount
    startedRef.current = true;

    api
      .post(API.customer.tags.activationCheckout(tagId))
      .then((res) => {
        const d = res.data?.data || {};
        // Limit moved (membership purchased) or a paid fee waits on another tag
        if (d.redirectToRedeem) return goToActivation(tagId);
        if (d.existingPaidTagId) return goToActivation(d.existingPaidTagId);
        setSummary(d);
      })
      .catch((err) => {
        const data = err.response?.data;
        if (data?.code === 'tag_limit_reached') {
          setBlocked(true);
          setError(data.error || 'You have reached your tag activation limit.');
        } else {
          setError(data?.error || 'Failed to start activation checkout');
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagId]);

  const confirmOrder = async (paymentIntentId: string) => {
    setConfirmError('');
    try {
      await api.post(API.checkout.confirm, { paymentIntentId, portal: 'customer-web' });
      goToActivation(tagId);
    } catch (err: any) {
      setConfirmError(err.response?.data?.error || 'Payment received but confirmation failed — retry from Activate Tag');
    }
  };

  const handlePaymentSuccess = (paymentIntentId: string) => confirmOrder(paymentIntentId);

  const handleZeroTotalConfirm = async () => {
    if (!summary) return;
    setConfirmingZero(true);
    setConfirmError('');
    try {
      await confirmOrder(summary.paymentIntentId);
    } finally {
      setConfirmingZero(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto mt-10 p-8 bg-white rounded-2xl shadow-sm border border-gray-100 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600 mx-auto" />
        <p className="text-sm text-gray-500 mt-3">Preparing your activation payment…</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-1">
        <Receipt size={24} className="text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900">Complete Activation</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        You've reached your tag activation limit. Pay the one-time fee below to activate tag{' '}
        <span className="font-mono font-semibold text-gray-700">{tagId}</span> — then attach it to your pet.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <p>{error}</p>
          {blocked && (
            <Link
              to="/membership"
              className="mt-2 inline-block font-semibold text-red-800 underline underline-offset-2"
            >
              View membership plans
            </Link>
          )}
        </div>
      )}

      {confirmError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{confirmError}</div>
      )}

      {summary && (
        <>
          {/* Order summary — values are server-computed (fee + GST + CPF) */}
          <div className="rounded-xl border border-gray-200 overflow-hidden mb-5">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Order summary</span>
              <span className="text-[11px] text-gray-400">Tag {summary.tagId}</span>
            </div>
            <div className="px-4 py-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-gray-600">{summary.productName || 'Tag Activation'}</span>
                <span className="font-medium text-gray-900">
                  {summary.currency === 'NZD' ? 'NZ$' : ''}
                  {(summary.feeAmount ?? 0).toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 -mt-1">
                One-time, GST-inclusive. This activates this tag only.
              </p>
              {summary.gst != null && summary.gst > 0 && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Includes GST</span>
                  <span>
                    {summary.currency === 'NZD' ? 'NZ$' : ''}
                    {summary.gst.toFixed(2)}
                  </span>
                </div>
              )}
              {summary.cpf && summary.cpf.amount > 0 && (
                <div className="flex justify-between text-xs text-gray-600 border-t border-gray-100 pt-2">
                  <span>
                    Card payment fee{' '}
                    <span className="text-gray-400">(incl. GST ${(summary.cpf.gst || 0).toFixed(2)})</span>
                  </span>
                  <span>${summary.cpf.amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-100 pt-2">
                <span>Total</span>
                <span>
                  {summary.currency === 'NZD' ? 'NZ$' : ''}
                  {summary.amount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {summary.isZeroTotal ? (
            <button
              onClick={handleZeroTotalConfirm}
              disabled={confirmingZero}
              className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {confirmingZero ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {confirmingZero ? 'Confirming…' : 'Confirm & Activate'}
            </button>
          ) : summary.clientSecret ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Payment method</span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Lock size={11} /> Secure · powered by Stripe
                </span>
              </div>
              <SavedPaymentMethodPicker
                selectedPaymentMethodId={selectedSavedPmId}
                onSelect={setSelectedSavedPmId}
                onCardsLoaded={(list) => {
                  setSavedCards(list);
                  if (list.length > 0) {
                    setSelectedSavedPmId((prev) => prev ?? (list.find((c) => c.isDefault)?.id || list[0]?.id || null));
                  }
                }}
              />
              <StripePaymentForm
                clientSecret={summary.clientSecret}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={(msg) => {
                  setConfirmError(msg);
                  setPaymentResetKey((k) => k + 1);
                }}
                resetKey={paymentResetKey}
                savedPaymentMethodId={selectedSavedPmId}
                savedCardLabel={
                  selectedSavedPmId
                    ? formatSavedPaymentMethodLabel(savedCards.find((c) => c.id === selectedSavedPmId) || {})
                    : null
                }
              />
            </div>
          ) : null}
        </>
      )}

      <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
        <button
          onClick={() => navigate(`/account/redeem-tag?tagId=${encodeURIComponent(tagId)}`)}
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Back to activation
        </button>
        <Link to="/membership" className="text-primary-600 font-medium hover:text-primary-700">
          Membership plans
        </Link>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Loader2, ArrowLeft, CreditCard, Info, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import { formatCurrency, formatDate } from '@pawtag/shared';
import { resolveTierIcon, resolveTierGradient, getTierMarketingFlags, EntitlementList } from '@pawtag/ui';
import api from '../../lib/api';
import StripePaymentForm from '../../components/StripePaymentForm';

interface MembershipTier {
  _id: string;
  tier: 'gold' | 'platinum' | 'black';
  name: string;
  displayName: string;
  description: string;
  price: number;
  currency: string;
  displayOrder: number;
  entitlements: Record<string, { enabled: boolean; value: any; name?: string; description?: string }>;
  comingSoon: boolean;
  tagLimit: number;
  icon: string;
  color: string;
  gradient: string;
}

interface CurrentMembership {
  hasMembership: boolean;
  membership: {
    _id: string;
    tierId: { _id: string; tier: string; displayName: string; price: number; displayOrder?: number; currency?: string };
    status: string;
    currentPeriodEnd: string;
    cancelledAt?: string | null;
    autoRenew?: boolean;
  } | null;
  tier: { _id: string; tier: string; displayName: string; price: number; displayOrder?: number; currency?: string } | null;
}

interface TierChangeEstimate {
  currentTier: { tier: string; displayName: string; price: number };
  newTier: { tier: string; displayName: string; price: number };
  remainingDays: number;
  totalDays: number;
  proratedAmount: number;
  currency: string;
  isUpgrade: boolean;
  renewalDate: string;
  pointsAtRisk: number;
  currentPointsBalance: number;
  entitlementsLost: Array<{ key: string; name: string; currentValue: any; newValue: any }>;
  downgradeEffectiveDate: string;
  isCancelling?: boolean;
  willResumeOnUpgrade?: boolean;
}

interface MembershipChangeErrorBody {
  error?: string;
  code?: string;
}

export default function MembershipSubscribe() {
  const navigate = useNavigate();
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<MembershipTier | null>(null);
  const [processing, setProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [membershipId, setMembershipId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState(false);

  // Upgrade flow state
  const [currentMembership, setCurrentMembership] = useState<CurrentMembership | null>(null);
  const [estimate, setEstimate] = useState<TierChangeEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [confirmingUpgrade, setConfirmingUpgrade] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<{ invoiceNumber?: string; prorationAmount?: number; currency?: string; isDowngrade?: boolean; effectiveDate?: string; resumedOnUpgrade?: boolean } | null>(null);

  // Downgrade consent state
  const [downgradeTermsAccepted, setDowngradeTermsAccepted] = useState(false);
  const [downgradeReason, setDowngradeReason] = useState('');

  const hasActiveMembership = currentMembership?.hasMembership && currentMembership.membership?.status === 'active';
  const currentTier = currentMembership?.tier || currentMembership?.membership?.tierId || null;
  const isCancelling = Boolean(currentMembership?.membership?.cancelledAt);

  function extractErrorPayload(err: any): MembershipChangeErrorBody {
    const data = err?.response?.data;
    return {
      error: data?.error || err?.message,
      code: data?.code,
    };
  }

  function applyError(err: any, fallback: string) {
    const payload = extractErrorPayload(err);
    setError(payload.error || fallback);
    setErrorCode(payload.code);
  }

  async function handleOpenBillingPortal() {
    try {
      const res = await api.post(API.customer.membership.paymentMethodsPortal);
      const { url } = res.data.data || {};
      if (url) {
        window.open(url, '_blank');
        setError('Update your payment method in the secure portal, then confirm the upgrade again.');
      } else {
        setError('Payment settings are not available in demo mode.');
      }
    } catch (err: any) {
      applyError(err, 'Failed to open payment settings');
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [tiersRes, statusRes] = await Promise.all([
        api.get(API.customer.membership.tiers),
        api.get(API.customer.membership.status).catch(() => ({ data: { data: { hasMembership: false, membership: null, tier: null } } })),
      ]);
      setTiers(tiersRes.data.data || []);
      setCurrentMembership(statusRes.data.data || null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load membership tiers');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Fetch proration estimate when an existing member selects a different tier.
   * Uses the shared estimate endpoint; response is raw data (no pre-formatted strings).
   */
  async function fetchEstimate(tier: MembershipTier) {
    if (!hasActiveMembership || !currentTier) {
      setEstimate(null);
      return;
    }
    if (tier._id === currentTier._id || tier.comingSoon) {
      setEstimate(null);
      return;
    }

    setEstimateLoading(true);
    setEstimate(null);
    setSelectedTier(tier);
    try {
      const res = await api.get(API.customer.membership.changeTierEstimate(tier._id));
      setEstimate(res.data.data);
    } catch {
      setEstimate(null);
      setSelectedTier(null);
    } finally {
      setEstimateLoading(false);
    }
  }

  /**
   * Determine the button label and variant for a tier card.
   * Uses displayOrder from the API (admin-editable) — not a hardcoded rank map.
   */
  function getButtonLabel(tier: MembershipTier): { label: string; disabled: boolean; variant: 'upgrade' | 'downgrade' | 'current' | 'join' } {
    if (tier.comingSoon) return { label: 'Coming Soon', disabled: true, variant: 'join' };
    if (!hasActiveMembership || !currentTier) return { label: `Join ${tier.displayName}`, disabled: false, variant: 'join' };

    const currentOrder = currentTier.displayOrder ?? 0;
    const targetOrder = tier.displayOrder ?? 0;

    if (targetOrder === currentOrder) return { label: 'Current Plan', disabled: true, variant: 'current' };
    if (targetOrder > currentOrder) return { label: `Upgrade to ${tier.displayName}`, disabled: false, variant: 'upgrade' };
    return { label: `Downgrade to ${tier.displayName}`, disabled: false, variant: 'downgrade' };
  }

  /**
   * Construct the proration estimate message in the frontend.
   * The API returns raw data; display formatting lives here.
   */
  function buildEstimateMessage(est: TierChangeEstimate): string {
    const amount = formatCurrency(est.proratedAmount, est.currency);
    const newPrice = formatCurrency(est.newTier.price, est.currency);
    const renewal = formatDate(est.renewalDate, 'medium');

    if (est.isUpgrade) {
      const resumeNote = est.willResumeOnUpgrade
        ? ' This upgrade also resumes your membership (auto-renew will be turned back on).'
        : '';
      return `You'll be charged ${amount} today for the remaining ${est.remainingDays} days of your current period. Your ${est.newTier.displayName} benefits start immediately, and your next full renewal of ${newPrice}/year will be on ${renewal}.${resumeNote}`;
    }
    return `Your ${est.newTier.displayName} benefits start immediately. You won't be charged the new rate until your renewal on ${renewal}.`;
  }

  async function handleSubscribe(tier: MembershipTier) {
    if (tier.comingSoon) return;

    setSelectedTier(tier);
    setProcessing(true);
    setError('');
    setErrorCode(undefined);

    // Existing member — route to change-tier instead of subscribe
    if (hasActiveMembership) {
      await handleChangeTier(tier);
      return;
    }

    // New subscriber — existing subscribe flow
    try {
      const res = await api.post(API.customer.membership.subscribe, {
        tierId: tier._id,
      });

      const { clientSecret: secret, membership, isDemoMode } = res.data.data;

      setMembershipId(membership._id);

      if (secret) {
        setClientSecret(secret);
        setProcessing(false);
      } else if (isDemoMode) {
        setSuccess(true);
        setTimeout(() => navigate('/account/membership'), 2000);
      } else {
        const serverMessage = res.data.data?.message;
        setError(serverMessage || 'Unable to start payment. Please try again or contact support.');
        setProcessing(false);
      }
    } catch (err: any) {
      applyError(err, 'Failed to start subscription');
      setProcessing(false);
    }
  }

  async function handleChangeTier(tier: MembershipTier) {
    try {
      const res = await api.post(API.customer.membership.changeTier, {
        tierId: tier._id,
        prorationBehavior: 'now',
      });

      // changeTier returns { membership, invoice, invoiceUrl, resumedOnUpgrade }
      const { invoice, resumedOnUpgrade } = res.data.data || {};
      if (invoice) {
        setUpgradeResult({
          invoiceNumber: invoice.invoiceNumber,
          prorationAmount: invoice.amount,
          currency: invoice.currency,
          resumedOnUpgrade: Boolean(resumedOnUpgrade),
        });
      } else {
        setUpgradeResult({ resumedOnUpgrade: Boolean(resumedOnUpgrade) });
      }

      setSuccess(true);
      setTimeout(() => navigate('/account/membership'), 4000);
    } catch (err: any) {
      applyError(err, 'Failed to change membership tier');
      setProcessing(false);
      setConfirmingUpgrade(false);
    }
  }

  /**
   * Second confirmation step: user has seen the proration estimate and clicks confirm.
   * For upgrades: calls changeTier endpoint (immediate).
   * For downgrades: calls downgrade endpoint (deferred) — requires terms acceptance.
   * Cancelling members: upgrade also resumes membership (Option A).
   */
  async function handleConfirmUpgrade(tier: MembershipTier) {
    // For downgrades, require terms acceptance
    if (estimate && !estimate.isUpgrade && !downgradeTermsAccepted) {
      setError('You must accept the downgrade terms to proceed');
      setErrorCode(undefined);
      return;
    }

    setConfirmingUpgrade(true);
    setError('');
    setErrorCode(undefined);

    if (estimate && !estimate.isUpgrade) {
      // Downgrade flow — deferred to renewal
      await handleDowngrade(tier);
    } else {
      // Upgrade flow — immediate (resume+upgrade when cancelling)
      await handleChangeTier(tier);
    }
  }

  async function handleDowngrade(tier: MembershipTier) {
    try {
      await api.post(API.customer.membership.downgrade, {
        tierId: tier._id,
        reason: downgradeReason || undefined,
        termsAccepted: true,
        termsVersion: 'v1',
      });

      setUpgradeResult({
        isDowngrade: true,
        effectiveDate: estimate?.downgradeEffectiveDate,
      });

      setSuccess(true);
      setTimeout(() => navigate('/account/membership'), 5000);
    } catch (err: any) {
      applyError(err, 'Failed to schedule downgrade');
      setProcessing(false);
      setConfirmingUpgrade(false);
    }
  }

  async function handlePaymentSuccess(paymentIntentId: string) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (membershipId) {
          await api.post(API.customer.membership.activate, { membershipId });
        }
        setSuccess(true);
        setProcessing(false);
        setTimeout(() => navigate('/account/membership'), 2000);
        return;
      } catch (err: any) {
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        } else {
          console.error('Membership activation failed after 3 attempts:', err);
          setError('Payment succeeded but activation failed. Please contact support or try refreshing the page.');
          setProcessing(false);
        }
      }
    }
  }

  function handlePaymentError(error: string) {
    setError(error);
    setErrorCode(undefined);
    setProcessing(false);
    setClientSecret(null);
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check size={32} className="text-green-600" />
        </div>
        {upgradeResult?.isDowngrade ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Downgrade Scheduled</h1>
            <p className="text-gray-500">
              Your downgrade to {selectedTier?.displayName} has been scheduled for{' '}
              {upgradeResult.effectiveDate ? formatDate(upgradeResult.effectiveDate, 'medium') : 'renewal'}.
            </p>
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
              <p className="text-sm font-semibold text-amber-900 mb-2">What happens next:</p>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>✓ Your {currentTier?.displayName || 'current'} benefits remain active until renewal</li>
                <li>✓ At renewal, your membership switches to {selectedTier?.displayName}</li>
                {estimate && estimate.pointsAtRisk > 0 && (
                  <li>⚠ You will lose {estimate.pointsAtRisk} Guardian points</li>
                )}
              </ul>
            </div>
            <p className="text-sm text-gray-400 mt-4">A confirmation email has been sent.</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to {selectedTier?.displayName}!</h1>
            <p className="text-gray-500">
              {upgradeResult?.resumedOnUpgrade
                ? 'Your membership has been upgraded and resumed.'
                : hasActiveMembership
                  ? 'Your membership has been updated.'
                  : 'Your membership is being activated.'}
            </p>
            {upgradeResult?.resumedOnUpgrade && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
                <p className="text-sm font-semibold text-amber-900 mb-1">Membership resumed</p>
                <p className="text-sm text-amber-700">
                  Auto-renew is back on. You'll keep {selectedTier?.displayName} benefits through your current period and beyond.
                </p>
              </div>
            )}
            {upgradeResult?.invoiceNumber && (
              <div className="mt-6 p-4 bg-primary-50 border border-primary-200 rounded-xl text-left">
                <p className="text-sm font-semibold text-primary-900 mb-1">Upgrade invoice</p>
                <p className="text-sm text-primary-700">
                  {upgradeResult.invoiceNumber}
                  {upgradeResult.prorationAmount !== undefined && upgradeResult.prorationAmount > 0 && (
                    <> — {formatCurrency(upgradeResult.prorationAmount, upgradeResult.currency || 'NZD')} prorated charge</>
                  )}
                </p>
                <p className="text-xs text-primary-600 mt-2">
                  A copy has been emailed to you. You can also view it in Billing History.
                </p>
              </div>
            )}
          </>
        )}
        <p className="text-sm text-gray-400 mt-4">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/account/membership" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={16} /> Back to Membership
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {hasActiveMembership ? 'Change Your Membership' : 'Choose Your Membership'}
        </h1>
        <p className="text-gray-500 mt-1">
          {hasActiveMembership
            ? `You're currently on ${currentTier?.displayName}. Select a new tier to upgrade or change your plan.`
            : 'Select a tier to protect your pet with PawTag membership benefits.'}
        </p>
      </div>

      {/* Current membership banner */}
      {hasActiveMembership && currentTier && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-primary-50 border border-primary-200 rounded-xl">
          <Info size={18} className="text-primary-600 shrink-0" />
          <p className="text-sm text-primary-800">
            You're currently on <span className="font-semibold">{currentTier.displayName}</span> ({formatCurrency(currentTier.price, currentTier.currency || 'NZD', { decimals: false })}/year).
            Upgrades take effect immediately with a prorated charge.
          </p>
        </div>
      )}

      {/* Cancelling membership — Option A: upgrade also resumes */}
      {hasActiveMembership && isCancelling && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Your membership is scheduled to cancel</p>
              <p className="text-sm text-amber-700 mt-1">
                Benefits stay active until {currentMembership?.membership?.currentPeriodEnd ? formatDate(currentMembership.membership.currentPeriodEnd, 'long') : 'your renewal date'}.
                If you upgrade now, your membership will also be <span className="font-semibold">resumed</span> (auto-renew turned back on).
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <div role="alert">{error}</div>
          {errorCode === 'membership.payment_method_required' && (
            <button
              type="button"
              onClick={handleOpenBillingPortal}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              Update payment method
            </button>
          )}
        </div>
      )}

      {/* Payment Form (new subscriptions only) */}
      {clientSecret && selectedTier && (
        <div className="mb-8 bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard size={20} className="text-gray-400" />
            <div>
              <h3 className="font-semibold text-gray-900">Complete Payment</h3>
              <p className="text-sm text-gray-500">
                {selectedTier.displayName} — {formatCurrency(selectedTier.price, selectedTier.currency || 'NZD', { decimals: false })}/year
              </p>
            </div>
          </div>
          <StripePaymentForm
            clientSecret={clientSecret}
            onPaymentSuccess={handlePaymentSuccess}
            onPaymentError={handlePaymentError}
            disabled={processing}
          />
        </div>
      )}

      {/* Proration estimate confirmation (existing members upgrading/downgrading) */}
      {estimate && selectedTier && !clientSecret && hasActiveMembership && (
        <div className={`mb-6 rounded-2xl border-2 p-6 ${
          estimate.isUpgrade
            ? 'bg-primary-50 border-primary-300'
            : 'bg-amber-50 border-amber-300'
        }`}>
          <div className="flex items-start gap-3 mb-4">
            {estimate.isUpgrade ? (
              <TrendingUp size={20} className="text-primary-600 shrink-0 mt-0.5" />
            ) : (
              <Info size={20} className="text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">
                {estimate.isUpgrade ? 'Upgrade' : 'Downgrade'} to {estimate.newTier.displayName}
              </h3>
              <p className="text-sm text-gray-600">{buildEstimateMessage(estimate)}</p>
              {estimate.willResumeOnUpgrade && (
                <p className="text-xs text-amber-700 mt-2 font-medium">
                  Confirming this upgrade will also resume your scheduled cancellation.
                </p>
              )}
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Current plan</span>
              <span className="text-gray-900 font-medium">
                {estimate.currentTier.displayName} — {formatCurrency(estimate.currentTier.price, estimate.currency, { decimals: false })}/year
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">New plan</span>
              <span className="text-gray-900 font-medium">
                {estimate.newTier.displayName} — {formatCurrency(estimate.newTier.price, estimate.currency, { decimals: false })}/year
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Billing period remaining</span>
              <span className="text-gray-900">{estimate.remainingDays} of {estimate.totalDays} days</span>
            </div>
            <div className="pt-2 border-t border-gray-100 flex justify-between">
              <span className="text-sm font-semibold text-gray-900">
                {estimate.isUpgrade ? 'Charged today' : 'Credit applied'}
              </span>
              <span className={`text-lg font-bold ${estimate.isUpgrade ? 'text-primary-600' : 'text-amber-600'}`}>
                {formatCurrency(estimate.proratedAmount, estimate.currency)}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Next full renewal: {formatCurrency(estimate.newTier.price, estimate.currency, { decimals: false })}/year on {formatDate(estimate.renewalDate, 'medium')}
            </p>
          </div>

          {/* Downgrade consequences — shown only for downgrades */}
          {!estimate.isUpgrade && (
            <div className="mb-4 space-y-3">
              {/* Points at risk */}
              {estimate.pointsAtRisk > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={16} className="text-red-600" />
                    <span className="text-sm font-semibold text-red-800">Points at Risk</span>
                  </div>
                  <p className="text-sm text-red-700">
                    You will lose <strong>{estimate.pointsAtRisk} Guardian points</strong> when this downgrade takes effect.
                    Your balance will change from {estimate.currentPointsBalance} to {estimate.currentPointsBalance - estimate.pointsAtRisk} points.
                  </p>
                </div>
              )}

              {/* Entitlements lost */}
              {estimate.entitlementsLost.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Info size={16} className="text-amber-600" />
                    <span className="text-sm font-semibold text-gray-800">Benefits That Will Change</span>
                  </div>
                  <ul className="space-y-1.5">
                    {estimate.entitlementsLost.map((item) => (
                      <li key={item.key} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{item.name}</span>
                        <span className="text-red-600 font-medium">
                          {String(item.currentValue)} → {String(item.newValue)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Effective date */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={16} className="text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">Effective Date</span>
                </div>
                <p className="text-sm text-amber-700">
                  {estimate.newTier.displayName} benefits will be active from {formatDate(estimate.downgradeEffectiveDate, 'medium')}.
                  Your current {estimate.currentTier.displayName} benefits remain until then.
                </p>
              </div>

              {/* Terms acceptance checkbox */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={downgradeTermsAccepted}
                    onChange={(e) => setDowngradeTermsAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">
                    I understand that my {estimate.currentTier.displayName} benefits will change to {estimate.newTier.displayName} benefits at renewal, and I will lose {estimate.pointsAtRisk > 0 ? `${estimate.pointsAtRisk} Guardian points` : 'any accumulated points bonus'}.
                  </span>
                </label>
              </div>

              {/* Optional reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <select
                  value={downgradeReason}
                  onChange={(e) => setDowngradeReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                >
                  <option value="">Select a reason</option>
                  <option value="too_expensive">Too expensive</option>
                  <option value="not_using">Not using the benefits</option>
                  <option value="found_alternative">Found an alternative</option>
                  <option value="poor_experience">Poor experience</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          )}

          {/* Confirm / Cancel */}
          <div className="flex gap-3">
            <button
              onClick={() => handleConfirmUpgrade(selectedTier)}
              disabled={confirmingUpgrade || estimateLoading || (!estimate.isUpgrade && !downgradeTermsAccepted)}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-colors ${
                confirmingUpgrade
                  ? 'bg-primary-400 text-white cursor-wait'
                  : (!estimate.isUpgrade && !downgradeTermsAccepted)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : estimate.isUpgrade
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              {confirmingUpgrade ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Processing...
                </span>
              ) : (
                estimate.isUpgrade
                  ? `Confirm Upgrade — ${formatCurrency(estimate.proratedAmount, estimate.currency)}`
                  : 'Schedule Downgrade'
              )}
            </button>
            <button
              onClick={() => { setEstimate(null); setSelectedTier(null); setConfirmingUpgrade(false); setDowngradeTermsAccepted(false); setDowngradeReason(''); }}
              disabled={confirmingUpgrade}
              className="py-3 px-6 rounded-xl font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tier Selection */}
      {!clientSecret && !estimate && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier) => {
            const TierIcon = resolveTierIcon(tier.icon, tier.tier);
            const gradient = resolveTierGradient(tier.tier, tier.gradient);
            const marketing = getTierMarketingFlags(tier.tier);
            const isSelected = selectedTier?._id === tier._id;
            const button = getButtonLabel(tier);
            const isCurrent = hasActiveMembership && currentTier && tier._id === currentTier._id;
            const currency = tier.currency || 'NZD';

            return (
              <div
                key={tier._id}
                className={`relative bg-white rounded-2xl border-2 p-6 transition-all ${
                  isSelected
                    ? 'border-primary-500 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                } ${tier.comingSoon ? 'opacity-60' : ''} ${isCurrent ? 'ring-2 ring-primary-200' : ''}`}
              >
                {marketing.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full">
                    POPULAR
                  </div>
                )}
                {marketing.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary-500 text-white text-xs font-bold rounded-full">
                    RECOMMENDED
                  </div>
                )}
                {tier.comingSoon && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gray-500 text-white text-xs font-bold rounded-full">
                    COMING SOON
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary-600 text-white text-xs font-bold rounded-full">
                    YOUR PLAN
                  </div>
                )}

                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4`}>
                  <TierIcon size={24} className="text-white" />
                </div>

                <h3 className="text-lg font-bold text-gray-900">{tier.displayName}</h3>
                <p className="text-sm text-gray-500 mb-4">{tier.description}</p>

                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">{formatCurrency(tier.price, currency, { decimals: false })}</span>
                  <span className="text-gray-500 text-sm">/year</span>
                </div>

                <EntitlementList
                  entitlements={tier.entitlements}
                  tagLimit={tier.tagLimit}
                  className="mb-6"
                />

                {tier.comingSoon ? (
                  <button
                    disabled
                    className="w-full py-3 px-4 bg-gray-200 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
                  >
                    Coming Soon
                  </button>
                ) : button.variant === 'current' ? (
                  <button
                    disabled
                    className="w-full py-3 px-4 bg-primary-50 text-primary-700 rounded-xl font-semibold cursor-default border border-primary-200"
                  >
                    <Check size={16} className="inline mr-1.5" />
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => hasActiveMembership ? fetchEstimate(tier) : handleSubscribe(tier)}
                    disabled={processing || estimateLoading}
                    className={`w-full py-3 px-4 rounded-xl font-semibold transition-colors ${
                      button.variant === 'upgrade'
                        ? 'bg-primary-600 text-white hover:bg-primary-700'
                        : button.variant === 'downgrade'
                          ? 'bg-amber-600 text-white hover:bg-amber-700'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                    } ${isSelected && processing ? 'bg-primary-400 cursor-wait' : ''}`}
                  >
                    {estimateLoading && isSelected ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" /> Checking...
                      </span>
                    ) : (
                      button.label
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-sm text-gray-400 mt-8">
        All transactions are processed securely through Stripe
      </p>
    </div>
  );
}

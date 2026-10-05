import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Crown, CreditCard } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import { formatCurrency, formatDate } from '@pawtag/shared';
import api from '../../lib/api';
import { ConfirmDialog, resolveTierIcon, resolveTierGradient, EntitlementList } from '@pawtag/ui';
import KeepMembershipPanel from '../../components/KeepMembershipPanel';
import PaymentMethodsPanel from '../../components/PaymentMethodsPanel';

interface MembershipStatus {
  hasMembership: boolean;
  membership: {
    _id: string;
    tierId: {
      _id: string;
      tier: string;
      displayName: string;
      price: number;
      currency?: string;
      icon?: string;
      gradient?: string;
      entitlements?: Record<string, { enabled: boolean; value: any; name?: string; description?: string }>;
      tagLimit?: number;
    };
    status: string;
    price: number;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    autoRenew: boolean;
    cancelledAt?: string;
    cardBrand?: string;
    cardLast4?: string;
    cardExpMonth?: number;
    cardExpYear?: number;
  } | null;
  tier: any;
  entitlements?: Record<string, { enabled: boolean; value: any; name?: string; description?: string }>;
}

interface Tag {
  _id: string;
  tagId: string;
  status: string;
  activePeriodEndsAt?: string;
  warrantyEndsAt?: string;
  membershipStartsAt?: string;
  access: {
    hasAccess: boolean;
    finderEnabled?: boolean;
    reason: string;
    status?: string;
    warrantyEndsAt?: string;
    membershipEndsAt?: string;
    activePeriodEndsAt?: string;
  };
}

export default function MembershipManage() {
  const [status, setStatus] = useState<MembershipStatus | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [statusRes, tagsRes, invoicesRes] = await Promise.all([
        api.get(API.customer.membership.status),
        api.get(API.customer.membership.tags),
        api.get(API.customer.membership.invoices),
      ]);
      setStatus(statusRes.data.data);
      setTags(tagsRes.data.data || []);
      setInvoices(invoicesRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch membership data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!cancelReason) return;
    setActionLoading(true);
    try {
      await api.post(API.customer.membership.cancel, { reason: cancelReason });
      setShowCancelModal(false);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel membership');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleKeepSuccess() {
    await fetchData();
  }

  async function handleOpenBillingPortal() {
    try {
      const res = await api.post(API.customer.membership.paymentMethodsPortal);
      const { url } = res.data.data || {};
      if (url) {
        window.open(url, '_blank');
      } else {
        alert('Payment settings are not available in demo mode.');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to open payment settings');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Cards are account-level: always visible, even without active membership
  if (!status?.hasMembership) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <Crown className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Active Membership</h2>
          <p className="text-gray-500 mb-6">
            Join PawTag membership to unlock premium benefits for your pets. You can still manage saved cards below (shop purchases use the same cards).
          </p>
          <Link
            to="/membership"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
          >
            View Membership Plans
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <PaymentMethodsPanel onChanged={fetchData} />
        </div>
      </div>
    );
  }

  const membership = status.membership!;
  const tier = membership.tierId;
  const tierGradient = resolveTierGradient(tier.tier, tier.gradient);
  const TierIcon = resolveTierIcon(tier.icon, tier.tier);
  const tierCurrency = tier.currency || 'NZD';
  const isCancelling = Boolean(membership.cancelledAt) || membership.status === 'cancelled';
  const isBenefitsEnded =
    Boolean(membership.currentPeriodEnd) &&
    new Date(membership.currentPeriodEnd).getTime() <= Date.now();

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Current Membership Card */}
      <div className={`relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br ${tierGradient}`}>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TierIcon className="h-6 w-6 text-white" />
                <span className="text-white/80 text-xs font-medium uppercase tracking-wider">
                  {isCancelling && !isBenefitsEnded ? 'Cancelling' : isBenefitsEnded && isCancelling ? 'Membership ended' : 'Active Membership'}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{tier.displayName} Membership</h1>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${
              isCancelling
                ? 'bg-amber-400/30 text-amber-100'
                : 'bg-white/20 text-white'
            }`}>
              {isCancelling && !isBenefitsEnded ? 'Cancelling' : membership.status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/80 text-sm">
            <span>Active since {formatDate(membership.currentPeriodStart || membership.currentPeriodEnd, 'long')}</span>
            <span>·</span>
            <span>
              {isCancelling && !isBenefitsEnded ? (
                <>Benefits until {formatDate(membership.currentPeriodEnd, 'long')}</>
              ) : (
                <>Renews {formatDate(membership.currentPeriodEnd, 'long')} ({formatCurrency(membership.price, tierCurrency, { decimals: false })}/yr)</>
              )}
            </span>
            {isCancelling && !isBenefitsEnded && (
              <>
                <span>·</span>
                <span className="font-medium text-amber-100">Auto-renew: Off — no further charges</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions — Keep my Membership is the only action while cancelling */}
      {isCancelling ? (
        <div className="space-y-4">
          <KeepMembershipPanel
            tierDisplayName={tier.displayName}
            benefitsUntil={membership.currentPeriodEnd}
            currentPeriodStart={membership.currentPeriodStart}
            periodEnded={isBenefitsEnded}
            chargeAmount={isBenefitsEnded ? membership.price : 0}
            currency={tierCurrency}
            onSuccess={handleKeepSuccess}
          />

          {!isBenefitsEnded && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">What ends on {formatDate(membership.currentPeriodEnd, 'long')}</h2>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  Free shipping over $100
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  2× Guardian Points on purchases
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  Finder notifications on membership-covered tags
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  Membership tag extension beyond warranty
                </li>
              </ul>
              <p className="text-xs text-gray-400 mt-4">
                We emailed a thank-you discount for your next purchase when you cancelled.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-3">
          <Link
            to="/membership"
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
          >
            Change Plan
          </Link>
          <button
            onClick={() => setShowCancelModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-red-200 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
          >
            Cancel Membership
          </button>
        </div>
      )}

      {/* Benefits */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Your Benefits</h2>
        <EntitlementList
          entitlements={status.entitlements || tier.entitlements || {}}
          variant="check"
          showDisabled={true}
          tagLimit={tier.tagLimit}
        />
      </div>

      {/* Payment Methods — multi-card manager (Stripe Customer source of truth) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <PaymentMethodsPanel onChanged={fetchData} />
      </div>

      {/* Billing History */}
      {invoices.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Billing History</h2>
          <div className="divide-y divide-gray-100">
            {invoices.map((invoice: any) => (
              <div key={invoice._id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                    <CreditCard size={18} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(invoice.createdAt, 'medium')} &middot;{' '}
                      <span className="text-green-600 font-medium">{invoice.status}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(invoice.amount, invoice.currency || 'NZD')}</p>
                  <button
                    onClick={async () => {
                      try {
                        const res = await api.post(API.customer.invoices.access(invoice._id));
                        const { secureUrl } = res.data.data;
                        if (secureUrl) window.open(secureUrl, '_blank');
                      } catch {
                        // silently fail — invoice may not have access token yet
                      }
                    }}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Your Tags</h2>
        {tags.length === 0 ? (
          <p className="text-sm text-gray-500">No tags found</p>
        ) : (
          <div className="space-y-3">
            {tags.map((tag) => (
              <div key={tag._id} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🏷️</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tag.tagId}</p>
                      <p className="text-xs text-gray-500">{tag.access.reason}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    tag.access.finderEnabled ? 'bg-green-100 text-green-700' : 
                    tag.access.hasAccess ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {tag.access.finderEnabled ? 'Active' : 
                     tag.access.hasAccess ? 'Limited' : 'Inactive'}
                  </span>
                </div>
                
                {/* HYBRID 2: Show Active Period and Warranty Period */}
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500 mb-1">Active Period</p>
                    {tag.activePeriodEndsAt ? (
                      <p className={`font-medium ${
                        new Date(tag.activePeriodEndsAt) > new Date() ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {new Date(tag.activePeriodEndsAt) > new Date() 
                          ? `Expires ${formatDate(tag.activePeriodEndsAt)}`
                          : `Expired ${formatDate(tag.activePeriodEndsAt)}`
                        }
                      </p>
                    ) : (
                      <p className="text-gray-400">Not configured</p>
                    )}
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500 mb-1">Warranty Period</p>
                    {tag.warrantyEndsAt ? (
                      <p className={`font-medium ${
                        new Date(tag.warrantyEndsAt) > new Date() ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {new Date(tag.warrantyEndsAt) > new Date() 
                          ? `Expires ${formatDate(tag.warrantyEndsAt)}`
                          : `Expired ${formatDate(tag.warrantyEndsAt)}`
                        }
                      </p>
                    ) : (
                      <p className="text-gray-400">Not configured</p>
                    )}
                  </div>
                </div>

                {/* Show warning if Active Period is expiring soon */}
                {tag.activePeriodEndsAt && 
                 new Date(tag.activePeriodEndsAt) > new Date() && 
                 new Date(tag.activePeriodEndsAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                  <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700">
                      ⚠️ Active Period expiring soon. <Link to="/membership" className="font-medium underline">Purchase membership</Link> to maintain full finder functionality.
                    </p>
                  </div>
                )}

                {/* Limited: Active Period ended, no membership (HYBRID 2) */}
                {(tag.access.status === 'limited' ||
                  (tag.access.hasAccess && tag.access.finderEnabled === false && tag.access.status !== 'active')) && (
                  <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700">
                      ⚠️ Finder notifications are disabled. <Link to="/membership" className="font-medium underline">Purchase membership</Link> to restore full functionality.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      <ConfirmDialog
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancel}
        title="Cancel Membership"
        message={`Your benefits will remain active until ${formatDate(membership.currentPeriodEnd, 'long')}. You'll lose the following benefits at that time:`}
        confirmLabel="Cancel Membership"
        cancelLabel="Keep Membership"
        variant="danger"
        reasons={['Too expensive', 'Not using the benefits', 'Found an alternative', 'Poor experience', 'Other']}
        selectedReason={cancelReason}
        onReasonChange={setCancelReason}
        reasonPlaceholder="Select a reason"
        loading={actionLoading}
        footnote={
          <p className="text-xs text-green-700">
            As a thank you, you'll receive a one-time discount code for your next purchase. Details will be emailed to you.
          </p>
        }
      >
        {/* Benefits being lost — custom children content */}
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-sm font-medium text-gray-900 mb-2">You'll lose these benefits:</p>
          <EntitlementList
            entitlements={status.entitlements || tier.entitlements || {}}
            variant="cross"
            tagLimit={tier.tagLimit}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}

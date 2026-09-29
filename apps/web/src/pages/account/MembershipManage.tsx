import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Crown, Check, Shield, CreditCard, AlertTriangle } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../../lib/api';
import { BottomSheet } from '@pawtag/ui';

interface MembershipStatus {
  hasMembership: boolean;
  membership: {
    _id: string;
    tierId: { tier: string; displayName: string; price: number; entitlements?: Record<string, { enabled: boolean; value: any; name?: string; description?: string }>; tagLimit?: number };
    status: string;
    price: number;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    autoRenew: boolean;
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
    reason: string;
    warrantyEndsAt?: string;
    membershipEndsAt?: string;
    finderEnabled?: boolean;
  };
}

const TIER_COLORS: Record<string, string> = {
  gold: 'from-yellow-400 to-amber-500',
  platinum: 'from-gray-300 to-gray-500',
  black: 'from-gray-800 to-black',
};

const TIER_ICONS: Record<string, typeof Crown> = {
  gold: Crown,
  platinum: Crown,
  black: Shield,
};

export default function MembershipManage() {
  const navigate = useNavigate();
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

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-NZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!status?.hasMembership) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <Crown className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Active Membership</h2>
          <p className="text-gray-500 mb-6">Join PawTag membership to unlock premium benefits for your pets.</p>
          <Link
            to="/membership"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
          >
            View Membership Plans
          </Link>
        </div>
      </div>
    );
  }

  const membership = status.membership!;
  const tier = membership.tierId;
  const tierGradient = TIER_COLORS[tier.tier] || TIER_COLORS.gold;
  const TierIcon = TIER_ICONS[tier.tier] || Crown;

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
                <span className="text-white/80 text-xs font-medium uppercase tracking-wider">Active Membership</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{tier.displayName} Membership</h1>
            </div>
            <span className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide bg-white/20 text-white">
              {membership.status}
            </span>
          </div>
          <div className="flex items-center gap-4 text-white/80 text-sm">
            <span>Active since {formatDate(membership.currentPeriodStart || membership.currentPeriodEnd)}</span>
            <span>·</span>
            <span>Renews {formatDate(membership.currentPeriodEnd)} (${membership.price}/yr)</span>
          </div>
        </div>
      </div>

      {/* Actions */}
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

      {/* Benefits */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Your Benefits</h2>
        <ul className="space-y-3">
          {Object.entries(status.entitlements || tier.entitlements || {}).map(([key, entitlement]) => {
            if (typeof entitlement.value === 'boolean') {
              return (
                <li key={key} className="flex items-center gap-3">
                  <Check className={`h-5 w-5 ${entitlement.enabled && entitlement.value ? 'text-green-500' : 'text-gray-300'}`} />
                  <span className={`text-sm ${entitlement.enabled && entitlement.value ? 'text-gray-700' : 'text-gray-400'}`}>
                    {entitlement.name || key}
                  </span>
                </li>
              );
            }
            if (typeof entitlement.value === 'number') {
              if (key === 'free_shipping_threshold') {
                if (entitlement.value === 0) {
                  return (
                    <li key={key} className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-green-500" />
                      <span className="text-sm text-gray-700">LIFETIME Free Shipping</span>
                    </li>
                  );
                }
                return (
                  <li key={key} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-gray-700">Free Shipping over ${entitlement.value}</span>
                  </li>
                );
              }
              if (key === 'points_multiplier') {
                return (
                  <li key={key} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-gray-700">{entitlement.value}× Guardian Points</span>
                  </li>
                );
              }
              if (key === 'accessory_discount' && entitlement.value > 0) {
                return (
                  <li key={key} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-gray-700">{entitlement.value}% OFF All Accessories</span>
                  </li>
                );
              }
            }
            return null;
          })}
        </ul>
      </div>

      {/* Payment Method */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Payment Method</h2>
          <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            Update
          </button>
        </div>
        {membership.cardBrand ? (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <CreditCard className="h-8 w-8 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {membership.cardBrand.charAt(0).toUpperCase() + membership.cardBrand.slice(1)} ending in {membership.cardLast4}
              </p>
              <p className="text-xs text-gray-500">
                Expires {membership.cardExpMonth}/{membership.cardExpYear}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No payment method on file</p>
        )}
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
                      {new Date(invoice.createdAt).toLocaleDateString('en-NZ', { dateStyle: 'medium' })} &middot;{' '}
                      <span className="text-green-600 font-medium">{invoice.status}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm font-semibold text-gray-900">${invoice.amount.toFixed(2)}</p>
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

                {/* Show message if in limited mode */}
                {tag.access.hasAccess && !tag.access.finderEnabled && (
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
      <BottomSheet open={showCancelModal} onClose={() => setShowCancelModal(false)} title="Cancel Membership">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-700">
              Your benefits will remain active until {formatDate(membership.currentPeriodEnd)}.
            </p>
          </div>

          {/* Benefits being lost */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-900 mb-2">You'll lose these benefits:</p>
            <ul className="space-y-1.5">
              {Object.entries(status.entitlements || tier.entitlements || {}).map(([key, entitlement]) => {
                if (typeof entitlement.value === 'boolean' && entitlement.enabled && entitlement.value) {
                  return (
                    <li key={key} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-red-400">✕</span> {entitlement.name || key}
                    </li>
                  );
                }
                if (key === 'points_multiplier' && typeof entitlement.value === 'number' && entitlement.value > 1) {
                  return (
                    <li key={key} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-red-400">✕</span> {entitlement.value}× Guardian Points
                    </li>
                  );
                }
                if (key === 'accessory_discount' && typeof entitlement.value === 'number' && entitlement.value > 0) {
                  return (
                    <li key={key} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-red-400">✕</span> {entitlement.value}% off accessories
                    </li>
                  );
                }
                return null;
              })}
              <li className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-red-400">✕</span> Cover up to {tier.tagLimit} tags
              </li>
            </ul>
          </div>

          {/* Downgrade alternative */}
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
            <p className="text-sm font-medium text-primary-900 mb-1">Want to keep some benefits?</p>
            <p className="text-xs text-primary-700 mb-2">
              Downgrade to Gold for $89/year and keep core benefits including 3 tag coverage.
            </p>
            <button
              onClick={() => {
                setShowCancelModal(false);
                navigate('/account/membership/change-tier');
              }}
              className="text-sm font-medium text-primary-600 hover:text-primary-700 underline"
            >
              Downgrade instead
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for cancellation *</label>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select a reason</option>
              <option value="too_expensive">Too expensive</option>
              <option value="not_using">Not using the benefits</option>
              <option value="found_alternative">Found an alternative</option>
              <option value="poor_experience">Poor experience</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <p className="text-xs text-green-700">
              As a thank you, you'll receive a one-time 15% discount code + free shipping for your next purchase.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => setShowCancelModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Keep Membership
            </button>
            <button
              onClick={handleCancel}
              disabled={!cancelReason || actionLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading ? 'Cancelling...' : 'Cancel Membership'}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

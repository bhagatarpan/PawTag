import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  Calendar,
  Tag,
  Shield,
  AlertTriangle,
  FileText,
  History,
  Settings,
  Loader2,
  X,
  Lock,
} from 'lucide-react';
import { API } from '@pawtag/shared/api';
import { formatDate, formatCurrency } from '@pawtag/shared';
import { TIER_ICONS, resolveTierGradient } from '@pawtag/ui';
import { useAuth } from '../lib/auth';
import api from '../lib/api';

interface MemberDetail {
  membership: {
    _id: string;
    userId: { _id: string; fullName: string; email: string; phoneNumber?: string };
    tierId: { tier: string; displayName: string; price: number; benefits: any };
    status: string;
    price: number;
    currency?: string;
    currentPeriodEnd: string;
    cardBrand?: string;
    cardLast4?: string;
    autoRenew: boolean;
    pendingTierId?: { tier: string; displayName: string } | null;
    pendingTierEffectiveAt?: string | null;
    downgradeRequestedAt?: string | null;
    dunningStatus?: string;
  };
  tags: Array<{ _id: string; tagId: string; status: string }>;
}

interface AuditEvent {
  _id: string;
  auditEventId: string;
  action: string;
  eventType: string;
  eventCategory: string;
  actorType: string;
  actorId?: string;
  subjectUserId?: string;
  sourceIp?: string;
  userAgent?: string;
  occurredAt: string;
  outcome: string;
  severity: string;
  metadata?: any;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  paidAt?: string;
}

interface EvidenceForm {
  customerEmailDate: string;
  customerEmailContent: string;
  actionRequired: string;
  reason: string;
  csrFullName: string;
  csrEmail: string;
  csrNotes: string;
}

const EMPTY_EVIDENCE: EvidenceForm = {
  customerEmailDate: '',
  customerEmailContent: '',
  actionRequired: '',
  reason: '',
  csrFullName: '',
  csrEmail: '',
  csrNotes: '',
};

export default function MembershipSubscriberDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [extendLoading, setExtendLoading] = useState(false);

  // Extended data
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Modals
  const [showChangeTierModal, setShowChangeTierModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceForm>(EMPTY_EVIDENCE);
  const [targetTierId, setTargetTierId] = useState('');
  const [tiers, setTiers] = useState<Array<{ _id: string; tier: string; displayName: string; price: number }>>([]);

  useEffect(() => {
    if (id) {
      fetchDetail();
      fetchAuditHistory();
      fetchInvoices();
    }
  }, [id]);

  async function fetchDetail() {
    try {
      const res = await api.get(API.admin.membership.subscriber(id!));
      setData(res.data.data);
    } catch (err) {
      console.error('Failed to fetch member detail:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAuditHistory() {
    setAuditLoading(true);
    try {
      const res = await api.get(API.admin.users.membershipAudit(id!));
      setAuditEvents(res.data.data?.items || []);
    } catch (err) {
      console.error('Failed to fetch audit history:', err);
    } finally {
      setAuditLoading(false);
    }
  }

  async function fetchInvoices() {
    try {
      const res = await api.get(API.admin.users.invoices(id!));
      setInvoices(res.data.data?.items || []);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    }
  }

  async function fetchTiers() {
    try {
      const res = await api.get(API.admin.membership.tiers);
      setTiers(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch tiers:', err);
    }
  }

  async function handleExtend(extensionType: 'charge' | 'grace') {
    if (!confirm(`Extend membership by 30 days (${extensionType === 'charge' ? 'with charge' : 'complimentary'})?`)) return;
    setExtendLoading(true);
    try {
      await api.post(API.admin.membership.extend, {
        membershipId: id,
        extensionType,
        extensionDays: 30,
      });
      await fetchDetail();
      await fetchAuditHistory();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to extend membership');
    } finally {
      setExtendLoading(false);
    }
  }

  async function handleChangeTier() {
    if (!targetTierId) { alert('Please select a target tier'); return; }
    if (!evidence.customerEmailDate || !evidence.customerEmailContent || !evidence.actionRequired || !evidence.reason || !evidence.csrFullName || !evidence.csrEmail) {
      alert('Please fill in all required evidence fields');
      return;
    }

    setModalLoading(true);
    try {
      await api.post(API.admin.membership.changeTier, {
        membershipId: id,
        newTierId: targetTierId,
        evidence,
      });
      setShowChangeTierModal(false);
      setEvidence(EMPTY_EVIDENCE);
      setTargetTierId('');
      await fetchDetail();
      await fetchAuditHistory();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to change tier');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleCancelMembership() {
    if (!evidence.customerEmailDate || !evidence.customerEmailContent || !evidence.actionRequired || !evidence.reason || !evidence.csrFullName || !evidence.csrEmail) {
      alert('Please fill in all required evidence fields');
      return;
    }

    setModalLoading(true);
    try {
      await api.post(API.admin.membership.cancel, {
        membershipId: id,
        evidence,
      });
      setShowCancelModal(false);
      setEvidence(EMPTY_EVIDENCE);
      await fetchDetail();
      await fetchAuditHistory();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel membership');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleOpenBillingPortal() {
    try {
      const res = await api.post('/admin/membership/payment-portal', { membershipId: id });
      const { url } = res.data.data || {};
      if (url) window.open(url, '_blank');
      else alert('Portal not available in demo mode');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to open billing portal');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <p className="text-gray-500">Member not found</p>
      </div>
    );
  }

  const { membership, tags } = data;
  const tier = membership.tierId;
  const Icon = TIER_ICONS[tier?.tier] || TIER_ICONS.gold;
  const hasPendingDowngrade = Boolean(membership.pendingTierId);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Back Link */}
      <Link to="/membership/subscribers" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> Back to Subscribers
      </Link>

      {/* Member Header */}
      <div className={`rounded-2xl p-6 bg-gradient-to-br ${resolveTierGradient(tier?.tier || '', (tier as any)?.gradient)}`}>
        <div className="flex items-center gap-4">
          <Icon className="h-10 w-10 text-white" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{tier?.displayName || 'Unknown'} Membership</h1>
            <p className="text-white/80">{membership.userId?.fullName} ({membership.userId?.email})</p>
          </div>
          <div className="text-right">
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
              membership.status === 'active' ? 'bg-green-500/20 text-green-100' :
              membership.status === 'cancelled' ? 'bg-amber-500/20 text-amber-100' :
              'bg-red-500/20 text-red-100'
            }`}>
              {membership.status}
            </span>
            {membership.dunningStatus === 'past_due' && (
              <div className="mt-1">
                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-500/20 text-red-100">
                  Payment Past Due
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending Downgrade Warning */}
      {hasPendingDowngrade && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">Pending Downgrade</span>
          </div>
          <p className="text-sm text-amber-700">
            Downgrade to <strong>{membership.pendingTierId?.displayName}</strong> scheduled for{' '}
            {membership.pendingTierEffectiveAt ? formatDate(membership.pendingTierEffectiveAt) : 'renewal'}.
            {membership.downgradeRequestedAt && (
              <span className="text-amber-600"> Requested {formatDate(membership.downgradeRequestedAt)}.</span>
            )}
          </p>
        </div>
      )}

      {/* Membership Details Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">Renewal Date</span>
          </div>
          <p className="font-semibold text-gray-900">{formatDate(membership.currentPeriodEnd)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">Payment Method</span>
          </div>
          <p className="font-semibold text-gray-900">
            {membership.cardBrand ? `${membership.cardBrand} ending in ${membership.cardLast4}` : 'No payment method'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">Price</span>
          </div>
          <p className="font-semibold text-gray-900">
            {formatCurrency(membership.price, membership.currency || 'NZD', { decimals: false })}/year
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">Auto-Renew</span>
          </div>
          <p className={`font-semibold ${membership.autoRenew ? 'text-green-600' : 'text-gray-500'}`}>
            {membership.autoRenew ? 'Enabled' : 'Disabled'}
          </p>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Admin Actions</h2>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => handleExtend('charge')}
            disabled={extendLoading}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            Extend 30 Days (Charge)
          </button>
          <button
            onClick={() => handleExtend('grace')}
            disabled={extendLoading}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
          >
            Extend 30 Days (Complimentary)
          </button>
          <button
            onClick={() => {
              fetchTiers();
              setEvidence({ ...EMPTY_EVIDENCE, csrFullName: user?.fullName || '', csrEmail: user?.email || '' });
              setShowChangeTierModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Change Tier
          </button>
          <button
            onClick={() => {
              setEvidence({ ...EMPTY_EVIDENCE, csrFullName: user?.fullName || '', csrEmail: user?.email || '' });
              setShowCancelModal(true);
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            Cancel Membership
          </button>
          <button
            onClick={handleOpenBillingPortal}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
          >
            Billing Portal
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Tier changes and cancellations require customer email evidence. Changes are logged with full audit trail.
        </p>
      </div>

      {/* Tags Covered */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Tag className="h-4 w-4" /> Tags Covered
        </h2>
        {tags.length === 0 ? (
          <p className="text-sm text-gray-500">No tags linked</p>
        ) : (
          <div className="space-y-2">
            {tags.map((tag) => (
              <div key={tag._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="font-mono text-sm font-bold">{tag.tagId}</span>
                <span className={`text-xs font-medium ${tag.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                  {tag.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Billing History */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4" /> Billing History
        </h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-gray-500">No invoices found</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-mono text-sm font-bold">{inv.invoiceNumber}</p>
                  <p className="text-xs text-gray-500">{formatDate(inv.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatCurrency(inv.amount, inv.currency)}</p>
                  <span className={`text-xs font-medium ${
                    inv.status === 'paid' ? 'text-green-600' :
                    inv.status === 'failed' ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit History */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <History className="h-4 w-4" /> Membership Audit Trail
        </h2>
        {auditLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
          </div>
        ) : auditEvents.length === 0 ? (
          <p className="text-sm text-gray-500">No audit events found</p>
        ) : (
          <div className="space-y-2">
            {auditEvents.slice(0, 20).map((event) => (
              <div key={event._id} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {event.action === 'membership_kept'
                      ? 'Customer kept membership'
                      : event.action === 'membership_reactivated_paid'
                        ? 'Membership reactivated (paid)'
                        : event.action === 'membership_resumed'
                          ? 'Membership resumed'
                          : event.action === 'membership_cancelled'
                            ? 'Membership cancelled'
                            : event.action}
                  </span>
                  <span className="text-xs text-gray-500">{formatDate(event.occurredAt)}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>Actor: {event.actorType}</span>
                  {event.sourceIp && <span>IP: {event.sourceIp}</span>}
                  <span className={`font-medium ${
                    event.outcome === 'SUCCESS' ? 'text-green-600' :
                    event.outcome === 'FAILURE' ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {event.outcome}
                  </span>
                  {event.metadata?.chargeAmount !== undefined && (
                    <span>Amount: {formatCurrency(event.metadata.chargeAmount, event.metadata.currency || 'NZD')}</span>
                  )}
                  {event.metadata?.preservedOriginalDates && (
                    <span className="text-green-600">Original dates preserved</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Change Tier Modal */}
      {showChangeTierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Change Tier</h3>
                <button onClick={() => setShowChangeTierModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Target Tier */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">New Tier *</label>
                <select
                  value={targetTierId}
                  onChange={(e) => setTargetTierId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                >
                  <option value="">Select a tier</option>
                  {tiers.filter(t => t._id !== (tier as any)?._id).map((t) => (
                    <option key={t._id} value={t._id}>{t.displayName} — ${t.price}/year</option>
                  ))}
                </select>
              </div>

              {/* Evidence Form */}
              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700">Required Evidence</p>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Customer Email Date *</label>
                  <input
                    type="date"
                    value={evidence.customerEmailDate}
                    onChange={(e) => setEvidence({ ...evidence, customerEmailDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Customer Email Content *</label>
                  <textarea
                    value={evidence.customerEmailContent}
                    onChange={(e) => setEvidence({ ...evidence, customerEmailContent: e.target.value })}
                    rows={3}
                    placeholder="Paste or describe the customer's request"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Action Required *</label>
                  <input
                    type="text"
                    value={evidence.actionRequired}
                    onChange={(e) => setEvidence({ ...evidence, actionRequired: e.target.value })}
                    placeholder="e.g. Upgrade to Platinum at customer request"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Reason *</label>
                  <select
                    value={evidence.reason}
                    onChange={(e) => setEvidence({ ...evidence, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Select a reason</option>
                    <option value="customer_request">Customer requested</option>
                    <option value="pricing">Pricing issue</option>
                    <option value="error">Error correction</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">CSR Full Name *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={evidence.csrFullName}
                      readOnly
                      className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                    />
                    <Lock size={14} className="absolute right-3 top-2.5 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">CSR Email *</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={evidence.csrEmail}
                      readOnly
                      className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                    />
                    <Lock size={14} className="absolute right-3 top-2.5 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
                  <textarea
                    value={evidence.csrNotes}
                    onChange={(e) => setEvidence({ ...evidence, csrNotes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleChangeTier}
                  disabled={modalLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : null}
                  Change Tier
                </button>
                <button
                  onClick={() => setShowChangeTierModal(false)}
                  disabled={modalLoading}
                  className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Cancel Membership</h3>
                <button onClick={() => setShowCancelModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-red-700">
                  This will schedule cancellation at period end. Benefits remain active until {formatDate(membership.currentPeriodEnd)}.
                </p>
              </div>

              {/* Evidence Form */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Required Evidence</p>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Customer Email Date *</label>
                  <input
                    type="date"
                    value={evidence.customerEmailDate}
                    onChange={(e) => setEvidence({ ...evidence, customerEmailDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Customer Email Content *</label>
                  <textarea
                    value={evidence.customerEmailContent}
                    onChange={(e) => setEvidence({ ...evidence, customerEmailContent: e.target.value })}
                    rows={3}
                    placeholder="Paste or describe the customer's request"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Action Required *</label>
                  <input
                    type="text"
                    value={evidence.actionRequired}
                    onChange={(e) => setEvidence({ ...evidence, actionRequired: e.target.value })}
                    placeholder="e.g. Cancel membership at customer request"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Reason *</label>
                  <select
                    value={evidence.reason}
                    onChange={(e) => setEvidence({ ...evidence, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Select a reason</option>
                    <option value="too_expensive">Too expensive</option>
                    <option value="not_using">Not using benefits</option>
                    <option value="found_alternative">Found alternative</option>
                    <option value="poor_experience">Poor experience</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">CSR Full Name *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={evidence.csrFullName}
                      readOnly
                      className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                    />
                    <Lock size={14} className="absolute right-3 top-2.5 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">CSR Email *</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={evidence.csrEmail}
                      readOnly
                      className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                    />
                    <Lock size={14} className="absolute right-3 top-2.5 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
                  <textarea
                    value={evidence.csrNotes}
                    onChange={(e) => setEvidence({ ...evidence, csrNotes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCancelMembership}
                  disabled={modalLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : null}
                  Cancel Membership
                </button>
                <button
                  onClick={() => setShowCancelModal(false)}
                  disabled={modalLoading}
                  className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Keep Membership
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
